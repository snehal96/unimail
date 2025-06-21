
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { IOAuthProvider, OAuthOptions, OAuthFlowState, TokenData } from '../interfaces';

/**
 * Google-specific OAuth implementation
 */
export class GoogleOAuthProvider implements IOAuthProvider {
  /**
   * Initialize the Google OAuth flow and generate an authorization URL
   */
  public async initializeOAuthFlow(options: OAuthOptions): Promise<OAuthFlowState> {
    const oauth2Client = this.createOAuth2Client(options);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: options.accessType || 'offline',
      scope: options.scopes,
      prompt: options.prompt || 'consent', // Always request consent to ensure we get a refresh token
    });

    return {
      authUrl,
      // Could add a state parameter for security if needed
    };
  }

  /**
   * Handle the OAuth callback and exchange the code for tokens
   */
  public async handleCallback(code: string, options: OAuthOptions): Promise<TokenData> {
    const oauth2Client = this.createOAuth2Client(options);

    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('No access token returned from Google OAuth flow');
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? tokens.expiry_date : Date.now() + 3600 * 1000, // Default to 1 hour if no expiry
        tokenType: tokens.token_type || 'Bearer',
        scope: tokens.scope,
        idToken: tokens.id_token || '',
      };
    } catch (error) {
      throw new Error(`Failed to exchange authorization code: ${(error as Error).message}`);
    }
  }

  /**
   * Refresh an access token using a refresh token
   */
  public async refreshToken(refreshToken: string, options: OAuthOptions): Promise<TokenData> {
    const oauth2Client = this.createOAuth2Client(options);
    
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('No access token returned when refreshing token');
      }

      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken, // Keep existing refresh token if new one not provided
        expiresAt: credentials.expiry_date || (Date.now() + 3600 * 1000),
        tokenType: credentials.token_type || 'Bearer',
        scope: credentials.scope,
        idToken: credentials.id_token || '',
      };
    } catch (error) {
      throw new Error(`Failed to refresh token: ${(error as Error).message}`);
    }
  }

  /**
   * Revoke a token (can be either an access token or a refresh token)
   */
  public async revokeToken(token: string, options: OAuthOptions): Promise<boolean> {
    const oauth2Client = this.createOAuth2Client(options);
    
    try {
      await oauth2Client.revokeToken(token);
      return true;
    } catch (error) {
      console.error('Error revoking token:', error);
      return false;
    }
  }

  /**
   * Create an OAuth2Client instance with the provided options
   * @private
   */
  private createOAuth2Client(options: OAuthOptions): OAuth2Client {
    return new google.auth.OAuth2(
      options.clientId,
      options.clientSecret,
      options.redirectUri
    );
  }
}
