// Export interfaces
export * from './interfaces';

// Export adapters
export { GmailAdapter } from './adapters/GmailAdapter';
// export { OutlookAdapter } from './adapters/OutlookAdapter'; // Phase 2
// export { ImapAdapter } from './adapters/ImapAdapter';     // Phase 2

// Export services if they are meant to be used directly, or internal utility classes
export { EmailParserService } from './services/EmailParserService'; // Might be internal

// Potentially a main InboxUnifier class in the future
// export { InboxUnifier } from './InboxUnifier';
