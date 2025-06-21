import { GmailAdapter, FetchOptions, OAuthService, GoogleOAuthProvider } from '../src';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const {
  GOOGLE_CLIENT_ID = '',
  GOOGLE_CLIENT_SECRET = '',
  GOOGLE_REDIRECT_URI = '',
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  console.error('Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI');
  process.exit(1);
}

/**
 * Example 1: Using the static OAuthFlow methods in GmailAdapter
 */
async function simpleOAuthExample(): Promise<void> {
  try {
    console.log('Starting OAuth flow...');
    
    // Start the OAuth flow
    await GmailAdapter.startOAuthFlow(
      GOOGLE_CLIENT_ID as string,
      GOOGLE_CLIENT_SECRET as string,
      GOOGLE_REDIRECT_URI as string
    );
    
    // Note: This example will start a server to handle OAuth callback
    // When the user completes authorization, the callback will log the refresh token
    // which you should save for future use
    
    console.log('OAuth flow started. Check your browser to complete the authorization.');
    console.log('Once completed, the refresh token will be displayed, which you should add to your .env file.');
    
    // This example keeps the process running to handle the callback
    // In a real application, you would save the tokens and initialize the adapter
  } catch (error) {
    console.error('Error in simple OAuth example:', error);
  }
}

/**
 * Example 2: Using the OAuthService directly for more control
 */
async function advancedOAuthExample(): Promise<void> {
  try {
    console.log('Starting advanced OAuth flow...');
    
    // Create the OAuth service with Google provider
    const oauthService = new OAuthService(new GoogleOAuthProvider());
    
    // Start the OAuth flow
    const authUrl = await oauthService.startOAuthFlow(
      {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        redirectUri: GOOGLE_REDIRECT_URI as string,
        scopes: ['https://mail.google.com/'],
        accessType: 'offline',
        prompt: 'consent'
      },
      'user123', // Optional user ID for token storage
      '/oauth/callback',
      3000
    );
    
    console.log('OAuth flow started with URL:', authUrl);
    console.log('Check your browser to complete the authorization.');
    
    // The server will handle the callback and store the token
    // Later, you can retrieve it with:
    // const tokenData = await oauthService.getTokens('user123');
    
    // This example keeps the process running to handle the callback
  } catch (error) {
    console.error('Error in advanced OAuth example:', error);
  }
}

/**
 * Example 3: Using the OAuth flow with the adapter directly
 */
async function directAdapterOAuthExample(): Promise<void> {
  try {
    console.log('Starting direct adapter OAuth example...');
    
    // Create the adapter
    const gmailAdapter = new GmailAdapter();
    
    // Initialize with auth code instead of refresh token
    // Note: This assumes you've already obtained an auth code through a different flow
    const authCode = process.env.GOOGLE_AUTH_CODE;
    
    if (!authCode) {
      console.error('Missing GOOGLE_AUTH_CODE environment variable for this example.');
      return;
    }
    
    await gmailAdapter.initialize({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      redirectUri: GOOGLE_REDIRECT_URI as string,
      authCode: authCode
    });
    
    console.log('Adapter initialized with auth code, exchanged for refresh token');
    
    // Now you can fetch emails as usual
    const emails = await gmailAdapter.fetchEmails({
      limit: 10,
      includeBody: true
    });
    
    console.log(`Fetched ${emails.emails.length} emails`);
  } catch (error) {
    console.error('Error in direct adapter OAuth example:', error);
  }
}

// Run the examples (uncomment one at a time)
// simpleOAuthExample();
// advancedOAuthExample();
// directAdapterOAuthExample();

// Default to simple example
simpleOAuthExample().catch(console.error);
