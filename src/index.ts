// Export interfaces
export * from './interfaces.js';
export { PaginatedEmailsResponse } from './adapters/IAdapter.js';

// Export adapters
export { GmailAdapter } from './adapters/GmailAdapter.js';
export { OutlookAdapter } from './adapters/OutlookAdapter.js';
// export { ImapAdapter } from './adapters/ImapAdapter.js';     // Phase 2

// Export services if they are meant to be used directly, or internal utility classes
export { EmailParserService } from './services/EmailParserService.js'; // Might be internal

// Export OAuth functionality with renamed TokenData to avoid naming conflicts
export { 
  OAuthService,
  GoogleOAuthProvider,
  OutlookOAuthProvider,
  MemoryTokenStorage,
  IOAuthProvider,
  ITokenStorage,
  OAuthOptions,
  OAuthFlowState,
  OAuthCallbackHandler
} from './auth/index.js';
// Re-export TokenData from auth as OAuthTokenData to avoid naming conflict
export { TokenData as OAuthTokenData } from './auth/interfaces.js';

// Potentially a main unimail class in the future
// export { unimail } from './unimail.js';
