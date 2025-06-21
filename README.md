# Unimail

> 📬 Unified Node.js SDK to fetch and parse emails from Gmail, Outlook, IMAP.

**Status: Alpha Version**

**This library is currently in an early alpha stage. The API is subject to change, and it currently only supports Gmail integration. Please use with caution and report any issues you encounter.**

Unimail is an open-source Node.js library designed to simplify email integration across various providers like Gmail, Outlook, and IMAP. It provides a standardized way to fetch emails, parse attachments, and normalize metadata, making it an ideal solution for developers building inbox-integrated applications, document processors, AI email assistants, and more.

---

## Features

*   **Unified Interface:** A consistent \`fetchEmails()\` API across different email providers.
*   **Gmail Integration:** Robust email fetching from Gmail using OAuth2 and the Gmail API.
*   **Integrated OAuth Flow:** Built-in OAuth authentication flow for seamless integration without requiring separate auth code.
*   **Attachment Parsing:** Extracts attachments as Buffers with associated metadata (filename, MIME type, size).
    *   Logic to skip inline images based on content IDs.
*   **Email Normalization:** Standardized schema for email data, making it easy to work with messages from any provider.
*   **TypeScript Support:** Written in TypeScript for a better development experience with type safety.
*   **Pluggable Adapters:** Designed with an adapter pattern to easily extend support for new email providers.

---

## Installation

\`\`\`bash
npm install unimail
# or
yarn add unimail
\`\`\`

---

## Prerequisites

### Gmail Setup

To use the Gmail adapter, you'll need to:

1.  **Create a Google Cloud Platform (GCP) Project:**
    *   Enable the **Gmail API**.
    *   Create **OAuth 2.0 Client ID** credentials.
    *   When configuring, add \`http://localhost:3000/oauth/callback\` (or your chosen redirect URI) to the "Authorized redirect URIs".

2.  **Authentication Options:**

    You have two options for authentication with Gmail:

    #### Option 1: Using the Built-in OAuth Flow (Recommended)

    Unimail now includes an integrated OAuth flow that can handle the entire authentication process:

    \`\`\`typescript
    import { GmailAdapter } from 'unimail';
    import dotenv from 'dotenv';

    dotenv.config();

    async function authenticateWithOAuth() {
      const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        console.error('Missing required OAuth credentials in .env file');
        return;
      }

      // Start the OAuth flow - this opens a browser for user consent
      await GmailAdapter.startOAuthFlow(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
      );

      // The OAuth flow will display the refresh token when completed
      // You should save this token for future use
    }

    authenticateWithOAuth();
    \`\`\`

    #### Option 2: Using a Pre-obtained Refresh Token

    If you prefer to get a refresh token separately:

    \`\`\`bash
    npx ts-node examples/getRefreshToken.ts
    \`\`\`

    This script will guide you through the OAuth consent flow and print the refresh token to the console.

3.  **Environment Variables:**
    Store your credentials in a \`.env\` file in the root of your project:

    \`\`\`env
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_REFRESH_TOKEN=your_google_refresh_token
    GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
    \`\`\`

    Load these in your application using a library like \`dotenv\`.

---

## Quick Start (Gmail)

\`\`\`typescript
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
    const response = await gmailAdapter.fetchEmails(fetchOptions);
    console.log(\`Fetched \${response.emails.length} emails successfully.\`);

    response.emails.forEach(email => {
      console.log('\n--- Email ---');
      console.log(\`ID: \${email.id}\`);
      console.log(\`Subject: \${email.subject}\`);
      console.log(\`From: \${email.from}\`);
      console.log(\`Date: \${email.date}\`);
      console.log(\`Body (text preview): \${email.bodyText?.substring(0, 100)}...\`);
      console.log(\`Attachments (\${email.attachments.length}):\`);
      email.attachments.forEach(att => {
        console.log(\`  - \${att.filename} (\${att.mimeType}, \${att.size} bytes)\`);
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
\`\`\`

## Using the OAuth Flow

Unimail provides multiple ways to use OAuth authentication:

### Method 1: Using Static OAuth Methods on GmailAdapter

The simplest approach is to use the static methods provided by GmailAdapter:

\`\`\`typescript
import { GmailAdapter } from 'unimail';
import dotenv from 'dotenv';

dotenv.config();

async function startOAuthFlow() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  
  // Start the OAuth flow - this opens a browser for user consent
  await GmailAdapter.startOAuthFlow(
    GOOGLE_CLIENT_ID!,
    GOOGLE_CLIENT_SECRET!,
    GOOGLE_REDIRECT_URI!
  );
  
  // The OAuth callback will be handled automatically
  // and will display the refresh token when completed
}

startOAuthFlow();
\`\`\`

### Method 2: Initializing with Auth Code

If you already have an authorization code (from a custom OAuth flow), you can initialize the adapter directly with it:

\`\`\`typescript
import { GmailAdapter, GmailCredentials } from 'unimail';

// Create the adapter
const gmailAdapter = new GmailAdapter();

// Initialize with auth code instead of refresh token
await gmailAdapter.initialize({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'your-redirect-uri',
  authCode: 'your-auth-code'  // The code obtained from OAuth callback
});

// The adapter will exchange the auth code for tokens
// and you can now fetch emails as usual
const response = await gmailAdapter.fetchEmails({ limit: 10 });
\`\`\`

### Method 3: Using the OAuthService Directly (Advanced)

For more control over the OAuth flow, you can use the OAuthService class:

\`\`\`typescript
import { OAuthService, GoogleOAuthProvider } from 'unimail';
import dotenv from 'dotenv';

dotenv.config();

async function advancedOAuthFlow() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  
  // Create OAuth service with Google provider
  const oauthService = new OAuthService(new GoogleOAuthProvider());
  
  // Start OAuth flow with custom options
  const authUrl = await oauthService.startOAuthFlow(
    {
      clientId: GOOGLE_CLIENT_ID!,
      clientSecret: GOOGLE_CLIENT_SECRET!,
      redirectUri: GOOGLE_REDIRECT_URI!,
      scopes: ['https://mail.google.com/'],
      accessType: 'offline',
      prompt: 'consent'
    },
    'user123', // Optional user ID for token storage
    '/oauth/callback',
    3000
  );
  
  console.log('Visit this URL to authorize:', authUrl);
  
  // The callback will be handled by the built-in server
  // You can retrieve tokens later with:
  // const tokens = await oauthService.getTokens('user123');
}
\`\`\`

---

## API

### \`GmailAdapter\`

#### \`constructor()\`
Creates a new instance of the GmailAdapter.

#### \`async initialize(credentials: GmailCredentials): Promise<void>\`
Initializes the adapter with the necessary OAuth2 credentials.

*   \`credentials\`: An object containing:
    * \`clientId\`: Google OAuth client ID.
    * \`clientSecret\`: Google OAuth client secret.
    * \`refreshToken\`: (Optional) OAuth refresh token.
    * \`authCode\`: (Optional) Authorization code from OAuth flow.
    * \`redirectUri\`: (Required when using authCode) The redirect URI for OAuth.

#### \`static async startOAuthFlow(clientId: string, clientSecret: string, redirectUri: string, port?: number, callbackPath?: string): Promise<string>\`
Starts the OAuth flow by opening a browser window for user authorization.

*   Returns: The authorization URL that was opened.

#### \`static async handleOAuthCallback(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<{accessToken: string, refreshToken?: string}>\`
Handles an OAuth callback manually (for server-side applications).

*   Returns: An object with access and refresh tokens.

#### \`async fetchEmails(options: FetchOptions): Promise<PaginatedEmailsResponse>\`
Fetches emails based on the provided options.

*   \`options\`: An object to specify fetching criteria:
    *   \`limit?: number\`: Maximum number of emails to fetch.
    *   \`query?: string\`: Provider-specific search query (e.g., Gmail search operators).
    *   \`since?: string | Date\`: Fetch emails received after this date (inclusive).
    *   \`before?: string | Date\`: Fetch emails received before this date (inclusive).
    *   \`unreadOnly?: boolean\`: Fetch only unread emails.
    *   \`includeBody?: boolean\`: Whether to include \`bodyText\` and \`bodyHtml\` in the result.
    *   \`includeAttachments?: boolean\`: Whether to include attachment \`buffer\`s.
    *   \`format?: 'raw' | 'full' | 'metadata'\`: Control how emails are fetched from the provider.
        *   \`'raw'\`: Get the full RFC 2822 formatted email (most complete but larger).
        *   \`'full'\`: Get a structured representation with headers, body, and parts.
        *   \`'metadata'\`: Get just headers (most efficient for listing emails).
        *   Defaults to an appropriate value based on \`includeBody\` and \`includeAttachments\`.
    *   \`pageToken?: string\`: Token for fetching the next page of results.
    *   \`pageSize?: number\`: Number of results per page (defaults to limit if not specified).
    *   \`getAllPages?: boolean\`: Whether to automatically fetch all pages (up to limit).

### \`OAuthService\`

#### \`constructor(provider?: IOAuthProvider, tokenStorage?: ITokenStorage)\`
Creates a new OAuthService instance.

*   \`provider\`: OAuth provider implementation (defaults to GoogleOAuthProvider).
*   \`tokenStorage\`: Storage mechanism for tokens (defaults to in-memory storage).

#### \`async startOAuthFlow(options: OAuthOptions, userId?: string, callbackPath?: string, port?: number): Promise<string>\`
Starts the OAuth flow by opening a browser window for user authorization.

*   Returns: The authorization URL that was opened.

#### \`async handleCallback(code: string, options: OAuthOptions, userId?: string): Promise<TokenData>\`
Handles the OAuth callback manually (without running a local server).

*   Returns: Token data including access and refresh tokens.

### Return Type of \`fetchEmails\`

The \`fetchEmails\` method returns a \`PaginatedEmailsResponse\` object:

\`\`\`typescript
interface PaginatedEmailsResponse {
  emails: NormalizedEmail[];      // Array of normalized email objects
  nextPageToken?: string;         // Token for fetching the next page (undefined if no more pages)
  totalCount?: number;            // Approximate total number of emails matching the query
}
\`\`\`

### \`NormalizedEmail\` Schema

Each email in the \`emails\` array is a \`NormalizedEmail\` object:

\`\`\`typescript
interface NormalizedEmail {
  id: string; // Provider-specific email ID
  threadId?: string; // Provider-specific thread ID
  provider: 'gmail' | 'outlook' | 'imap' | 'unknown'; // Source provider
  from: string; // Email address of the sender
  to: string[]; // Array of recipient email addresses
  cc?: string[]; // Array of CC recipient email addresses
  bcc?: string[]; // Array of BCC recipient email addresses
  subject?: string;
  date: Date; // Parsed date of the email
  bodyText?: string; // Plain text content of the email
  bodyHtml?: string; // HTML content of the email
  attachments: Attachment[];
  labels?: string[]; // Provider-specific labels/folders
  // Potentially more common fields
}

interface Attachment {
  filename: string;
  mimeType: string;
  size: number; // in bytes
  buffer?: Buffer; // Raw attachment data
  contentId?: string; // For inline attachments
}
\`\`\`
*(Note: The \`NormalizedEmail\` and \`Attachment\` interfaces are defined in \`src/interfaces.ts\` and may evolve.)*

---

## Date Range Queries

You can fetch emails within a specific date range using either the \`since\` and \`before\` parameters or by using Gmail's search syntax in the \`query\` parameter:

\`\`\`typescript
// Using since and before parameters
const { emails } = await gmailAdapter.fetchEmails({
  since: '2025-01-01',        // January 1, 2025
  before: '2025-06-21',       // June 21, 2025
  limit: 100
});

// Using Gmail's search syntax in the query
const { emails } = await gmailAdapter.fetchEmails({
  query: 'after:2025/01/01 before:2025/06/21 has:attachment',
  limit: 100
});
\`\`\`

Both approaches will return emails from the specified date range. The parameters accept Date objects or date strings.

## Pagination Support

When fetching large numbers of emails, you can use pagination to prevent memory problems:

\`\`\`typescript
// First page (default page size is the same as limit)
const { emails, nextPageToken } = await gmailAdapter.fetchEmails({ 
  limit: 50,
  query: 'has:attachment'
});
console.log(\`Fetched \${emails.length} emails, more available: \${nextPageToken ? 'Yes' : 'No'}\`);

// If there are more pages, fetch the next one
if (nextPageToken) {
  const { emails: nextEmails, nextPageToken: newNextPageToken } = await gmailAdapter.fetchEmails({
    limit: 50,
    query: 'has:attachment',
    pageToken: nextPageToken
  });
  console.log(\`Fetched another \${nextEmails.length} emails\`);
}
\`\`\`

Alternatively, you can fetch all emails matching a query (up to a limit) in one call:

\`\`\`typescript
const { emails, totalCount } = await gmailAdapter.fetchEmails({
  limit: 200,
  query: 'has:attachment',
  getAllPages: true
});
console.log(\`Fetched \${emails.length} emails out of approximately \${totalCount}\`);
\`\`\`

## Working with Gmail Labels

Gmail organizes emails using labels, which are included in the \`labels\` property of the \`NormalizedEmail\` object. You can:

1. Filter emails by label using Gmail's search syntax:

```typescript
// Fetch emails with specific labels
const response = await gmailAdapter.fetchEmails({
  query: 'label:important label:unread', // Emails that are both important and unread
  limit: 20
});

// Or use Gmail's built-in system labels
const { emails } = await gmailAdapter.fetchEmails({
  query: 'in:inbox in:sent', // Emails in inbox and sent folders
  limit: 20
});
```

2. Process emails based on their labels after fetching:

```typescript
const { emails } = await gmailAdapter.fetchEmails({
  limit: 50,
  includeBody: true
});

// Group emails by label
const emailsByLabel = new Map<string, NormalizedEmail[]>();
for (const email of emails) {
  if (email.labels) {
    for (const label of email.labels) {
      if (!emailsByLabel.has(label)) {
        emailsByLabel.set(label, []);
      }
      emailsByLabel.get(label)!.push(email);
    }
  }
}

// Process emails by label
for (const [label, labelEmails] of emailsByLabel.entries()) {
  console.log(`\nProcessing ${labelEmails.length} emails with label "${label}"`);
  // Process label-specific emails...
}
```

The most common Gmail system labels include:
- `INBOX` - Messages in the inbox
- `SENT` - Sent messages
- `DRAFT` - Draft messages
- `SPAM` - Messages marked as spam
- `TRASH` - Messages in the trash
- `IMPORTANT` - Messages marked as important
- `CATEGORY_PERSONAL` - Messages categorized as personal
- `CATEGORY_SOCIAL` - Messages from social networks
- `CATEGORY_PROMOTIONS` - Marketing emails and promotions
- `CATEGORY_UPDATES` - Notifications, confirmations, receipts
- `CATEGORY_FORUMS` - Messages from mailing lists or forums

You can find the complete list in the [Gmail API documentation](https://developers.google.com/gmail/api/guides/labels).

---

## Roadmap

*   ✅ **Gmail Integration (OAuth2)**
*   ✅ **Integrated OAuth Flow**
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
