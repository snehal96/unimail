import { GmailAdapter, FetchOptions, NormalizedEmail, GmailCredentials } from '../src';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

const {
  GOOGLE_CLIENT_ID = '',
  GOOGLE_CLIENT_SECRET = '',
  GOOGLE_REDIRECT_URI = '',
  GOOGLE_AUTH_CODE = ''
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  console.error('Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI');
  process.exit(1);
}

async function initializeWithAuthCode() {
  try {
    // Instantiate the adapter
    const gmailAdapter = new GmailAdapter();
    
    // If we have an auth code provided, use it
    if (GOOGLE_AUTH_CODE) {
      console.log('Initializing with auth code...');
      
      await gmailAdapter.initialize({
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        redirectUri: GOOGLE_REDIRECT_URI,
        authCode: GOOGLE_AUTH_CODE
      });
      
      console.log('Successfully initialized with auth code!');
      
      // Now fetch some emails
      const fetchOptions: FetchOptions = {
        limit: 5,
        includeBody: true,
        includeAttachments: false
      };
      
      console.log('Fetching emails...');
      const response = await gmailAdapter.fetchEmails(fetchOptions);
      
      console.log(`Successfully fetched ${response.emails.length} emails.`);
      
      // Display email details including labels
      response.emails.forEach((email, index) => {
        console.log(`\n--- Email ${index + 1} ---`);
        console.log(`Subject: ${email.subject || '(No subject)'}`);
        console.log(`From: ${email.from}`);
        console.log(`Labels: ${email.labels?.join(', ') || 'None'}`);
        
        // Show some additional information about system labels
        if (email.labels && email.labels.length > 0) {
          const hasImportant = email.labels.includes('IMPORTANT');
          const isInInbox = email.labels.includes('INBOX');
          const isUnread = email.labels.includes('UNREAD');
          
          console.log(`Status: ${isInInbox ? 'In Inbox' : 'Not in Inbox'}, ${isUnread ? 'Unread' : 'Read'}, ${hasImportant ? 'Important' : 'Not Important'}`);
          
          // Check for category labels
          const categories = email.labels.filter(label => label.startsWith('CATEGORY_'));
          if (categories.length > 0) {
            console.log(`Categories: ${categories.map(c => c.replace('CATEGORY_', '')).join(', ')}`);
          }
        }
      });
      
      saveEmailsToFile(response.emails);
    } else {
      console.log('No auth code provided. Starting OAuth flow to obtain one...');
      
      // Start the OAuth flow to get an auth code
      const authUrl = await GmailAdapter.startOAuthFlow(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
      );
      
      console.log('OAuth flow started. Check your browser to authorize the application.');
      console.log('Authorization URL:', authUrl);
      console.log('\nAfter authorization, the OAuth callback will display your refresh token.');
      console.log('Add the refresh token to your .env file as GOOGLE_REFRESH_TOKEN.');
      console.log('Or, copy the authorization code and add it to your .env file as GOOGLE_AUTH_CODE to use this example.');
    }
  } catch (error) {
    console.error('Error in auth code example:', error);
  }
}

function saveEmailsToFile(emails: NormalizedEmail[]) {
  // Create sample_result directory if it doesn't exist
  const resultDir = path.join(__dirname, 'sample_result');
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir);
  }
  
  // Save fetched emails to a JSON file
  const outputPath = path.join(resultDir, 'auth_code_fetched_emails.json');      fs.writeFileSync(
    outputPath,
    JSON.stringify(
      emails.map(email => ({
        id: email.id,
        threadId: email.threadId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        date: email.date,
        labels: email.labels || [],
        bodyPreview: email.bodyText?.substring(0, 100) + '...',
        attachmentCount: email.attachments.length
      })),
      null,
      2
    )
  );
  
  console.log(`Saved email summary to ${outputPath}`);
}

// Run the example
initializeWithAuthCode().catch(console.error);
