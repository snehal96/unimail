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
  labels?: string[]; // e.g., Gmail labels
  provider: 'gmail' | 'outlook' | 'imap' | 'unknown';
  raw?: any; // Optional: store the raw provider response
}

export interface FetchOptions {
  limit?: number;
  since?: Date | string; // Fetch emails since this date
  query?: string; // Provider-specific query string (e.g., Gmail search operators)
  includeBody?: boolean; // Default true
  includeAttachments?: boolean; // Default true, might just fetch metadata first
  attachmentDir?: string; // Optional: directory to save attachments instead of buffer
  unreadOnly?: boolean;
  format?: 'raw' | 'full' | 'metadata'; // Default 'raw' for backward compatibility
}

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string | undefined;
}

// For Phase 2
// export interface OutlookCredentials { ... }
// export interface ImapCredentials { ... }

export type AdapterCredentials = GmailCredentials; // | OutlookCredentials | ImapCredentials;

export interface TokenData {
  accessToken: string;
  refreshToken?: string; // Not always returned on refresh
  expiryDate: number;
  tokenType?: string;
  idToken?: string;
}
