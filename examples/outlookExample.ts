import { OutlookAdapter, FetchOptions, OutlookCredentials } from '../src';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

const {
  MICROSOFT_CLIENT_ID = '',
  MICROSOFT_CLIENT_SECRET = '',
  MICROSOFT_ACCESS_TOKEN = '',
  MICROSOFT_AUTH_CODE = '', // Optional: Use auth code for initial setup
  MICROSOFT_TENANT_ID = '', // Optional
} = process.env;

if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || !MICROSOFT_ACCESS_TOKEN) {
  console.error('Missing required environment variables. Please set:');
  console.error('MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN');
  process.exit(1);
}

async function outlookExample() {
  try {
    console.log('Initializing OutlookAdapter...');
    
    // Create and initialize the Outlook adapter
    const outlookAdapter = new OutlookAdapter();
    await outlookAdapter.initialize({
      clientId: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
      authCode: MICROSOFT_AUTH_CODE,
      accessToken: MICROSOFT_ACCESS_TOKEN, // Optional: Use access token directly for testing
      tenantId: MICROSOFT_TENANT_ID || undefined, // Optional tenant ID
    });
    
    console.log('OutlookAdapter initialized successfully.');
    
    // Define fetch options
    const fetchOptions: FetchOptions = {
      limit: 10, // Fetch up to 10 emails
      includeBody: true,
      includeAttachments: true,
    };
    
    console.log('Fetching emails with options:', fetchOptions);
    
    // Fetch emails
    const response = await outlookAdapter.fetchEmails(fetchOptions);
    console.log(`Fetched ${response.emails.length} emails successfully.`);
    
    // Display email information
    response.emails.forEach((email, index) => {
      console.log(`\n--- Email ${index + 1} ---`);
      console.log(`ID: ${email.id}`);
      console.log(`Subject: ${email.subject || '(No subject)'}`);
      console.log(`From: ${email.from}`);
      console.log(`To: ${email.to.join(', ')}`);
      if (email.cc && email.cc.length > 0) {
        console.log(`CC: ${email.cc.join(', ')}`);
      }
      console.log(`Date: ${email.date.toLocaleString()}`);
      
      // Display categories (Outlook's equivalent to Gmail labels)
      if (email.labels && email.labels.length > 0) {
        console.log(`Categories: ${email.labels.join(', ')}`);
      }
      
      // Display attachments
      if (email.attachments.length > 0) {
        console.log(`Attachments (${email.attachments.length}):`);
        email.attachments.forEach(attachment => {
          console.log(`  - ${attachment.filename} (${attachment.mimeType}, ${attachment.size} bytes)`);
        });
      }
      
      // Show preview of body content if available
      if (email.bodyText) {
        console.log(`\nBody preview: ${email.bodyText.substring(0, 150)}...`);
      }
    });
    
    // Save results to file
    saveResultsToFile(response.emails);
    
  } catch (error) {
    console.error('Error in Outlook example:', error);
  }
}

/**
 * Helper function to save fetched emails to a JSON file
 */
function saveResultsToFile(emails: any[]) {
  // Create sample_result directory if it doesn't exist
  const resultDir = path.join(__dirname, 'sample_result');
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir, { recursive: true });
  }
  
  // Format emails for JSON export by removing circular references
  const emailsForExport = emails.map(email => ({
    id: email.id,
    subject: email.subject,
    from: email.from,
    to: email.to,
    cc: email.cc,
    date: email.date,
    labels: email.labels,
    bodyPreview: email.bodyText ? email.bodyText.substring(0, 100) : undefined,
    hasAttachments: email.attachments.length > 0,
    attachments: email.attachments.map((att: any) => ({
      filename: att.filename,
      mimeType: att.mimeType,
      size: att.size
    }))
  }));
  
  // Save to file
  fs.writeFileSync(
    path.join(resultDir, 'outlook_emails.json'),
    JSON.stringify(emailsForExport, null, 2)
  );
  
  console.log('\nResults saved to: sample_result/outlook_emails.json');
}

// Run the example
outlookExample().catch(console.error);
