import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { IAdapter, PaginatedEmailsResponse } from './IAdapter.js';
import { NormalizedEmail, FetchOptions, OutlookCredentials, Attachment, EmailStreamOptions, EmailStreamCallbacks, EmailStreamProgress } from '../interfaces.js';
import { EmailParserService } from '../services/EmailParserService.js';
import { OAuthService } from '../auth/OAuthService.js';
import { OutlookOAuthProvider } from '../auth/providers/OutlookOAuthProvider.js';
import { EmailStreamService } from '../services/EmailStreamService.js';

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

    if (credentials.accessToken) {
      // If access token is provided, use it directly
      this.accessToken_ = credentials.accessToken;
    } else {
    
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
            scopes: ['Mail.Read', 'offline_access'],
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
    callbackPath: string = '/oauth/oauth2callback'
  ): Promise<string> {
    const oauthService = new OAuthService(new OutlookOAuthProvider());
    
    const authUrl = await oauthService.startOAuthFlow(
      {
        clientId,
        clientSecret,
        redirectUri,
        scopes: ['Mail.Read', 'offline_access', 'openid', 'profile', 'User.Read'],
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
      scopes: ['Mail.Read', 'offline_access', 'openid', 'profile', 'User.Read'],
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
    if (!this.credentials_ && !this.msalApp_) {
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
      if (!this.credentials_?.refreshToken) {
        throw new Error('No refresh token available for authentication');
      }
      
      const tokenRequest = {
        refreshToken: this.credentials_?.refreshToken,
        scopes: ['https://graph.microsoft.com/Mail.Read', 'offline_access'],
      };
      
      const response = await this.msalApp_?.acquireTokenByRefreshToken(tokenRequest);
      
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

    // Determine the best format strategy based on options
    let fetchStrategy: 'full' | 'minimal' | 'metadata' = 'full';
    
    // If format isn't explicitly specified, infer it based on what the user needs
    if (!format) {
      if (!includeBody && !includeAttachments) {
        fetchStrategy = 'metadata'; // Just need headers
      } else if (!includeBody || !includeAttachments) {
        fetchStrategy = 'minimal'; // Need some content but not everything
      } else {
        fetchStrategy = 'full'; // Need everything
      }
    } else {
      // Map Gmail-style format options to Outlook strategies
      switch (format) {
        case 'metadata':
          fetchStrategy = 'metadata';
          break;
        case 'full':
          fetchStrategy = 'minimal';
          break;
        case 'raw':
        default:
          fetchStrategy = 'full';
          break;
      }
    }

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
    const searchTerm = query || undefined;
    
    try {
      if (getAllPages) {
        // Show deprecation warning to match Gmail behavior
        console.warn('Warning: getAllPages option is deprecated and may cause memory issues with large datasets. Consider using streamEmails() instead.');
        
        return await this.fetchAllEmailPages(
          filter, 
          searchTerm, 
          limit, 
          fetchStrategy,
          includeBody, 
          includeAttachments
        );
      } else {
        return await this.fetchEmailPage(
          filter, 
          searchTerm,
          pageSize || limit, 
          fetchStrategy,
          includeBody, 
          includeAttachments, 
          pageToken
        );
      }
    } catch (error) {
      console.error('Error fetching Outlook emails:', error);
      
      // Check for specific Microsoft Graph API errors
      if ((error as any).code === '401' || (error as any).status === 401) {
        throw new Error(`Outlook authentication error (401). Check your refresh token and API permissions. Original: ${(error as Error).message}`);
      }
      if ((error as any).code === 'InvalidAuthenticationToken' || (error as any).message?.includes('InvalidAuthenticationToken')) {
        throw new Error(`Outlook authentication token is invalid or expired. Please re-authenticate. Original: ${(error as Error).message}`);
      }
      if ((error as any).code === 'Forbidden' || (error as any).status === 403) {
        throw new Error(`Outlook API access forbidden. Check your application permissions for Mail.Read. Original: ${(error as Error).message}`);
      }
      
      throw new Error(`Failed to fetch Outlook emails: ${(error as Error).message}`);
    }
  }

  /**
   * Fetches a single page of emails with enhanced format support
   */
  private async fetchEmailPage(
    filter: string,
    searchTerm: string | undefined,
    maxResults: number,
    fetchStrategy: 'full' | 'minimal' | 'metadata',
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
    
    // Select fields based on fetch strategy and requirements
    let select = this.buildSelectFields(fetchStrategy, includeBody, includeAttachments);
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
      
      // Apply fetch strategy modifications
      if (fetchStrategy === 'metadata' && !includeBody) {
        // Remove body content for metadata-only requests
        normalized.bodyText = undefined;
        normalized.bodyHtml = undefined;
      }
      
      // Fetch attachments if message has any and we are requested to include them
      if (includeAttachments && message.hasAttachments && fetchStrategy !== 'metadata') {
        const attachments = await this.fetchAttachments(message.id);
        normalized.attachments = attachments;
      } else if (!includeAttachments || fetchStrategy === 'metadata') {
        // Clear attachments but keep count if we have it
        normalized.attachments = [];
      }
      
      normalizedEmails.push(normalized);
    }
    
    return { 
      emails: normalizedEmails, 
      nextPageToken: response['@odata.nextLink'] ? 
        this.extractSkipTokenFromNextLink(response['@odata.nextLink']) : 
        undefined,
      totalCount: undefined // Microsoft Graph API doesn't provide total count
    };
  }

  /**
   * Fetches all pages of emails up to the specified limit with enhanced format support
   */
  private async fetchAllEmailPages(
    filter: string,
    searchTerm: string | undefined,
    limit: number,
    fetchStrategy: 'full' | 'minimal' | 'metadata',
    includeBody: boolean,
    includeAttachments: boolean,
    requestPageSize?: number
  ): Promise<PaginatedEmailsResponse> {
    const allEmails: NormalizedEmail[] = [];
    let nextPageToken: string | undefined;
    
    // Use a reasonable page size (50 is optimal for Outlook API)
    const pageSize = requestPageSize || Math.min(limit, 50);
    
    do {
      const response = await this.fetchEmailPage(
        filter, 
        searchTerm, 
        pageSize, 
        fetchStrategy,
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
      totalCount: undefined // Outlook API doesn't provide a count
    };
  }

  /**
   * Helper method to build field selection based on fetch strategy
   */
  private buildSelectFields(fetchStrategy: 'full' | 'minimal' | 'metadata', includeBody: boolean, includeAttachments: boolean): string[] {
    // Base fields always needed
    let select = ['id', 'conversationId', 'subject', 'from', 'toRecipients', 
                  'ccRecipients', 'bccRecipients', 'receivedDateTime', 
                  'internetMessageId', 'importance', 'categories'];
    
    // Add attachment info if needed
    if (includeAttachments && fetchStrategy !== 'metadata') {
      select.push('hasAttachments');
    }
    
    // Add body fields based on strategy and requirements
    switch (fetchStrategy) {
      case 'full':
        if (includeBody) {
          select.push('body');
        } else {
          select.push('bodyPreview');
        }
        break;
      case 'minimal':
        if (includeBody) {
          select.push('body');
        } else {
          select.push('bodyPreview');
        }
        break;
      case 'metadata':
        // Only include preview for metadata-only requests
        select.push('bodyPreview');
        break;
    }
    
    return select;
  }

  /**
   * Helper method to determine fetch strategy from options (similar to Gmail's format detection)
   */
  private determineOutlookFetchStrategy(options: EmailStreamOptions): 'full' | 'minimal' | 'metadata' {
    if (options.format) {
      switch (options.format) {
        case 'metadata':
          return 'metadata';
        case 'full':
          return 'minimal';
        case 'raw':
        default:
          return 'full';
      }
    }
    
    const includeBody = options.includeBody !== false;
    const includeAttachments = options.includeAttachments !== false;
    
    if (!includeBody && !includeAttachments) {
      return 'metadata';
    } else if (!includeBody || !includeAttachments) {
      return 'minimal';
    } else {
      return 'full';
    }
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

  /**
   * Stream emails using async generator
   * This method provides memory-efficient streaming of emails
   */
  public async *streamEmails(options: EmailStreamOptions): AsyncGenerator<NormalizedEmail[], void, unknown> {
    this.ensureInitialized();
    await this.authenticate();
    
    // Validate options
    EmailStreamService.validateStreamOptions(options);
    
    // Build Outlook filter and search term from options
    const { filter, searchTerm } = this.buildOutlookQueryFromStreamOptions(options);
    
    // Determine fetch strategy
    const fetchStrategy = this.determineOutlookFetchStrategy(options);
    
    // Create the fetch function for the stream service
    const fetchPageFn = async (pageToken?: string, pageSize?: number) => {
      return await this.fetchEmailPage(
        filter,
        searchTerm,
        pageSize || options.batchSize || 50,
        fetchStrategy,
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
    
    const enhancedCallbacks: EmailStreamCallbacks = {
      ...callbacks,
      onBatch: async (emails, progress) => {
        // Enhance progress with Outlook-specific information
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
      // Try to get total count - this is a best effort for Outlook
      // Note: Microsoft Graph API doesn't provide exact counts easily
      // We'll skip this optimization for now
      
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
   * Helper method to build Outlook query from stream options
   */
  private buildOutlookQueryFromStreamOptions(options: EmailStreamOptions): { filter: string; searchTerm?: string } {
    const filters: string[] = [];
    
    // Date filters
    if (options.since) {
      const sinceDate = typeof options.since === 'string' ? new Date(options.since) : options.since;
      filters.push(`receivedDateTime ge ${sinceDate.toISOString()}`);
    }
    if (options.before) {
      const beforeDate = typeof options.before === 'string' ? new Date(options.before) : options.before;
      filters.push(`receivedDateTime le ${beforeDate.toISOString()}`);
    }
    
    // Unread filter
    if (options.unreadOnly) {
      filters.push('isRead eq false');
    }
    
    const filter = filters.length > 0 ? filters.join(' and ') : '';
    
    // Search term (for content search)
    const searchTerm = options.query || undefined;
    
    return { filter, searchTerm };
  }
}
