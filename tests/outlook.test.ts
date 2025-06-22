/**
 * Manual test file for Outlook integration
 * Not part of the automated test suite
 * 
 * To use:
 * 1. Create a .env file with Microsoft credentials
 * 2. Run using: npx ts-node tests/outlook.test.ts
 */
import { OutlookAdapter } from '../src';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testOutlookIntegration() {
  const { 
    MICROSOFT_CLIENT_ID, 
    MICROSOFT_CLIENT_SECRET, 
    MICROSOFT_REFRESH_TOKEN 
  } = process.env;

  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || !MICROSOFT_REFRESH_TOKEN) {
    console.error('Missing required environment variables. Please set:');
    console.error('MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN');
    process.exit(1);
  }

  try {
    console.log('Setting up OutlookAdapter...');
    
    const outlookAdapter = new OutlookAdapter();
    await outlookAdapter.initialize({
      clientId: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
      refreshToken: MICROSOFT_REFRESH_TOKEN
    });

    console.log('Successfully initialized OutlookAdapter');
    console.log('Fetching 5 recent emails...');
    
    const response = await outlookAdapter.fetchEmails({ 
      limit: 5,
      includeBody: false,
      includeAttachments: false
    });
    
    console.log(`Successfully fetched ${response.emails.length} emails`);
    
    // Display email details
    response.emails.forEach((email, index) => {
      console.log(`\nEmail ${index + 1}:`);
      console.log(`  Subject: ${email.subject || '(No subject)'}`);
      console.log(`  From: ${email.from}`);
      console.log(`  Date: ${email.date.toLocaleString()}`);
      console.log(`  Categories: ${email.labels?.join(', ') || 'None'}`);
    });
    
    console.log('\nOutlook integration test completed successfully!');
  } catch (error) {
    console.error('Error testing Outlook integration:', error);
    process.exit(1);
  }
}

// Run the test
testOutlookIntegration().catch(console.error);
