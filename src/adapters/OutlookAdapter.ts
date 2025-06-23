import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { IAdapter, PaginatedEmailsResponse } from './IAdapter';
import { NormalizedEmail, FetchOptions, OutlookCredentials, Attachment } from '../interfaces.js';
import { EmailParserService } from '../services/EmailParserService';
import { OAuthService } from '../auth/OAuthService';
import { OutlookOAuthProvider } from '../auth/providers/OutlookOAuthProvider';

// Type definition for graph messages
interface OutlookMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: {
    contentType?: string;
    content?: string;
  };
  from?: {
    emailAddress: {
      name?: string;
      address: string;
    }
  };
  toRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    }
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    }
  }>;
  bccRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    }
  }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
  internetMessageId?: string;
  importance?: string;
  categories?: string[];
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
    isInline: boolean;
    contentId?: string;
    contentBytes?: string;
  }>;
}

export class OutlookAdapter implements IAdapter {
  private graphClient_?: Client;
  private credentials_?: OutlookCredentials;
  private emailParserService: EmailParserService;
  private initialized: boolean = false;
  private oauthService?: OAuthService;
  private msalApp_?: ConfidentialClientApplication;
  private accessToken_?: string;

  constructor() {
    this.emailParserService = new EmailParserService();
  }

  /**
   * Initialize the Outlook adapter with credentials.
   * This method supports both traditional refresh token authentication
   * and the new OAuth flow using an auth code.
   */
  public async initialize(credentials: OutlookCredentials): Promise<void> {
    this.credentials_ = credentials;
    
    // Create MSAL app
    this.msalApp_ = new ConfidentialClientApplication({
      auth: {
        clientId: this.credentials_.clientId,
        clientSecret: this.credentials_.clientSecret,
        // Use tenant ID if provided, otherwise use common endpoint
        authority: `https://login.microsoftonline.com/${this.credentials_.tenantId || 'common'}`
      }
    });
    
    // Handle OAuth flow if auth code is provided instead of refresh token
    if (!this.credentials_.refreshToken && this.credentials_.authCode) {
      if (!this.credentials_.redirectUri) {
        throw new Error('redirectUri is required when using authCode for authentication');
      }
      
      try {
        // Exchange the auth code for tokens
        const tokenRequest = {
          code: this.credentials_.authCode,
          scopes: ['https://graph.microsoft.com/Mail.Read', 'offline_access'],
          redirectUri: this.credentials_.redirectUri,
        };
        
        const response = await this.msalApp_.acquireTokenByCode(tokenRequest);
        
        // Save the refresh token
        // MSAL doesn't directly expose refreshToken in its types but it may be in the response
        if ((response as any).refreshToken) {
          this.credentials_.refreshToken = (response as any).refreshToken;
        } else {
          throw new Error('No refresh token received. Make sure you are requesting offline access.');
        }
        
        // Save the access token for immediate use
        this.accessToken_ = response.accessToken!;
      } catch (error) {
        throw new Error(`Failed to exchange auth code for tokens: ${(error as Error).message}`);
      }
    } else if (!this.credentials_.refreshToken) {
      throw new Error('Either refreshToken or authCode must be provided in the credentials');
    }
    
    // Initialize the graph client
    await this.authenticate();
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
    tenantId?: string,
    port: number = 3000,
    callbackPath: string = '/oauth/callback'
  ): Promise<string> {
    const oauthService = new OAuthService(new OutlookOAuthProvider());
    
    const authUrl = await oauthService.startOAuthFlow(
      {
        clientId,
        clientSecret,
        redirectUri,
        scopes: ['https://graph.microsoft.com/Mail.Read', 'offline_access', 'openid', 'profile', 'User.Read'],
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
    redirectUri: string,
    tenantId?: string
  ): Promise<{ accessToken: string, refreshToken?: string }> {
    const oauthService = new OAuthService(new OutlookOAuthProvider());
    
    const options = {
      clientId,
      clientSecret,
      redirectUri,
      scopes: ['https://graph.microsoft.com/Mail.Read', 'offline_access', 'openid', 'profile', 'User.Read'],
      tenantId
    };
    
    const tokenData = await oauthService.handleCallback(
      code,
      options
    );
    
    return {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.graphClient_ || !this.credentials_) {
      throw new Error('OutlookAdapter not initialized. Call initialize(credentials) first.');
    }
  }

  public async authenticate(): Promise<void> {
    if (!this.credentials_ || !this.msalApp_) {
      throw new Error('OutlookAdapter credentials not set. Call initialize(credentials) first.');
    }

    try {
      // If we already have a valid access token from the auth code flow, use it
      if (this.accessToken_) {
        // Create the graph client with the existing token
        this.graphClient_ = Client.init({
          authProvider: (done) => {
            done(null, this.accessToken_!);
          },
        });
        return;
      }
      
      // Otherwise, use refresh token to get a new access token
      if (!this.credentials_.refreshToken) {
        throw new Error('No refresh token available for authentication');
      }
      
      const tokenRequest = {
        refreshToken: this.credentials_.refreshToken,
        scopes: ['https://graph.microsoft.com/Mail.Read', 'offline_access'],
      };
      
      const response = await this.msalApp_.acquireTokenByRefreshToken(tokenRequest);
      
      if (!response || !response.accessToken) {
        throw new Error('Failed to acquire access token');
      }
      
      // Save the access token
      this.accessToken_ = response.accessToken!;
      
      // Create the graph client with the new token
      this.graphClient_ = Client.init({
        authProvider: (done) => {
          done(null, this.accessToken_!);
        },
      });
    } catch (error) {
      console.error('Outlook authentication error:', error);
      
      // Provide more specific error messages
      if ((error as any)?.message?.includes('interaction_required')) {
        throw new Error('Outlook authentication failed: Interactive login is required. The refresh token may be expired.');
      }
      throw new Error(`Outlook authentication failed: ${(error as Error).message}`);
    }
  }

  public async fetchEmails(options: FetchOptions): Promise<PaginatedEmailsResponse> {
    this.ensureInitialized();
    await this.authenticate();

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

    // Build Outlook-specific filter
    let filter = '';
    
    if (since) {
      const sinceDate = typeof since === 'string' ? new Date(since) : since;
      filter += filter ? ' and ' : '';
      filter += `receivedDateTime ge ${sinceDate.toISOString()}`;
    }
    
    if (before) {
      const beforeDate = typeof before === 'string' ? new Date(before) : before;
      filter += filter ? ' and ' : '';
      filter += `receivedDateTime le ${beforeDate.toISOString()}`;
    }
    
    if (unreadOnly) {
      filter += filter ? ' and ' : '';
      filter += 'isRead eq false';
    }
    
    // Search term (query) is handled differently in Outlook than filter
    // But we can combine certain search capabilities
    const searchTerm = query || undefined;
    
    try {
      if (getAllPages) {
        return await this.fetchAllEmailPages(filter, searchTerm, limit, includeBody, includeAttachments);
      } else {
        return await this.fetchEmailPage(
          filter, 
          searchTerm,
          pageSize || limit, 
          includeBody, 
          includeAttachments, 
          pageToken
        );
      }
    } catch (error) {
      console.error('Error fetching Outlook emails:', error);
      throw new Error(`Failed to fetch Outlook emails: ${error}`);
    }
  }

  /**
   * Fetches a single page of emails
   */
  private async fetchEmailPage(
    filter: string,
    searchTerm: string | undefined,
    maxResults: number,
    includeBody: boolean,
    includeAttachments: boolean,
    skipToken?: string
  ): Promise<PaginatedEmailsResponse> {
    // Build the initial request
    let messagesRequest = this.graphClient_!.api('/me/messages')
      .top(maxResults);
      
    // Add filter if specified
    if (filter) {
      messagesRequest = messagesRequest.filter(filter);
    }
    
    // Add search capability if a query was provided
    if (searchTerm) {
      messagesRequest = messagesRequest.search(searchTerm);
    }
    
    // Add skip token for pagination if provided
    if (skipToken) {
      messagesRequest = messagesRequest.skipToken(skipToken);
    }
    
    // Select fields based on what we need
    let select = ['id', 'conversationId', 'subject', 'from', 'toRecipients', 
                  'ccRecipients', 'bccRecipients', 'receivedDateTime', 
                  'hasAttachments', 'internetMessageId', 'importance', 'categories'];
    
    if (includeBody) {
      select.push('body');
    } else {
      select.push('bodyPreview'); // Just get the preview if we don't need full body
    }
    
    messagesRequest = messagesRequest.select(select.join(','));
    
    // Execute the request
    const response = await messagesRequest.get();
    
    // Check if we have messages
    if (!response.value || response.value.length === 0) {
      return { 
        emails: [], 
        nextPageToken: response['@odata.nextLink'] ? 
          this.extractSkipTokenFromNextLink(response['@odata.nextLink']) : 
          undefined,
        totalCount: undefined // Outlook API doesn't provide a count
      };
    }
    
    // Process each message
    const normalizedEmails: NormalizedEmail[] = [];
    for (const message of response.value as OutlookMessage[]) {
      let normalized = this.mapOutlookMessageToNormalized(message);
      
      // Fetch attachments if message has any and we are requested to include them
      if (includeAttachments && message.hasAttachments) {
        const attachments = await this.fetchAttachments(message.id);
        normalized.attachments = attachments;
      }
      
      normalizedEmails.push(normalized);
    }
    
    return { 
      emails: normalizedEmails, 
      nextPageToken: response['@odata.nextLink'] ? 
        this.extractSkipTokenFromNextLink(response['@odata.nextLink']) : 
        undefined
    };
  }

  /**
   * Fetches all pages of emails up to the specified limit
   */
  private async fetchAllEmailPages(
    filter: string,
    searchTerm: string | undefined,
    limit: number,
    includeBody: boolean,
    includeAttachments: boolean
  ): Promise<PaginatedEmailsResponse> {
    const allEmails: NormalizedEmail[] = [];
    let nextPageToken: string | undefined;
    
    // Use a reasonable page size (50 is typical for Outlook API)
    const pageSize = Math.min(limit, 50);
    
    do {
      const response = await this.fetchEmailPage(
        filter, 
        searchTerm, 
        pageSize, 
        includeBody, 
        includeAttachments, 
        nextPageToken
      );
      
      allEmails.push(...response.emails);
      nextPageToken = response.nextPageToken;
      
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
      // Outlook API doesn't provide a total count
    };
  }
  
  /**
   * Fetches attachments for a message
   */
  private async fetchAttachments(messageId: string): Promise<Attachment[]> {
    try {
      const attachmentsResponse = await this.graphClient_!.api(`/me/messages/${messageId}/attachments`)
        .select('id,name,contentType,size,isInline,contentId,contentBytes')
        .get();
      
      if (!attachmentsResponse.value || attachmentsResponse.value.length === 0) {
        return [];
      }
      
      return attachmentsResponse.value.map((att: any) => {
        const attachment: Attachment = {
          filename: att.name,
          mimeType: att.contentType,
          size: att.size,
          contentId: att.contentId,
        };
        
        // Convert Base64 content to Buffer if available
        if (att.contentBytes) {
          attachment.buffer = Buffer.from(att.contentBytes, 'base64');
        }
        
        return attachment;
      });
    } catch (error) {
      console.error(`Error fetching attachments for message ${messageId}:`, error);
      return [];
    }
  }
  
  /**
   * Maps an Outlook message to our normalized email format
   */
  private mapOutlookMessageToNormalized(message: OutlookMessage): NormalizedEmail {
    return {
      id: message.id,
      threadId: message.conversationId,
      from: message.from ? message.from.emailAddress.address : '',
      to: (message.toRecipients || []).map(r => r.emailAddress.address),
      cc: message.ccRecipients ? message.ccRecipients.map(r => r.emailAddress.address) : undefined,
      bcc: message.bccRecipients ? message.bccRecipients.map(r => r.emailAddress.address) : undefined,
      subject: message.subject,
      bodyText: message.bodyPreview,
      bodyHtml: message.body?.contentType === 'html' ? message.body.content : undefined,
      attachments: [], // Will be filled separately if needed
      date: new Date(message.receivedDateTime || message.sentDateTime || Date.now()),
      // Map categories to labels for consistency with Gmail implementation
      labels: message.categories || [],
      provider: 'outlook',
      raw: message
    };
  }
  
  /**
   * Extracts the skip token from Outlook's nextLink URL
   */
  private extractSkipTokenFromNextLink(nextLink: string): string | undefined {
    const match = nextLink.match(/\$skiptoken=([^&]+)/);
    return match ? match[1] : undefined;
  }
}
