# Unimail

> 📬 Unified Node.js SDK to fetch and parse emails from Gmail, Outlook, IMAP.

**Status: Alpha Version**

**This library is currently in an early alpha stage. The API is subject to change, and it currently only supports Gmail integration. Please use with caution and report any issues you encounter.**

Unimail is an open-source Node.js library designed to simplify email integration across various providers like Gmail, Outlook, and IMAP. It provides a standardized way to fetch emails, parse attachments, and normalize metadata, making it an ideal solution for developers building inbox-integrated applications, document processors, AI email assistants, and more.

---

## Features

*   **Unified Interface:** A consistent `fetchEmails()` API across different email providers.
*   **Gmail Integration:** Robust email fetching from Gmail using OAuth2 and the Gmail API.
*   **Attachment Parsing:** Extracts attachments as Buffers with associated metadata (filename, MIME type, size).
    *   Logic to skip inline images (as per PRD, implementation in progress).
*   **Email Normalization:** Standardized schema for email data, making it easy to work with messages from any provider.
*   **TypeScript Support:** Written in TypeScript for a better development experience with type safety.
*   **Pluggable Adapters:** Designed with an adapter pattern to easily extend support for new email providers.

---

## Installation

```bash
npm install unimail
# or
yarn add unimail
```

---

## Prerequisites

### Gmail Setup

To use the Gmail adapter, you'll need to:

1.  **Create a Google Cloud Platform (GCP) Project:**
    *   Enable the **Gmail API**.
    *   Create **OAuth 2.0 Client ID** credentials.
        *   When configuring, add `http://localhost:3000/oauth2callback` (or your chosen redirect URI) to the "Authorized redirect URIs". This is used by the example helper script to get a refresh token.
2.  **Obtain OAuth2 Credentials:**
    *   **Client ID**
    *   **Client Secret**
    *   **Refresh Token:** You'll need a refresh token for server-side applications. The library includes a helper script to obtain this:
        ```bash
        npx ts-node examples/getRefreshToken.ts
        ```
        This script will guide you through the OAuth consent flow and print the refresh token to the console. Make sure your `.env` file has the `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` set for this script to work.

3.  **Environment Variables:**
    Store your credentials in a `.env` file in the root of your project:

    ```env
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_REFRESH_TOKEN=your_google_refresh_token
    # GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback (Needed for getRefreshToken.ts)
    ```

    Load these in your application using a library like `dotenv`.

---

## Quick Start (Gmail)

```typescript
import { GmailAdapter, FetchOptions, GmailCredentials } from 'unimail';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    console.error('Please provide GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in your .env file.');
    process.exit(1);
  }

  const gmailCredentials: GmailCredentials = {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    refreshToken: GOOGLE_REFRESH_TOKEN,
  };

  // Instantiate the adapter
  const gmailAdapter = new GmailAdapter();

  try {
    // Initialize the adapter with credentials
    console.log('Initializing GmailAdapter...');
    await gmailAdapter.initialize(gmailCredentials);
    console.log('GmailAdapter initialized successfully.');

    // Define fetch options
    const fetchOptions: FetchOptions = {
      limit: 10, // Fetch up to 10 emails
      // query: 'has:attachment filename:pdf', // Example: Gmail search query
      // unreadOnly: true,
      // since: '2024-01-01',
      includeBody: true, // Include text and HTML body
      includeAttachments: true, // Include attachment buffers
    };

    console.log('Fetching emails with options:', fetchOptions);
    const emails = await gmailAdapter.fetchEmails(fetchOptions);
    console.log(`Fetched ${emails.length} emails successfully.`);

    emails.forEach(email => {
      console.log('\n--- Email ---');
      console.log(`ID: ${email.id}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`From: ${email.from}`);
      console.log(`Date: ${email.date}`);
      console.log(`Body (text preview): ${email.bodyText?.substring(0, 100)}...`);
      console.log(`Attachments (${email.attachments.length}):`);
      email.attachments.forEach(att => {
        console.log(`  - ${att.filename} (${att.mimeType}, ${att.size} bytes)`);
        // att.buffer contains the attachment data
        // You can save it to a file or process it further
        // e.g., fs.writeFileSync(path.join(__dirname, att.filename), att.buffer);
      });
    });

  } catch (error) {
    console.error('\nError in Gmail example:', error);
  }
}

main();
```

---

## API

### `GmailAdapter`

#### `constructor()`
Creates a new instance of the GmailAdapter.

#### `async initialize(credentials: GmailCredentials): Promise<void>`
Initializes the adapter with the necessary OAuth2 credentials.

*   `credentials`: An object containing `clientId`, `clientSecret`, and `refreshToken`.

#### `async fetchEmails(options: FetchOptions): Promise<NormalizedEmail[]>`
Fetches emails based on the provided options.

*   `options`: An object to specify fetching criteria:
    *   `limit?: number`: Maximum number of emails to fetch.
    *   `query?: string`: Provider-specific search query (e.g., Gmail search operators).
    *   `since?: string | Date`: Fetch emails received after this date.
    *   `unreadOnly?: boolean`: Fetch only unread emails.
    *   `includeBody?: boolean`: Whether to include `bodyText` and `bodyHtml` in the result.
    *   `includeAttachments?: boolean`: Whether to include attachment `buffer`s.

### `NormalizedEmail` Schema

The `fetchEmails` method returns an array of `NormalizedEmail` objects:

```typescript
interface NormalizedEmail {
  id: string; // Provider-specific email ID
  threadId?: string; // Provider-specific thread ID
  source: 'gmail' | 'outlook' | 'imap' | 'unknown'; // Source provider
  from: string; // Email address of the sender
  to?: string[]; // Array of recipient email addresses
  cc?: string[]; // Array of CC recipient email addresses
  bcc?: string[]; // Array of BCC recipient email addresses
  subject?: string;
  date?: Date; // Parsed date of the email
  bodyText?: string; // Plain text content of the email
  bodyHtml?: string; // HTML content of the email
  attachments: Attachment[];
  labels?: string[]; // Provider-specific labels/folders
  headers?: Record<string, string | string[]>; // Raw email headers
  // Potentially more common fields
}

interface Attachment {
  id?: string; // Provider-specific attachment ID or part ID
  filename?: string;
  mimeType?: string;
  size?: number; // in bytes
  buffer?: Buffer; // Raw attachment data
  contentId?: string; // For inline attachments
  isInline?: boolean; // Indicates if the attachment is inline
}
```
*(Note: The `NormalizedEmail` and `Attachment` interfaces are defined in `src/interfaces.ts` and may evolve.)*

---

## Roadmap

*   ✅ **Gmail Integration (OAuth2)**
*   🛠️ **Outlook/Office365 Integration (Microsoft Graph API)**
*   🛠️ **IMAP Adapter (Yahoo, custom mail)**
*   🛠️ **Webhook-friendly Poller** (cron-based or push-ready)
*   🛠️ **Advanced Attachment Handling** (e.g., more robust inline image skipping, auto-tagging)
*   🛠️ **Token Persistence Layer** (in-memory, file, pluggable)

---

## Contributing

Contributions are welcome! Please feel free to submit issues, fork the repository, and create pull requests.

---

## License

[MIT](LICENSE)
