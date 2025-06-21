
import { Credentials } from 'google-auth-library';

/**
 * Represents token data structure with common OAuth properties
 */
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Timestamp when the token expires
  tokenType: string;
  scope?: string;
  idToken?: string;
}

/**
 * Provider-specific options for OAuth flow initialization
 */
export interface OAuthOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  // Additional provider-specific options can be added as needed
  forceConsent?: boolean;
  accessType?: 'online' | 'offline';
  prompt?: 'none' | 'consent' | 'select_account';
}

/**
 * Auth state returned after initializing OAuth flow
 */
export interface OAuthFlowState {
  authUrl: string; // URL to redirect user for authorization
  state?: string; // Optional state parameter for security
}

/**
 * Interface for OAuth provider implementations
 */
export interface IOAuthProvider {
  /**
   * Initialize the OAuth flow and generate authorization URL
   */
  initializeOAuthFlow(options: OAuthOptions): Promise<OAuthFlowState>;
  
  /**
   * Handle OAuth callback and exchange code for tokens
   */
  handleCallback(code: string, options: OAuthOptions): Promise<TokenData>;
  
  /**
   * Refresh access token using a refresh token
   */
  refreshToken(refreshToken: string, options: OAuthOptions): Promise<TokenData>;
  
  /**
   * Revoke a token
   */
  revokeToken(token: string, options: OAuthOptions): Promise<boolean>;
}

/**
 * Interface for token storage implementations
 * Implementors can use any storage strategy (file system, database, etc.)
 */
export interface ITokenStorage {
  /**
   * Save tokens for a user
   */
  saveTokens(userId: string, tokens: TokenData): Promise<void>;
  
  /**
   * Retrieve tokens for a user
   */
  getTokens(userId: string): Promise<TokenData | null>;
  
  /**
   * Update tokens for a user
   */
  updateTokens(userId: string, tokens: TokenData): Promise<void>;
  
  /**
   * Delete tokens for a user
   */
  deleteTokens(userId: string): Promise<boolean>;
}

/**
 * Callback function type for OAuth flow completion
 */
export type OAuthCallbackHandler = (tokenData: TokenData | null, error?: Error) => void;
