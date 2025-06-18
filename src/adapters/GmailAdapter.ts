import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { IAdapter } from './IAdapter';
import { NormalizedEmail, FetchOptions, GmailCredentials, Attachment } from '../interfaces.js';
import { EmailParserService } from '../services/EmailParserService';

export class GmailAdapter implements IAdapter {
  private oauth2Client_?: OAuth2Client;
  private gmail_?: gmail_v1.Gmail;
  private credentials_?: GmailCredentials;
  private emailParserService: EmailParserService;
  private initialized: boolean = false;

  constructor() {
    this.emailParserService = new EmailParserService();
  }

  public async initialize(credentials: GmailCredentials): Promise<void> {
    this.credentials_ = credentials;
    this.oauth2Client_ = new google.auth.OAuth2(
      this.credentials_.clientId,
      this.credentials_.clientSecret
    );
    this.oauth2Client_.setCredentials({ refresh_token: this.credentials_.refreshToken });
    this.gmail_ = google.gmail({ version: 'v1', auth: this.oauth2Client_ });
    this.initialized = true;
    // Attempt an initial authentication to confirm credentials are valid
    // await this.authenticate(); 
    // Consider if initial authenticate here is desired or if it should happen on first fetch
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.oauth2Client_ || !this.gmail_ || !this.credentials_) {
      throw new Error('GmailAdapter not initialized. Call initialize(credentials) first.');
    }
  }

  public async authenticate(): Promise<void> {
    this.ensureInitialized();
    try {
      // The getAccessToken method will handle refreshing if necessary
      const tokenResponse = await this.oauth2Client_!.getAccessToken();
      if (!tokenResponse.token) {
        throw new Error('Failed to refresh access token.');
      }
      // console.log('Gmail authentication successful, token refreshed/validated.');
    } catch (error) {
      console.error('Gmail authentication error:', error);
      // Provide more specific error messages based on the type of error
      if ((error as any).message?.includes('invalid_grant')) {
        throw new Error('Gmail authentication failed: Invalid grant. Refresh token might be expired or revoked.');
      }
      throw new Error(`Gmail authentication failed: ${(error as Error).message}`);
    }
  }

  public async fetchEmails(options: FetchOptions): Promise<NormalizedEmail[]> {
    this.ensureInitialized();
    await this.authenticate(); // Ensure token is fresh

    const { limit = 10, query, since, unreadOnly } = options;
    let gmailQuery = query || '';

    if (since) {
      const sinceDate = typeof since === 'string' ? new Date(since) : since;
      gmailQuery += ` after:${sinceDate.getFullYear()}/${sinceDate.getMonth() + 1}/${sinceDate.getDate()}`;
    }
    if (unreadOnly) {
      gmailQuery += ' is:unread';
    }
    gmailQuery = gmailQuery.trim();

    try {
      const listMessagesResponse = await this.gmail_!.users.messages.list({
        userId: 'me',
        q: gmailQuery || undefined, // q parameter cannot be empty string
        maxResults: limit,
      });

      const messages = listMessagesResponse.data.messages;
      if (!messages || messages.length === 0) {
        return [];
      }

      const normalizedEmails: NormalizedEmail[] = [];
      for (const messageHeader of messages) {
        if (!messageHeader.id) continue;

        const messageResponse = await this.gmail_!.users.messages.get({
          userId: 'me',
          id: messageHeader.id,
          format: 'raw', // Get the full raw email for parsing
        });

        if (messageResponse.data.raw) {
          const rawEmail = Buffer.from(messageResponse.data.raw, 'base64').toString('utf-8');
          // Use messageResponse.data.id! as it's confirmed to exist from messageHeader.id
          const normalized = await this.emailParserService.parseEmail(rawEmail, messageResponse.data.id!, 'gmail');
          
          // Refine attachment details using Gmail API if needed, especially for skipping inline
          // For now, EmailParserService provides initial attachment parsing.
          // PRD: "Skips inline images"
          // We can enhance this by checking parts from 'payload' if format was 'full'
          // and correlating with attachments from mailparser.

          if (messageResponse.data.payload && messageResponse.data.payload.headers) {
            const subjectHeader = messageResponse.data.payload.headers.find(h => h.name === 'Subject');
            normalized.subject = subjectHeader?.value || normalized.subject; // Prefer Gmail API's direct subject
            // Similarly for From, To, Date if mailparser's result is less reliable
          }
          normalized.threadId = messageResponse.data.threadId || normalized.threadId;
          normalized.labels = messageResponse.data.labelIds || normalized.labels;


          // Implement skipping inline images based on PRD
          // This requires more detailed parsing of message parts if not using 'raw' and mailparser alone
          // For now, we rely on mailparser's output. A more robust solution would inspect
          // messageResponse.data.payload.parts for contentDisposition.
          normalized.attachments = normalized.attachments.filter(att => {
            // A simple heuristic: if contentId exists, it might be inline.
            // A better check involves seeing if the contentId is referenced in the HTML body.
            // Or, if using format: 'full', check part.headers for 'Content-Disposition: inline'
            // For now, we'll keep all attachments parsed by mailparser.
            // To implement "Skips inline images", we'd need to:
            // 1. Fetch message with format: 'full' or 'metadata' along with 'raw'.
            // 2. Iterate through messageResponse.data.payload.parts.
            // 3. If a part has a header 'Content-Disposition' that includes 'inline', mark it.
            // 4. Correlate these parts with attachments from mailparser (e.g., by filename or partId).
            // This is a simplification for now.
            return true; 
          });


          normalizedEmails.push(normalized);
        }
      }
      return normalizedEmails;
    } catch (error) {
      console.error('Error fetching Gmail emails:', error);
      // Check for specific Google API errors if possible
      if ((error as any).code === 401) {
         throw new Error(`Gmail authentication error (401). Check your refresh token and API permissions. Original: ${(error as Error).message}`);
      }
      throw new Error(`Failed to fetch Gmail emails: ${(error as Error).message}`);
    }
  }
}
