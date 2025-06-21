// Export interfaces
export * from './interfaces.js';
export { PaginatedEmailsResponse } from './adapters/IAdapter.js';

// Export adapters
export { GmailAdapter } from './adapters/GmailAdapter.js';
// export { OutlookAdapter } from './adapters/OutlookAdapter.js'; // Phase 2
// export { ImapAdapter } from './adapters/ImapAdapter.js';     // Phase 2

// Export services if they are meant to be used directly, or internal utility classes
export { EmailParserService } from './services/EmailParserService.js'; // Might be internal

// Potentially a main unimail class in the future
// export { unimail } from './unimail.js';
