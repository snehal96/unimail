import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { IAdapter, PaginatedEmailsResponse } from './IAdapter.ts';
import { 
  NormalizedEmail, 
  FetchOptions, 
  GmailCredentials, 
  Attachment, 
  EmailStreamOptions, 
  EmailStreamCallbacks, 
  EmailStreamProgress,
  HistoryResponse,
  HistoryRecord,
  PushNotificationConfig,
  PushNotificationSetup,
  SyncOptions,
  SyncResult,
  SyncState
} from '../interfaces.ts';
import { EmailParserService } from '../services/EmailParserService.ts';
import { EmailStreamService } from '../services/EmailStreamService.ts';
import { OAuthService } from '../auth/OAuthService.ts';
import { GoogleOAuthProvider } from '../auth/providers/GoogleOAuthProvider.ts';

export class GmailAdapter implements IAdapter {
  private oauth2Client_?: OAuth2Client;
  private gmail_?: gmail_v1.Gmail;
  private credentials_?: GmailCredentials;
  private emailParserService: EmailParserService;
  private initialized: boolean = false;
  private oauthService?: OAuthService;

  constructor() {
    this.emailParserService = new EmailParserService();
  }

  /**
   * Initialize the Gmail adapter with credentials.
   * This method now supports both traditional refresh token authentication
   * and the new OAuth flow using an auth code.
   */
  public async initialize(credentials: GmailCredentials): Promise<void> {
    this.credentials_ = credentials;
    
    // Create OAuth2Client
    this.oauth2Client_ = new google.auth.OAuth2(
      this.credentials_.clientId,
      this.credentials_.clientSecret,
      this.credentials_.redirectUri
    );
    
    // Handle OAuth flow if auth code is provided instead of refresh token
    if (!this.credentials_.refreshToken && this.credentials_.authCode) {
      if (!this.credentials_.redirectUri) {
        throw new Error('redirectUri is required when using authCode for authentication');
      }
      
      try {
        // Exchange the auth code for tokens
        const { tokens } = await this.oauth2Client_.getToken(this.credentials_.authCode);
        
        // Save the refresh token
        if (tokens.refresh_token) {
          this.credentials_.refreshToken = tokens.refresh_token;
        } else {
          throw new Error('No refresh token received. Make sure you are requesting offline access and forcing consent.');
        }
        
        // Set the credentials
        this.oauth2Client_.setCredentials(tokens);
      } catch (error) {
        throw new Error(`Failed to exchange auth code for tokens: ${(error as Error).message}`);
      }
    } else if (this.credentials_.refreshToken) {
      // Use existing refresh token
      this.oauth2Client_.setCredentials({ refresh_token: this.credentials_.refreshToken });
    } else {
      throw new Error('Either refreshToken or authCode must be provided in the credentials');
    }
    
    // Create Gmail API client
    this.gmail_ = google.gmail({ version: 'v1', auth: this.oauth2Client_ });
    this.initialized = true;
  }
  
  /**
   * Start the OAuth flow to get authorization from the user
   * @returns The authorization URL that the user should visit
   */
  public static async startOAuthFlow(
    clientId: string, 
    clientSecret: string, 
    redirectUri: string,
    port: number = 3000,
    callbackPath: string = '/oauth/callback'
  ): Promise<string> {
    const oauthService = new OAuthService(new GoogleOAuthProvider());
    
    const authUrl = await oauthService.startOAuthFlow(
      {
        clientId,
        clientSecret,
        redirectUri,
        scopes: ['https://mail.google.com/'],
        accessType: 'offline',
        prompt: 'consent'
      },
      undefined, // No user ID needed for this flow
      callbackPath,
      port
    );
    
    return authUrl;
  }
  
  /**
   * Handle the OAuth callback manually (for server-side applications)
   * @returns TokenData containing access and refresh tokens
   */
  public static async handleOAuthCallback(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<{ accessToken: string, refreshToken?: string }> {
    const oauthService = new OAuthService(new GoogleOAuthProvider());
    
    const tokenData = await oauthService.handleCallback(
      code,
      {
        clientId,
        clientSecret,
        redirectUri,
        scopes: ['https://mail.google.com/']
      }
    );
    
    return {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken
    };
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

  public async fetchEmails(options: FetchOptions): Promise<PaginatedEmailsResponse> {
    this.ensureInitialized();
    await this.authenticate(); // Ensure token is fresh

    const { 
      limit = 10, 
      query, 
      since, 
      before,
      unreadOnly, 
      includeBody = true, 
      includeAttachments = true, 
      format,
      pageToken,
      pageSize,
      getAllPages = false
    } = options;

    let gmailQuery = query || '';

    // Determine the best format to use based on options
    let messageFormat: 'raw' | 'full' | 'metadata' = format || 'raw';
    
    // If format isn't explicitly specified, infer it based on what the user needs
    if (!format) {
      if (!includeBody && !includeAttachments) {
        messageFormat = 'metadata'; // Just need headers
      } else if (includeBody && includeAttachments) {
        // Keep 'raw' for backward compatibility and most complete parsing
        messageFormat = 'raw';
      } else {
        // Need some message content but not everything
        messageFormat = 'full';
      }
    }

    if (since) {
      const sinceDate = typeof since === 'string' ? new Date(since) : since;
      gmailQuery += ` after:${sinceDate.getFullYear()}/${sinceDate.getMonth() + 1}/${sinceDate.getDate()}`;
    }
    if (before) {
      const beforeDate = typeof before === 'string' ? new Date(before) : before;
      gmailQuery += ` before:${beforeDate.getFullYear()}/${beforeDate.getMonth() + 1}/${beforeDate.getDate()}`;
    }
    if (unreadOnly) {
      gmailQuery += ' is:unread';
    }
    gmailQuery = gmailQuery.trim();

    try {
      if (getAllPages) {
        // Show deprecation warning
        console.warn('Warning: getAllPages option is deprecated and may cause memory issues with large datasets. Consider using streamEmails() instead.');
        
        // Fetch all pages up to limit
        return await this.fetchAllEmailPages(gmailQuery, limit, messageFormat, includeBody, includeAttachments);
      } else {
        // Fetch a single page
        return await this.fetchEmailPage(
          gmailQuery, 
          pageSize || limit, 
          messageFormat, 
          includeBody, 
          includeAttachments, 
          pageToken
        );
      }
    } catch (error) {
      console.error('Error fetching Gmail emails:', error);
      // Check for specific Google API errors if possible
      if ((error as any).code === 401) {
         throw new Error(`Gmail authentication error (401). Check your refresh token and API permissions. Original: ${(error as Error).message}`);
      }
      throw new Error(`Failed to fetch Gmail emails: ${(error as Error).message}`);
    }
  }

  /**
   * Stream emails in batches using async generator
   * Memory-efficient way to process large numbers of emails
   */
  public async *streamEmails(options: EmailStreamOptions): AsyncGenerator<NormalizedEmail[], void, unknown> {
    this.ensureInitialized();
    await this.authenticate();
    
    // Validate options
    EmailStreamService.validateStreamOptions(options);
    
    // Build Gmail query from options
    const gmailQuery = this.buildGmailQuery(options);
    
    // Determine format based on options
    const messageFormat = this.determineMessageFormat(options);
    
    // Create the fetch function for the stream service
    const fetchPageFn = async (pageToken?: string, pageSize?: number) => {
      return await this.fetchEmailPage(
        gmailQuery,
        pageSize || options.batchSize || 50,
        messageFormat,
        options.includeBody !== false,
        options.includeAttachments !== false,
        pageToken
      );
    };
    
    // Use the stream service to create the generator
    yield* EmailStreamService.createEmailStream(fetchPageFn, options);
  }
  
  /**
   * Stream emails with callback-based progress tracking
   * Provides detailed progress information and error handling
   */
  public async fetchEmailsStream(options: EmailStreamOptions, callbacks: EmailStreamCallbacks): Promise<void> {
    this.ensureInitialized();
    await this.authenticate();
    
    // Create enhanced progress tracking
    let totalCount: number | undefined;
    let processedCount = 0;
    
    const enhancedCallbacks: EmailStreamCallbacks = {
      ...callbacks,
      onBatch: async (emails, progress) => {
        // Enhance progress with Gmail-specific information
        const enhancedProgress: EmailStreamProgress = {
          ...progress,
          total: totalCount,
          estimatedRemaining: EmailStreamService.calculateEstimatedRemaining(totalCount, progress.current)
        };
        
        if (callbacks.onBatch) {
          await callbacks.onBatch(emails, enhancedProgress);
        }
      },
      onProgress: async (progress) => {
        const enhancedProgress: EmailStreamProgress = {
          ...progress,
          total: totalCount,
          estimatedRemaining: EmailStreamService.calculateEstimatedRemaining(totalCount, progress.current)
        };
        
        if (callbacks.onProgress) {
          await callbacks.onProgress(enhancedProgress);
        }
      }
    };
    
    // Create stream generator and process it
    const streamGenerator = this.streamEmails(options);
    
    // Get total count from first batch if available
    const firstBatch = await streamGenerator.next();
    if (!firstBatch.done && firstBatch.value.length > 0) {
      // Try to get total count - this is a best effort
      try {
        const countResponse = await this.gmail_!.users.messages.list({
          userId: 'me',
          q: this.buildGmailQuery(options) || undefined,
          maxResults: 1
        });
                 totalCount = countResponse.data.resultSizeEstimate || undefined;
      } catch (error) {
        // Ignore errors getting total count
        console.warn('Could not get total email count:', error);
      }
      
      // Process the first batch we already retrieved
      if (enhancedCallbacks.onBatch) {
        const progress: EmailStreamProgress = {
          current: firstBatch.value.length,
          total: totalCount,
          batchCount: 1,
          estimatedRemaining: EmailStreamService.calculateEstimatedRemaining(totalCount, firstBatch.value.length)
        };
        await enhancedCallbacks.onBatch(firstBatch.value, progress);
      }
      
      // Create a new generator that includes the first batch
      const remainingGenerator = async function* () {
        yield firstBatch.value;
        yield* streamGenerator;
      };
      
      await EmailStreamService.processEmailStream(remainingGenerator(), enhancedCallbacks);
    } else {
      // No emails found
      await EmailStreamService.processEmailStream(streamGenerator, enhancedCallbacks);
    }
  }
  
  /**
   * Helper method to build Gmail query from stream options
   */
  private buildGmailQuery(options: EmailStreamOptions): string {
    let gmailQuery = options.query || '';

    if (options.since) {
      const sinceDate = typeof options.since === 'string' ? new Date(options.since) : options.since;
      gmailQuery += ` after:${sinceDate.getFullYear()}/${sinceDate.getMonth() + 1}/${sinceDate.getDate()}`;
    }
    if (options.before) {
      const beforeDate = typeof options.before === 'string' ? new Date(options.before) : options.before;
      gmailQuery += ` before:${beforeDate.getFullYear()}/${beforeDate.getMonth() + 1}/${beforeDate.getDate()}`;
    }
    if (options.unreadOnly) {
      gmailQuery += ' is:unread';
    }
    
    return gmailQuery.trim();
  }
  
  /**
   * Helper method to determine message format from options
   */
  private determineMessageFormat(options: EmailStreamOptions): 'raw' | 'full' | 'metadata' {
    if (options.format) {
      return options.format;
    }
    
    const includeBody = options.includeBody !== false;
    const includeAttachments = options.includeAttachments !== false;
    
    if (!includeBody && !includeAttachments) {
      return 'metadata';
    } else if (includeBody && includeAttachments) {
      return 'raw';
    } else {
      return 'full';
    }
  }

  /**
   * Fetches a single page of emails
   */
  private async fetchEmailPage(
    query: string,
    maxResults: number,
    messageFormat: 'raw' | 'full' | 'metadata',
    includeBody: boolean,
    includeAttachments: boolean,
    pageToken?: string
  ): Promise<PaginatedEmailsResponse> {
    const listMessagesResponse = await this.gmail_!.users.messages.list({
      userId: 'me',
      q: query || undefined, // q parameter cannot be empty string
      maxResults,
      pageToken
    });

    const messages = listMessagesResponse.data.messages;
    if (!messages || messages.length === 0) {
      return { 
        emails: [], 
        nextPageToken: listMessagesResponse.data.nextPageToken || undefined,
        totalCount: listMessagesResponse.data.resultSizeEstimate || undefined
      };
    }

    const normalizedEmails: NormalizedEmail[] = [];
    for (const messageHeader of messages) {
      if (!messageHeader.id) continue;

      const messageResponse = await this.gmail_!.users.messages.get({
        userId: 'me',
        id: messageHeader.id,
        format: messageFormat, // Use the determined format
      });

      let normalized: NormalizedEmail;

      if (messageFormat === 'raw' && messageResponse.data.raw) {
        // Process using raw email format
        const rawEmail = Buffer.from(messageResponse.data.raw, 'base64').toString('utf-8');
        normalized = await this.emailParserService.parseEmail(rawEmail, messageResponse.data.id!, 'gmail');
        
        normalized.threadId = messageResponse.data.threadId || normalized.threadId;
        normalized.labels = messageResponse.data.labelIds || normalized.labels;
      } else {
        // Process using structured data from Gmail API
        normalized = await this.parseStructuredMessage(messageResponse.data, includeBody, includeAttachments);
      }

      // Implement skipping inline images
      normalized.attachments = normalized.attachments.filter(att => {
        if (att.contentId && normalized.bodyHtml?.includes(`cid:${att.contentId.replace(/[<>]/g, '')}`)) {
          // This is likely an inline image referenced in the HTML
          return false;
        }
        return true;
      });

      normalizedEmails.push(normalized);
    }
    
    return { 
      emails: normalizedEmails, 
      nextPageToken: listMessagesResponse.data.nextPageToken || undefined,
      totalCount: listMessagesResponse.data.resultSizeEstimate || undefined
    };
  }

  /**
   * Fetches all pages of emails up to the specified limit
   */
  private async fetchAllEmailPages(
    query: string,
    limit: number,
    messageFormat: 'raw' | 'full' | 'metadata',
    includeBody: boolean,
    includeAttachments: boolean,
    size?: number
  ): Promise<PaginatedEmailsResponse> {
    const allEmails: NormalizedEmail[] = [];
    let nextPageToken: string | undefined;
    let totalCount: number | undefined;
    
    // Use a reasonable page size (Gmail API default is 100)
    const pageSize = size || Math.min(limit, 100);
    
    do {
      const response = await this.fetchEmailPage(
        query, 
        pageSize, 
        messageFormat, 
        includeBody, 
        includeAttachments, 
        nextPageToken
      );
      
      allEmails.push(...response.emails);
      nextPageToken = response.nextPageToken;
      
      // Store the total count from the first response
      if (totalCount === undefined && response.totalCount !== undefined) {
        totalCount = response.totalCount;
      }
      
      // Stop if we've reached the limit or there are no more pages
      if (!nextPageToken || allEmails.length >= limit) {
        break;
      }
    } while (true);
    
    // Enforce the limit (in case we fetched more than needed)
    const limitedEmails = allEmails.slice(0, limit);
    
    return { 
      emails: limitedEmails,
      // Don't return nextPageToken if we've fetched all pages or reached the limit
      nextPageToken: allEmails.length >= limit ? nextPageToken : undefined,
      totalCount
    };
  }

  /**
   * Parses a Gmail message from structured data (when using 'full' or 'metadata' format)
   * @param message The Gmail message object from the API
   * @param includeBody Whether to include message body content
   * @param includeAttachments Whether to include attachment data
   */
  private async parseStructuredMessage(
    message: gmail_v1.Schema$Message, 
    includeBody: boolean = true,
    includeAttachments: boolean = true
  ): Promise<NormalizedEmail> {
    // Initialize the normalized email
    const normalized: NormalizedEmail = {
      id: message.id!,
      threadId: message.threadId || undefined,
      from: '',
      to: [],
      attachments: [],
      date: new Date(),
      provider: 'gmail',
      labels: message.labelIds || []
    };

    // Extract headers
    if (message.payload?.headers) {
      for (const header of message.payload.headers) {
        switch(header.name?.toLowerCase()) {
          case 'from':
            normalized.from = header.value || '';
            break;
          case 'to':
            normalized.to = header.value?.split(',').map(addr => addr.trim()) || [];
            break;
          case 'cc':
            normalized.cc = header.value?.split(',').map(addr => addr.trim()) || [];
            break;
          case 'bcc':
            normalized.bcc = header.value?.split(',').map(addr => addr.trim()) || [];
            break;
          case 'subject':
            normalized.subject = header.value || undefined;
            break;
          case 'date':
            normalized.date = header.value ? new Date(header.value) : new Date();
            break;
        }
      }
    }

    // Extract body and attachments only if needed and available
    if (includeBody && message.payload) {
      // Process parts only if we're using 'full' format and have parts
      if (message.payload.parts && message.payload.parts.length > 0) {
        // Extract text and HTML bodies
        for (const part of message.payload.parts) {
          // Plain text body
          if (part.mimeType === 'text/plain' && part.body?.data) {
            normalized.bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
          // HTML body
          else if (part.mimeType === 'text/html' && part.body?.data) {
            normalized.bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
          // Handle attachments
          else if (includeAttachments && part.filename && part.body) {
            const attachment: Attachment = {
              filename: part.filename,
              mimeType: part.mimeType || 'application/octet-stream',
              size: part.body.size || 0,
              contentId: part.headers?.find(h => h.name?.toLowerCase() === 'content-id')?.value || undefined,
            };
            
            // Only fetch attachment data if we need the buffer and we have an attachment ID
            if (part.body.attachmentId) {
              try {
                const attachmentResponse = await this.gmail_!.users.messages.attachments.get({
                  userId: 'me',
                  messageId: message.id!,
                  id: part.body.attachmentId
                });
                
                if (attachmentResponse.data.data) {
                  attachment.buffer = Buffer.from(attachmentResponse.data.data, 'base64');
                }
              } catch (error) {
                console.error(`Failed to fetch attachment ${part.filename}:`, error);
              }
            }
            normalized.attachments.push(attachment);
          }
        }
      } 
      // Single part message with body directly in payload
      else if (message.payload.body?.data) {
        const bodyContent = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
        if (message.payload.mimeType === 'text/html') {
          normalized.bodyHtml = bodyContent;
        } else {
          normalized.bodyText = bodyContent;
        }
      }
    }

    return normalized;
  }

  // =====================================================
  // SYNC CAPABILITIES - Gmail History API & Push Notifications
  // =====================================================

  /**
   * Get the current history ID for this Gmail account.
   * This serves as a starting point for tracking changes.
   */
  public async getCurrentHistoryId(): Promise<string> {
    this.ensureInitialized();
    await this.authenticate();

    try {
      // Get the profile to get the current history ID
      const profileResponse = await this.gmail_!.users.getProfile({
        userId: 'me'
      });

      return profileResponse.data.historyId!;
    } catch (error) {
      throw new Error(`Failed to get current history ID: ${(error as Error).message}`);
    }
  }

  /**
   * Get history records since the specified history ID.
   * This allows you to see what changed in the mailbox.
   */
  public async getHistory(startHistoryId: string, options: SyncOptions = {}): Promise<HistoryResponse> {
    this.ensureInitialized();
    await this.authenticate();

    const { maxResults = 100, labelIds, includeDeleted = true } = options;

    try {
      // Gmail API expects labelId as a single string, not an array
      // If multiple labels are provided, we'll need to make multiple calls or handle differently
      const labelId = labelIds && labelIds.length > 0 ? labelIds[0] : undefined;
      
      const historyResponse = await this.gmail_!.users.history.list({
        userId: 'me',
        startHistoryId,
        maxResults,
        labelId,
        historyTypes: includeDeleted ? ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'] : ['messageAdded', 'labelAdded', 'labelRemoved']
      });

      const history: HistoryRecord[] = (historyResponse.data.history || []).map((record: any) => ({
        id: record.id!,
        messages: record.messages,
        messagesAdded: record.messagesAdded,
        messagesDeleted: record.messagesDeleted,
        labelsAdded: record.labelsAdded,
        labelsRemoved: record.labelsRemoved
      }));

      return {
        history,
        nextPageToken: historyResponse.data.nextPageToken || undefined,
        historyId: historyResponse.data.historyId!
      };
    } catch (error) {
      // Handle case where start history ID is too old
      if ((error as any).code === 404 || (error as any).message?.includes('historyId')) {
        throw new Error(`History ID ${startHistoryId} is too old or invalid. Use getCurrentHistoryId() to get a fresh starting point.`);
      }
      throw new Error(`Failed to get history: ${(error as Error).message}`);
    }
  }

  /**
   * Get a specific email by its ID.
   * Useful for fetching full details of emails found in history records.
   */
  public async getEmailById(id: string): Promise<NormalizedEmail | null> {
    this.ensureInitialized();
    await this.authenticate();

    try {
      const messageResponse = await this.gmail_!.users.messages.get({
        userId: 'me',
        id,
        format: 'raw' // Use raw format for complete parsing
      });

      if (!messageResponse.data) {
        return null;
      }

      let normalized: NormalizedEmail;

      if (messageResponse.data.raw) {
        // Process using raw email format
        const rawEmail = Buffer.from(messageResponse.data.raw, 'base64').toString('utf-8');
        normalized = await this.emailParserService.parseEmail(rawEmail, messageResponse.data.id!, 'gmail');
        
        normalized.threadId = messageResponse.data.threadId || normalized.threadId;
        normalized.labels = messageResponse.data.labelIds || normalized.labels;
      } else {
        // Fallback to structured parsing
        normalized = await this.parseStructuredMessage(messageResponse.data, true, true);
      }

      return normalized;
    } catch (error) {
      if ((error as any).code === 404) {
        return null; // Email not found or no access
      }
      throw new Error(`Failed to get email by ID ${id}: ${(error as Error).message}`);
    }
  }

  /**
   * Set up Gmail push notifications to receive real-time updates.
   * Requires a Google Cloud Pub/Sub topic and proper webhook setup.
   */
  public async setupPushNotifications(config: PushNotificationConfig): Promise<PushNotificationSetup> {
    this.ensureInitialized();
    await this.authenticate();

    try {
      const watchRequest: gmail_v1.Params$Resource$Users$Watch = {
        userId: 'me',
        requestBody: {
          topicName: config.topicName,
          labelIds: config.labelIds,
          labelFilterAction: config.labelFilterAction || 'include'
        }
      };

      const watchResponse = await this.gmail_!.users.watch(watchRequest);

      return {
        historyId: watchResponse.data.historyId!,
        expiration: parseInt(watchResponse.data.expiration!),
        topicName: config.topicName
      };
    } catch (error) {
      throw new Error(`Failed to setup push notifications: ${(error as Error).message}`);
    }
  }

  /**
   * Stop Gmail push notifications.
   */
  public async stopPushNotifications(): Promise<void> {
    this.ensureInitialized();
    await this.authenticate();

    try {
      await this.gmail_!.users.stop({
        userId: 'me'
      });
    } catch (error) {
      throw new Error(`Failed to stop push notifications: ${(error as Error).message}`);
    }
  }

  /**
   * Process sync changes from a given history ID.
   * This is a higher-level method that processes history records and returns structured results.
   */
  public async processSync(options: SyncOptions = {}): Promise<SyncResult> {
    this.ensureInitialized();
    await this.authenticate();

    const { startHistoryId, maxResults = 100 } = options;

    if (!startHistoryId) {
      throw new Error('startHistoryId is required for processSync');
    }

    try {
      const historyResponse = await this.getHistory(startHistoryId, options);
      
      const addedEmails: NormalizedEmail[] = [];
      const deletedEmailIds: string[] = [];
      const updatedEmails: NormalizedEmail[] = [];
      const processedIds = new Set<string>();

      // Process history records
      for (const record of historyResponse.history) {
        // Handle new messages
        if (record.messagesAdded) {
          for (const added of record.messagesAdded) {
            if (!processedIds.has(added.message.id)) {
              const email = await this.getEmailById(added.message.id);
              if (email) {
                addedEmails.push(email);
                processedIds.add(added.message.id);
              }
            }
          }
        }

        // Handle deleted messages
        if (record.messagesDeleted) {
          for (const deleted of record.messagesDeleted) {
            if (!processedIds.has(deleted.message.id)) {
              deletedEmailIds.push(deleted.message.id);
              processedIds.add(deleted.message.id);
            }
          }
        }

        // Handle label changes (treat as updates)
        if (record.labelsAdded || record.labelsRemoved) {
          const labelChanges = [
            ...(record.labelsAdded || []),
            ...(record.labelsRemoved || [])
          ];

          for (const change of labelChanges) {
            if (!processedIds.has(change.message.id)) {
              const email = await this.getEmailById(change.message.id);
              if (email) {
                updatedEmails.push(email);
                processedIds.add(change.message.id);
              }
            }
          }
        }
      }

      return {
        processedHistoryRecords: historyResponse.history.length,
        addedEmails,
        deletedEmailIds,
        updatedEmails,
        newHistoryId: historyResponse.historyId,
        hasMoreChanges: !!historyResponse.nextPageToken,
        nextPageToken: historyResponse.nextPageToken
      };
    } catch (error) {
      throw new Error(`Failed to process sync: ${(error as Error).message}`);
    }
  }
}
