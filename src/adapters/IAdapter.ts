import { NormalizedEmail, FetchOptions, AdapterCredentials } from '../interfaces.js';

export interface PaginatedEmailsResponse {
  emails: NormalizedEmail[];
  nextPageToken?: string; // Token for fetching the next page of results
  totalCount?: number; // Total number of emails matching the query (if available)
}

export interface IAdapter {
  // credentials?: AdapterCredentials; // Credentials might be passed in constructor
  authenticate(): Promise<void>;
  fetchEmails(options: FetchOptions): Promise<PaginatedEmailsResponse>;
  // Future methods:
  // getEmailById(id: string): Promise<NormalizedEmail | null>;
  // deleteEmail(id: string): Promise<void>;
  // markAsRead(id: string): Promise<void>;
}
