import { GmailAdapter, NormalizedEmail } from '../src';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

const {
  GOOGLE_CLIENT_ID = '',
  GOOGLE_CLIENT_SECRET = '',
  GOOGLE_REFRESH_TOKEN = ''
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  console.error('Missing required environment variables. Please set:');
  console.error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
  process.exit(1);
}

/**
 * Example demonstrating how to work with Gmail labels
 */
async function labelsExample() {
  try {
    console.log('Initializing GmailAdapter...');
    
    // Create and initialize the Gmail adapter
    const gmailAdapter = new GmailAdapter();
    await gmailAdapter.initialize({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      refreshToken: GOOGLE_REFRESH_TOKEN
    });
    
    console.log('GmailAdapter initialized successfully.');
    
    // Example 1: Fetch emails with specific labels using Gmail search syntax
    console.log('\n--- Example 1: Fetching emails with specific labels ---');
    
    const labelQuery = 'label:important';
    console.log(`Searching for emails with query: "${labelQuery}"`);
    
    const importantResponse = await gmailAdapter.fetchEmails({
      query: labelQuery,
      limit: 5,
      includeBody: false, // For faster fetching
      includeAttachments: false // For faster fetching
    });
    
    console.log(`Found ${importantResponse.emails.length} important emails.`);
    
    // Display emails with their labels
    importantResponse.emails.forEach((email, index) => {
      console.log(`\nEmail ${index + 1}:`);
      console.log(`  Subject: ${email.subject || '(No subject)'}`);
      console.log(`  From: ${email.from}`);
      console.log(`  Labels: ${email.labels?.join(', ')}`);
    });
    
    // Example 2: Group emails by their labels
    console.log('\n--- Example 2: Grouping emails by labels ---');
    
    // Fetch a larger set of emails
    const allEmailsResponse = await gmailAdapter.fetchEmails({
      limit: 20,
      includeBody: false,
      includeAttachments: false
    });
    
    console.log(`Fetched ${allEmailsResponse.emails.length} emails for grouping.`);
    
    // Group emails by label
    const emailsByLabel = new Map<string, NormalizedEmail[]>();
    
    for (const email of allEmailsResponse.emails) {
      if (email.labels && email.labels.length > 0) {
        for (const label of email.labels) {
          if (!emailsByLabel.has(label)) {
            emailsByLabel.set(label, []);
          }
          emailsByLabel.get(label)!.push(email);
        }
      } else {
        // Handle emails with no labels
        const noLabelKey = 'NO_LABEL';
        if (!emailsByLabel.has(noLabelKey)) {
          emailsByLabel.set(noLabelKey, []);
        }
        emailsByLabel.get(noLabelKey)!.push(email);
      }
    }
    
    // Display results of grouping
    console.log('\nEmail distribution by label:');
    for (const [label, emails] of emailsByLabel.entries()) {
      console.log(`  ${label}: ${emails.length} emails`);
    }
    
    // Example 3: Find emails with multiple specific labels
    console.log('\n--- Example 3: Finding emails with multiple specific labels ---');
    
    // Find emails that have both INBOX and IMPORTANT labels
    const multiLabelEmails = allEmailsResponse.emails.filter(email => 
      email.labels && 
      email.labels.includes('INBOX') && 
      email.labels.includes('IMPORTANT')
    );
    
    console.log(`Found ${multiLabelEmails.length} emails that are both in INBOX and marked IMPORTANT.`);
    
    // Save results to file
    saveResultsToFile(
      emailsByLabel, 
      multiLabelEmails
    );
    
  } catch (error) {
    console.error('Error in labels example:', error);
  }
}

/**
 * Helper function to save results to JSON files
 */
function saveResultsToFile(
  emailsByLabel: Map<string, NormalizedEmail[]>,
  multiLabelEmails: NormalizedEmail[]
) {
  // Create sample_result directory if it doesn't exist
  const resultDir = path.join(__dirname, 'sample_result');
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir);
  }
  
  // Convert Map to a regular object for JSON serialization
  const labelGroups: Record<string, any[]> = {};
  for (const [label, emails] of emailsByLabel.entries()) {
    labelGroups[label] = emails.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      date: email.date,
      labels: email.labels
    }));
  }
  
  // Save grouped emails by label
  fs.writeFileSync(
    path.join(resultDir, 'emails_by_label.json'),
    JSON.stringify(labelGroups, null, 2)
  );
  
  // Save multi-label emails
  fs.writeFileSync(
    path.join(resultDir, 'multi_label_emails.json'),
    JSON.stringify(
      multiLabelEmails.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        date: email.date,
        labels: email.labels
      })),
      null, 
      2
    )
  );
  
  console.log('\nResults saved to:');
  console.log('- emails_by_label.json');
  console.log('- multi_label_emails.json');
}

// Run the example
labelsExample().catch(console.error);
