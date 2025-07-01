
import express, { Express, Request, Response } from 'express';
import http from 'http';
import open from 'open';
import { 
  IOAuthProvider, 
  OAuthOptions, 
  TokenData, 
  ITokenStorage,
  OAuthCallbackHandler
} from './interfaces.ts';
import { GoogleOAuthProvider } from './providers/GoogleOAuthProvider.ts';
import { MemoryTokenStorage } from './storage/MemoryTokenStorage.ts';

/**
 * Service to manage OAuth flows for different email providers
 */
export class OAuthService {
  private oauthProvider: IOAuthProvider;
  private tokenStorage: ITokenStorage;
  private server: http.Server | null = null;
  private pendingCallbacks: Map<string, OAuthCallbackHandler> = new Map();
  
  /**
   * Create a new OAuthService
   * @param provider - The OAuth provider to use (Google, Outlook, etc.)
   * @param tokenStorage - Optional storage mechanism for tokens
   */
  constructor(
    provider: IOAuthProvider = new GoogleOAuthProvider(),
    tokenStorage: ITokenStorage = new MemoryTokenStorage()
  ) {
    this.oauthProvider = provider;
    this.tokenStorage = tokenStorage;
  }
  
  /**
   * Start the OAuth flow by opening a browser window to the authorization URL
   * Returns the authorization URL that was opened
   */
  public async startOAuthFlow(
    options: OAuthOptions, 
    userId?: string,
    callbackPath: string = '/oauth/oauth2callback',
    port: number = 3000
  ): Promise<string> {
    const { authUrl, state } = await this.oauthProvider.initializeOAuthFlow(options);
    
    // Start a local server to handle the OAuth callback
    await this.startCallbackServer(options, callbackPath, port, userId);
    
    // Open the authorization URL in the user's browser
    try {
      await open(authUrl);
    } catch (error) {
      console.warn(`Could not open browser automatically: ${(error as Error).message}`);
      console.log('Please open this URL in your browser:', authUrl);
    }
    
    return authUrl;
  }

  /**
   * Handle the OAuth callback manually (without running a local server)
   * This is useful for server-side applications or when the callback is handled externally
   */
  public async handleCallback(
    code: string, 
    options: OAuthOptions,
    userId?: string
  ): Promise<TokenData> {
    const tokenData = await this.oauthProvider.handleCallback(code, options);
    
    // Store tokens if a userId is provided
    if (userId) {
      await this.tokenStorage.saveTokens(userId, tokenData);
    }
    
    return tokenData;
  }

  /**
   * Refresh an access token using a refresh token
   */
  public async refreshToken(
    refreshToken: string, 
    options: OAuthOptions,
    userId?: string
  ): Promise<TokenData> {
    const tokenData = await this.oauthProvider.refreshToken(refreshToken, options);
    
    // Update stored tokens if a userId is provided
    if (userId) {
      await this.tokenStorage.updateTokens(userId, tokenData);
    }
    
    return tokenData;
  }

  /**
   * Get tokens for a user from storage
   */
  public async getTokens(userId: string): Promise<TokenData | null> {
    return await this.tokenStorage.getTokens(userId);
  }

  /**
   * Revoke a token
   */
  public async revokeToken(
    token: string, 
    options: OAuthOptions,
    userId?: string
  ): Promise<boolean> {
    const success = await this.oauthProvider.revokeToken(token, options);
    
    // Remove stored tokens if revocation was successful and a userId is provided
    if (success && userId) {
      await this.tokenStorage.deleteTokens(userId);
    }
    
    return success;
  }

  /**
   * Register a callback function to be called when the OAuth flow completes
   * Can be used instead of running a local server
   */
  public registerCallback(state: string, callback: OAuthCallbackHandler): void {
    this.pendingCallbacks.set(state, callback);
  }

  /**
   * Start a local server to handle the OAuth callback
   * @private
   */
  private async startCallbackServer(
    options: OAuthOptions,
    callbackPath: string,
    port: number,
    userId?: string
  ): Promise<void> {
    // Stop any existing server
    await this.stopCallbackServer();
    
    const app = express();
    
    // Handle the OAuth callback
    app.get(callbackPath, async (req: Request, res: Response) => {
      try {
        const { code, error, state } = req.query;
        
        if (error) {
          const errorMsg = `Authorization error: ${error}`;
          res.send(`<html><body><h2>Authentication Failed</h2><p>${errorMsg}</p><p>Please close this window and try again.</p></body></html>`);
          
          // Call any registered callback for this state
          if (state && typeof state === 'string' && this.pendingCallbacks.has(state)) {
            const callback = this.pendingCallbacks.get(state);
            if (callback) {
              callback(null, new Error(errorMsg));
              this.pendingCallbacks.delete(state);
            }
          }
          
          return;
        }
        
        if (!code || typeof code !== 'string') {
          const errorMsg = 'No authorization code received';
          res.send(`<html><body><h2>Authentication Failed</h2><p>${errorMsg}</p><p>Please close this window and try again.</p></body></html>`);
          return;
        }
        
        // Exchange the code for tokens
        const tokenData = await this.oauthProvider.handleCallback(code, options);
        
        // Store the tokens if a userId is provided
        if (userId) {
          await this.tokenStorage.saveTokens(userId, tokenData);
        }
        
        // Call any registered callback for this state
        if (state && typeof state === 'string' && this.pendingCallbacks.has(state)) {
          const callback = this.pendingCallbacks.get(state);
          if (callback) {
            callback(tokenData);
            this.pendingCallbacks.delete(state);
          }
        }

        console.log(tokenData)
        
        res.send(`<html><body>
          <h2>Authentication Successful!</h2>
          <p>You have successfully authenticated with the email provider.</p>
          <p>You may close this window and return to the application.</p>
          ${tokenData.refreshToken ? `<p><strong>Refresh Token:</strong> ${tokenData.refreshToken}</p>` : ''}
          <script>window.close();</script>
        </body></html>`);
        
        // Optionally, close the server if we don't expect more callbacks
        setTimeout(() => this.stopCallbackServer(), 2000);
      } catch (error) {
        const errorMsg = `Error during OAuth callback: ${(error as Error).message}`;
        console.error(errorMsg);
        res.status(500).send(`<html><body><h2>Authentication Error</h2><p>${errorMsg}</p><p>Please close this window and try again.</p></body></html>`);
      }
    });
    
    // Start the server
    return new Promise((resolve) => {
      this.server = app.listen(port, () => {
        console.log(`OAuth callback server listening on port ${port}`);
        resolve();
      });
    });
  }
  
  /**
   * Stop the callback server if it's running
   * @private
   */
  private async stopCallbackServer(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }
}
