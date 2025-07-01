import { OutlookAdapter } from '../src';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const {
  MICROSOFT_CLIENT_ID = '',
  MICROSOFT_CLIENT_SECRET = '',
  MICROSOFT_REDIRECT_URI = 'http://localhost:3000/oauth/oauth2callback',
  MICROSOFT_TENANT_ID = '', // Optional
} = process.env;

if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || !MICROSOFT_REDIRECT_URI) {
  console.error('Missing required environment variables. Please set:');
  console.error('MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI');
  process.exit(1);
}

async function startOutlookOAuth() {
  try {
    console.log('Starting OAuth flow for Outlook...');
    
    // Start the OAuth flow with Microsoft
    const authUrl = await OutlookAdapter.startOAuthFlow(
      MICROSOFT_CLIENT_ID,
      MICROSOFT_CLIENT_SECRET,
      MICROSOFT_REDIRECT_URI,
      MICROSOFT_TENANT_ID || undefined, // Optional tenant ID
      3000, // Port for the local server
      '/oauth/oauth2callback' // Callback path
    );
    
    console.log('\nPlease visit the following URL in your browser to authorize the application:');
    console.log(authUrl);
    console.log('\nWaiting for authorization...');
    
    // The OAuth callback will be handled automatically by the built-in server
    // and will display the refresh token upon successful authorization
    
  } catch (error) {
    console.error('Error starting OAuth flow:', error);
  }
}

startOutlookOAuth().catch(console.error);
