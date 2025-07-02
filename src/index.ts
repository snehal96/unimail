// Export interfaces
export * from './interfaces.ts';
export type { PaginatedEmailsResponse } from './adapters/IAdapter.ts';

// Export adapters
export { GmailAdapter } from './adapters/GmailAdapter.ts';
export { OutlookAdapter } from './adapters/OutlookAdapter.ts';
export { ImapAdapter } from './adapters/ImapAdapter.ts';

// Export services if they are meant to be used directly, or internal utility classes
export { EmailParserService } from './services/EmailParserService.ts'; // Might be internal
export { EmailStreamService } from './services/EmailStreamService.ts'; // New streaming service

// Export OAuth functionality with renamed TokenData to avoid naming conflicts
export {
  OAuthService,
  GoogleOAuthProvider,
  OutlookOAuthProvider,
  MemoryTokenStorage
} from './auth/index.js';
export type {
  IOAuthProvider,
  ITokenStorage,
  OAuthOptions,
  OAuthFlowState,
  OAuthCallbackHandler
} from './auth/index.js';
// Re-export TokenData from auth as OAuthTokenData to avoid naming conflict
export type { TokenData as OAuthTokenData } from './auth/interfaces.js';

// Potentially a main unimail class in the future
// export { unimail } from './unimail.js';
