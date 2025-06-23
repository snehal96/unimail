import { ConfidentialClientApplication } from '@azure/msal-node';
import { IOAuthProvider, OAuthOptions, OAuthFlowState, TokenData } from '../interfaces';

// Add extended interface for Microsoft authentication response type
interface MsalAuthResponse {
  accessToken: string;
  refreshToken?: string; // MSAL doesn't expose this in its types but it's in the response
  expiresOn?: Date;
  extExpiresOn?: Date;
  idToken?: string;
  tokenType?: string;
  scopes?: string[];
  account?: any;
}

/**
 * Microsoft-specific OAuth implementation for Outlook/Microsoft 365
 */
export class OutlookOAuthProvider implements IOAuthProvider {
  /**
   * Initialize the Microsoft OAuth flow and generate an authorization URL
   */
  public async initializeOAuthFlow(options: OAuthOptions): Promise<OAuthFlowState> {
    const msalApp = this.createMsalApp(options);
    
    // Generate a unique state value for security
    const state = (options as any).state || Math.random().toString(36).substring(2);
    
    // List of Microsoft Graph API permission scopes for mail access
    const scopes = options.scopes || [
      'https://graph.microsoft.com/Mail.Read',
      'offline_access', // Required for refresh tokens
      'openid',
      'profile',
      'User.Read'
    ];
    
    // Create authorization URL
    const authCodeUrlParameters = {
      scopes,
      redirectUri: options.redirectUri,
      prompt: options.prompt || 'consent',
      state
    };

    try {
      const authUrl = await msalApp.getAuthCodeUrl(authCodeUrlParameters);
      return { authUrl, state };
    } catch (error) {
      throw new Error(`Failed to initialize OAuth flow: ${(error as Error).message}`);
    }
  }

  /**
   * Handle the OAuth callback and exchange the code for tokens
   */
  public async handleCallback(code: string, options: OAuthOptions): Promise<TokenData> {
    const msalApp = this.createMsalApp(options);

    try {
      const tokenRequest = {
        code,
        scopes: options.scopes,
        redirectUri: options.redirectUri,
      };

      const response = await msalApp.acquireTokenByCode(tokenRequest);
      
      if (!response || !response.accessToken) {
        throw new Error('No access token returned from Microsoft OAuth flow');
      }

      // Cast to our interface to handle types properly
      const authResponse = response as unknown as MsalAuthResponse;
      
      // Calculate expiry time
      const expiresAt = authResponse.expiresOn 
        ? authResponse.expiresOn.getTime() 
        : (Date.now() + 3600 * 1000);

      return {
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken || '',
        expiresAt,
        tokenType: authResponse.tokenType || 'Bearer',
        scope: authResponse.scopes?.join(' '),
        idToken: authResponse.idToken || '',
      };
    } catch (error) {
      throw new Error(`Failed to exchange authorization code: ${(error as Error).message}`);
    }
  }

  /**
   * Refresh an access token using a refresh token
   */
  public async refreshToken(refreshToken: string, options: OAuthOptions): Promise<TokenData> {
    const msalApp = this.createMsalApp(options);
    
    try {
      const tokenRequest = {
        refreshToken,
        scopes: options.scopes,
      };

      const response = await msalApp.acquireTokenByRefreshToken(tokenRequest);
      
      if (!response || !response.accessToken) {
        throw new Error('No access token returned when refreshing token');
      }
      
      // Cast to our interface to handle types properly
      const authResponse = response as unknown as MsalAuthResponse;

      // Calculate expiry time
      const expiresAt = authResponse.expiresOn 
        ? authResponse.expiresOn.getTime() 
        : (Date.now() + 3600 * 1000);

      return {
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken || refreshToken, // Keep existing refresh token if new one not provided
        expiresAt,
        tokenType: authResponse.tokenType || 'Bearer',
        scope: authResponse.scopes?.join(' '),
        idToken: authResponse.idToken || '',
      };
    } catch (error) {
      throw new Error(`Failed to refresh token: ${(error as Error).message}`);
    }
  }

  /**
   * Revoke a token
   * Note: Microsoft identity platform doesn't have a specific token revocation endpoint like Google
   * Best practice is to clear the token from storage and implement a short token lifetime
   */
  public async revokeToken(token: string, options: OAuthOptions): Promise<boolean> {
    // Microsoft Graph doesn't provide an API to revoke tokens directly
    // The token must be removed from storage and will expire based on its lifetime
    
    // If a real revocation is needed, you could implement additional logic to:
    // 1. Force the user to re-authenticate next time
    // 2. Remove refresh tokens from your storage
    // 3. Consider integration with Azure AD API to revoke tokens for your application
    
    console.warn('Token revocation for Microsoft OAuth is not fully supported');
    return true; // Return success as we've done what we can
  }

  /**
   * Create a MSAL ConfidentialClientApplication with the provided options
   * @private
   */
  private createMsalApp(options: OAuthOptions): ConfidentialClientApplication {
    const msalConfig = {
      auth: {
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        // Add tenant ID if available, otherwise use common endpoint for multi-tenant apps
        authority: `https://login.microsoftonline.com/${(options as any).tenantId || 'common'}`
      }
    };

    return new ConfidentialClientApplication(msalConfig);
  }
}
