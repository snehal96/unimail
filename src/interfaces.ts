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
