import { NormalizedEmail, FetchOptions, AdapterCredentials, EmailStreamOptions, EmailStreamCallbacks, HistoryResponse, PushNotificationConfig, PushNotificationSetup, SyncOptions, SyncResult, PaginatedResponse } from '../interfaces.js';

export interface PaginatedEmailsResponse {
  emails: NormalizedEmail[];
  nextPageToken?: string; // Token for fetching the next page of results
  totalCount?: number; // Total number of emails matching the query (if available)
}

export interface IAdapter {
  // credentials?: AdapterCredentials; // Credentials might be passed in constructor
  authenticate(): Promise<void>;
  
  // Existing pagination-based method (backward compatibility)
  fetchEmails(options: FetchOptions): Promise<PaginatedEmailsResponse>;
  
  // New enhanced pagination methods
  fetchEmailsWithPagination?(options: FetchOptions): Promise<PaginatedResponse<NormalizedEmail>>;
  
  // New streaming methods
  streamEmails(options: EmailStreamOptions): AsyncGenerator<NormalizedEmail[], void, unknown>;
  fetchEmailsStream(options: EmailStreamOptions, callbacks: EmailStreamCallbacks): Promise<void>;
  
  // Sync capabilities (optional - not all adapters may support this)
  getCurrentHistoryId?(): Promise<string>;
  getHistory?(startHistoryId: string, options?: SyncOptions): Promise<HistoryResponse>;
  getEmailById?(id: string): Promise<NormalizedEmail | null>;
  setupPushNotifications?(config: PushNotificationConfig): Promise<PushNotificationSetup>;
  stopPushNotifications?(): Promise<void>;
  processSync?(options?: SyncOptions): Promise<SyncResult>;
  
  // Future methods:
  // deleteEmail(id: string): Promise<void>;
  // markAsRead(id: string): Promise<void>;
}
