import { GmailAdapter, FetchOptions, NormalizedEmail, GmailCredentials } from '../src'; // Adjust path
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file (still useful for the example itself)
dotenv.config();

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('Missing Google API credentials in .env file for the example. Please set:');
  console.error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
  process.exit(1);
}

// Prepare credentials (e.g., from .env for this example, or from your app's secure storage)
const gmailCredentials: GmailCredentials = {
  clientId: GOOGLE_CLIENT_ID!,
  clientSecret: GOOGLE_CLIENT_SECRET!,
  refreshToken: GOOGLE_REFRESH_TOKEN,
};

async function main() {
  // Instantiate the adapter without credentials
  const gmailAdapter = new GmailAdapter();

  try {
    console.log('Initializing GmailAdapter...');
    // Initialize the adapter with credentials
    await gmailAdapter.initialize(gmailCredentials);
    console.log('GmailAdapter initialized successfully.');

    // Authentication is now typically handled within fetchEmails or can be called explicitly
    // console.log('Authenticating with Gmail...');
    // await gmailAdapter.authenticate(); 
    // console.log('Authentication successful.');


    const fetchOptions: FetchOptions = {
      limit: 20, // Fetch 5 emails
      // query: 'has:attachment filename:pdf', // Example query
      query: '',
      unreadOnly: true,
      // since: '2024-01-01',
      includeBody: true,
      includeAttachments: true, // If true, buffers will be populated
    };

    console.log('Fetching emails with options:', fetchOptions);
    const emails: NormalizedEmail[] = await gmailAdapter.fetchEmails(fetchOptions);
    console.log(`Fetched ${emails.length} emails successfully.`);

    if (emails.length === 0) {
      console.log('No emails found matching the criteria.');
      return;
    }

    // Write fetched emails to a file
    try {
      const outputFilePath = path.join(__dirname, 'fetched_emails.json');
      // The Buffer in attachments cannot be directly stringified to JSON in a meaningful way by default.
      // We need to decide how to handle it: omit, convert to base64 string, or save separately.
      // For this example, let's create a version of emails without the raw buffer for JSON logging.
      const emailsForJson = emails.map(email => {
        const attachmentsForJson = email.attachments.map(att => {
          const { buffer, ...restOfAttachment } = att;
          // Optionally, represent buffer differently, e.g., as a placeholder or base64 string
          return {
            ...restOfAttachment,
            bufferExists: buffer ? true : false, // Indicate if buffer was present
            // bufferBase64: buffer ? buffer.toString('base64') : undefined // Example if storing as base64
          };
        });
        return {
          ...email,
          attachments: attachmentsForJson,
        };
      });

      fs.writeFileSync(outputFilePath, JSON.stringify(emailsForJson, null, 2));
      console.log(`Successfully wrote fetched emails to ${outputFilePath}`);
    } catch (writeError) {
      console.error('Error writing emails to file:', writeError);
    }

    for (const email of emails) {
      console.log('\n--- Email ---');
      console.log(`ID: ${email.id}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`From: ${email.from}`);
      console.log(`Date: ${email.date}`);
      console.log(`Body (text preview): ${email.bodyText?.substring(0, 100)}...`);
      console.log(`Attachments (${email.attachments.length}):`);
      email.attachments.forEach(att => {
        console.log(`  - ${att.filename} (${att.mimeType}, ${att.size} bytes)`);
        // If you want to save attachments:
        // if (att.buffer) {
        //   const attachmentsDir = path.join(__dirname, 'attachments');
        //   if (!fs.existsSync(attachmentsDir)) {
        //     fs.mkdirSync(attachmentsDir);
        //   }
        //   const filePath = path.join(attachmentsDir, `${email.id}_${att.filename}`);
        //   fs.writeFileSync(filePath, att.buffer);
        //   console.log(`    Saved to ${filePath}`);
        // }
      });
    }

  } catch (error) {
    console.error('\nError in Gmail example:');
    if (error instanceof Error) {
      console.error(`Message: ${error.message}`);
      // if (error.stack) {
      //   console.error(`Stack: ${error.stack}`);
      // }
    } else {
      console.error(error);
    }
  }
}

main();
