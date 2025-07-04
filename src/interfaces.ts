export interface Attachment {
  filename: string;
  mimeType: string; // Consistent with Gmail API, can map from mailparser's contentType
  size: number;
  buffer?: Buffer; // Optional, as we might just list attachments first
  contentId?: string; // For inline attachments
}

export interface NormalizedEmail {
  id: string; // Provider-specific ID
  threadId?: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments: Attachment[];
  date: Date; // Received date
  labels?: string[]; // Provider-specific labels (e.g., Gmail labels like 'INBOX', 'SENT', 'IMPORTANT', 'CATEGORY_PERSONAL', etc.)
  provider: 'gmail' | 'outlook' | 'imap' | 'unknown';
  raw?: any; // Optional: store the raw provider response
}

export interface FetchOptions {
  limit?: number;
  since?: Date | string; // Fetch emails since this date (inclusive)
  before?: Date | string; // Fetch emails before this date (inclusive)
  query?: string; // Provider-specific query string (e.g., Gmail search operators)
  includeBody?: boolean; // Default true
  includeAttachments?: boolean; // Default true, might just fetch metadata first
  attachmentDir?: string; // Optional: directory to save attachments instead of buffer
  unreadOnly?: boolean;
  format?: 'raw' | 'full' | 'metadata'; // Default 'raw' for backward compatibility
  pageToken?: string; // Token for fetching the next page of results
  pageSize?: number; // Number of results per page (defaults to limit if not specified)
  getAllPages?: boolean; // Whether to automatically fetch all pages (up to limit)
}

// Streaming-specific interfaces
export interface EmailStreamOptions extends Omit<FetchOptions, 'getAllPages' | 'pageSize' | 'limit'> {
  batchSize?: number; // Number of emails per batch (default: 50)
  maxEmails?: number; // Maximum total emails to process (optional)
}

export interface EmailStreamProgress {
  current: number; // Current number of emails processed
  total?: number; // Total number of emails (if available from provider)
  batchCount: number; // Number of batches processed
  estimatedRemaining?: number; // Estimated remaining emails
}

export interface EmailStreamCallbacks {
  onBatch?: (emails: NormalizedEmail[], progress: EmailStreamProgress) => Promise<void> | void;
  onProgress?: (progress: EmailStreamProgress) => Promise<void> | void;
  onError?: (error: Error, progress: EmailStreamProgress) => Promise<void> | void;
  onComplete?: (summary: EmailStreamSummary) => Promise<void> | void;
}

export interface EmailStreamSummary {
  totalProcessed: number;
  totalBatches: number;
  errors: number;
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
}

export interface EmailStreamBatch {
  emails: NormalizedEmail[];
  batchNumber: number;
  progress: EmailStreamProgress;
  isLastBatch: boolean;
}

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  authCode?: string; // New: Allow authentication with a code rather than a refresh token
  redirectUri?: string; // Required when using authCode
}

export interface OutlookCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  authCode?: string; // Allow authentication with a code rather than a refresh token
  redirectUri?: string; // Required when using authCode
  tenantId?: string; // Optional: Specific tenant for Azure AD authentication
  accessToken?: string; // Optional: Directly provide an access token for testing or specific flows
}

// For Phase 2
// export interface ImapCredentials { ... }

export type AdapterCredentials = GmailCredentials | OutlookCredentials; // | ImapCredentials;

/**
 * @deprecated Use TokenData from auth/interfaces.ts instead.
 */
export interface TokenData {
  accessToken: string;
  refreshToken?: string; // Not always returned on refresh
  expiryDate: number;
  tokenType?: string;
  idToken?: string;
}

// Gmail Sync/History API interfaces
export interface HistoryRecord {
  id: string; // History ID
  messages?: Array<{
    id: string;
    threadId: string;
  }>;
  messagesAdded?: Array<{
    message: {
      id: string;
      threadId: string;
      labelIds?: string[];
    };
  }>;
  messagesDeleted?: Array<{
    message: {
      id: string;
      threadId: string;
    };
  }>;
  labelsAdded?: Array<{
    message: {
      id: string;
      threadId: string;
    };
    labelIds: string[];
  }>;
  labelsRemoved?: Array<{
    message: {
      id: string;
      threadId: string;
    };
    labelIds: string[];
  }>;
}

export interface HistoryResponse {
  history: HistoryRecord[];
  nextPageToken?: string;
  historyId: string; // Current history ID
}

export interface PushNotificationConfig {
  topicName: string; // Google Cloud Pub/Sub topic name (e.g., "projects/myproject/topics/gmail-push")
  webhookUrl: string; // Your webhook endpoint URL
  labelIds?: string[]; // Optional: only watch specific labels
  labelFilterAction?: 'include' | 'exclude'; // How to apply label filter
}

export interface PushNotificationSetup {
  historyId: string; // Starting history ID
  expiration: number; // Unix timestamp when watch expires
  topicName: string;
}

export interface SyncState {
  historyId: string; // Last processed history ID
  lastSyncTime: Date; // When sync was last performed
  totalChanges: number; // Total changes processed
}

export interface SyncOptions {
  startHistoryId?: string; // Start from specific history ID
  maxResults?: number; // Max history records per request (default: 100)
  labelIds?: string[]; // Filter by specific labels
  includeDeleted?: boolean; // Include deleted messages (default: true)
}

export interface SyncResult {
  processedHistoryRecords: number;
  addedEmails: NormalizedEmail[];
  deletedEmailIds: string[];
  updatedEmails: NormalizedEmail[];
  newHistoryId: string;
  hasMoreChanges: boolean;
  nextPageToken?: string;
}

// Enhanced Pagination Interfaces
export interface PaginationMetadata {
  currentPage: number;
  pageSize: number;
  totalCount?: number;
  estimatedTotalPages?: number;
  nextPageToken?: string;
  previousPageToken?: string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFirstPage: boolean;
  isLastPage: boolean;
}

export interface PaginationOptions {
  pageSize?: number;
  pageToken?: string;
  limit?: number;
  getAllPages?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
  query?: string;
  totalFetched: number;
  fetchTime: Date;
}

export interface PaginationState {
  currentPageToken?: string;
  previousPageTokens: string[];
  currentPage: number;
  pageSize: number;
  totalFetched: number;
  query?: string;
  options: FetchOptions;
}
