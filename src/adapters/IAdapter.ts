import { NormalizedEmail, FetchOptions, AdapterCredentials } from '../interfaces.js';

export interface IAdapter {
  // credentials?: AdapterCredentials; // Credentials might be passed in constructor
  authenticate(): Promise<void>;
  fetchEmails(options: FetchOptions): Promise<NormalizedEmail[]>;
  // Future methods:
  // getEmailById(id: string): Promise<NormalizedEmail | null>;
  // deleteEmail(id: string): Promise<void>;
  // markAsRead(id: string): Promise<void>;
}
