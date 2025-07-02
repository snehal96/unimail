import { NormalizedEmail, FetchOptions, AdapterCredentials, EmailStreamOptions, EmailStreamCallbacks } from '../interfaces.js';

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
  
  // New streaming methods
  streamEmails(options: EmailStreamOptions): AsyncGenerator<NormalizedEmail[], void, unknown>;
  fetchEmailsStream(options: EmailStreamOptions, callbacks: EmailStreamCallbacks): Promise<void>;
  
  // Future methods:
  // getEmailById(id: string): Promise<NormalizedEmail | null>;
  // deleteEmail(id: string): Promise<void>;
  // markAsRead(id: string): Promise<void>;
}
