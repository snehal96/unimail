# Unimail

> 📬 Unified Node.js SDK to fetch and parse emails from Gmail, Outlook, and IMAP servers.

**Status: Beta Version**

Unimail is an open-source Node.js library that provides a standardized way to fetch emails, parse attachments, and normalize metadata across multiple email providers. With its unified API, you can seamlessly integrate with Gmail, Outlook/Microsoft 365, and IMAP servers using the same interface.

---

## Features

*   **🔧 Unified Interface:** Consistent `fetchEmails()` API across all email providers
*   **📧 Multiple Provider Support:**
    *   **Gmail Integration:** Full OAuth2 support with Gmail API
    *   **Outlook/Microsoft 365 Integration:** Complete integration using Microsoft Graph API
    *   **IMAP Support:** Direct IMAP server connection for Yahoo, custom mail servers
*   **🔐 Integrated OAuth Flow:** Built-in OAuth authentication with browser-based flows
*   **📎 Advanced Attachment Handling:** 
    *   Extract attachments as Buffers with metadata (filename, MIME type, size)
    *   Automatic inline image filtering based on content IDs
    *   Support for large attachment processing
*   **🏷️ Email Normalization:** 
    *   Standardized schema across all providers
    *   Gmail labels and Outlook categories unified as `labels` field
    *   Consistent date, sender, recipient handling
*   **📄 Pagination Support:** Complete pagination with `nextPageToken` for handling large email volumes
*   **🔍 Advanced Search & Filtering:**
    *   Date range queries (`since`, `before`)
    *   Provider-specific search queries
    *   Unread-only filtering
    *   Custom label/category filtering
*   **⚡ Performance Options:**
    *   Multiple fetch formats (`raw`, `full`, `metadata`)
    *   Configurable inclusion of body content and attachments
    *   Batch processing capabilities
*   **🛡️ TypeScript Support:** Full type definitions for better development experience
*   **🔌 Extensible Architecture:** Plugin-based adapter system for new providers

---

## Installation

```bash
npm install unimail
# or
yarn add unimail
```

---

## Quick Start Guide

### Gmail Integration

#### Prerequisites

1. **Create a Google Cloud Platform (GCP) Project:**
   * Enable the **Gmail API**
   * Create **OAuth 2.0 Client ID** credentials
   * Add `http://localhost:3000/oauth/callback` to "Authorized redirect URIs"

2. **Environment Variables:**
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REFRESH_TOKEN=your_refresh_token_after_oauth
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
   ```

#### Method 1: Using Built-in OAuth Flow (Recommended)

```typescript
import { GmailAdapter } from 'unimail';
import dotenv from 'dotenv';

dotenv.config();

async function authenticateGmail() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

  // Start OAuth flow - opens browser automatically
  await GmailAdapter.startOAuthFlow(
    GOOGLE_CLIENT_ID!,
    GOOGLE_CLIENT_SECRET!,
    GOOGLE_REDIRECT_URI!
  );
  
  // Save the displayed refresh token to your .env file
}

authenticateGmail();
```

#### Method 2: Using Existing Refresh Token

```typescript
import { GmailAdapter, FetchOptions } from 'unimail';
import dotenv from 'dotenv';

dotenv.config();

async function fetchGmailEmails() {
  const gmailAdapter = new GmailAdapter();
  
  await gmailAdapter.initialize({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN!,
  });

  const { emails, nextPageToken, totalCount } = await gmailAdapter.fetchEmails({
    limit: 20,
    query: 'has:attachment',
    since: '2024-01-01',
    includeBody: true,
    includeAttachments: true,
  });

  console.log(`Fetched ${emails.length} emails`);
  if (nextPageToken) {
    console.log('More emails available');
  }

  emails.forEach(email => {
    console.log(`Subject: ${email.subject}`);
    console.log(`From: ${email.from}`);
    console.log(`Labels: ${email.labels?.join(', ')}`);
    console.log(`Attachments: ${email.attachments.length}`);
  });
}

fetchGmailEmails();
```

### Outlook/Microsoft 365 Integration

#### Prerequisites

1. **Register Application in Azure Portal:**
   * Go to [Azure Portal > App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
   * Create new registration with redirect URI: `http://localhost:3000/oauth/oauth2callback`
   * Add API permissions: `Mail.Read`, `offline_access`, `User.Read`
   * Create client secret

2. **Environment Variables:**
   ```env
   MICROSOFT_CLIENT_ID=your_client_id
   MICROSOFT_CLIENT_SECRET=your_client_secret
   MICROSOFT_REFRESH_TOKEN=your_refresh_token_after_oauth
   MICROSOFT_REDIRECT_URI=http://localhost:3000/oauth/oauth2callback
   MICROSOFT_TENANT_ID=optional_tenant_id
   ```

#### OAuth Flow Example

```typescript
import { OutlookAdapter } from 'unimail';
import dotenv from 'dotenv';

dotenv.config();

async function authenticateOutlook() {
  const { 
    MICROSOFT_CLIENT_ID, 
    MICROSOFT_CLIENT_SECRET, 
    MICROSOFT_REDIRECT_URI,
    MICROSOFT_TENANT_ID 
  } = process.env;

  // Start OAuth flow
  await OutlookAdapter.startOAuthFlow(
    MICROSOFT_CLIENT_ID!,
    MICROSOFT_CLIENT_SECRET!,
    MICROSOFT_REDIRECT_URI!,
    MICROSOFT_TENANT_ID // Optional
  );
}

authenticateOutlook();
```

#### Fetching Outlook Emails

```typescript
import { OutlookAdapter, FetchOptions } from 'unimail';
import dotenv from 'dotenv';

dotenv.config();

async function fetchOutlookEmails() {
  const outlookAdapter = new OutlookAdapter();
  
  await outlookAdapter.initialize({
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    refreshToken: process.env.MICROSOFT_REFRESH_TOKEN!,
  });

  const { emails } = await outlookAdapter.fetchEmails({
    limit: 15,
    includeBody: true,
    includeAttachments: true,
    since: new Date('2024-01-01'),
  });

  emails.forEach(email => {
    console.log(`Subject: ${email.subject || '(No subject)'}`);
    console.log(`From: ${email.from}`);
    console.log(`Categories: ${email.labels?.join(', ') || 'None'}`);
    console.log(`Date: ${email.date.toLocaleString()}`);
  });
}

fetchOutlookEmails();
```

### IMAP Integration

Perfect for Yahoo Mail, custom mail servers, and other IMAP-compatible providers:

```typescript
import { ImapAdapter } from 'unimail';

async function fetchImapEmails() {
  const imapAdapter = new ImapAdapter({
    host: 'imap.mail.yahoo.com',
    port: 993,
    secure: true,
    auth: {
      user: 'your-email@yahoo.com',
      pass: 'your-app-password', // Use app-specific password
    },
  });

  const emails = await imapAdapter.fetchEmails({
    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    limit: 10,
    mailbox: 'INBOX'
  });

  emails.forEach(email => {
    console.log(`Subject: ${email.subject}`);
    console.log(`From: ${email.from}`);
    console.log(`Attachments: ${email.attachments.length}`);
  });
}

fetchImapEmails();
```

---

## Advanced Usage Examples

### Working with Gmail Labels

```typescript
import { GmailAdapter } from 'unimail';

async function workWithLabels() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);

  // Search by specific labels
  const { emails } = await gmailAdapter.fetchEmails({
    query: 'label:important label:inbox',
    limit: 20
  });

  // Group emails by label
  const emailsByLabel = new Map();
  emails.forEach(email => {
    email.labels?.forEach(label => {
      if (!emailsByLabel.has(label)) {
        emailsByLabel.set(label, []);
      }
      emailsByLabel.get(label).push(email);
    });
  });

  // Find emails with multiple specific labels
  const importantInboxEmails = emails.filter(email => 
    email.labels?.includes('INBOX') && 
    email.labels?.includes('IMPORTANT')
  );

  console.log(`Found ${importantInboxEmails.length} important inbox emails`);
}
```

### Working with Outlook Categories

```typescript
import { OutlookAdapter } from 'unimail';

async function workWithCategories() {
  const outlookAdapter = new OutlookAdapter();
  await outlookAdapter.initialize(credentials);

  const { emails } = await outlookAdapter.fetchEmails({
    limit: 30,
    includeBody: false, // Faster fetching
  });

  // Group by categories (normalized as labels)
  const emailsByCategory = new Map();
  emails.forEach(email => {
    const categories = email.labels || ['UNCATEGORIZED'];
    categories.forEach(category => {
      if (!emailsByCategory.has(category)) {
        emailsByCategory.set(category, []);
      }
      emailsByCategory.get(category).push(email);
    });
  });

  // Display category distribution
  for (const [category, categoryEmails] of emailsByCategory.entries()) {
    console.log(`${category}: ${categoryEmails.length} emails`);
  }
}
```

### Advanced Pagination

```typescript
async function paginationExample() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);

  let allEmails = [];
  let pageToken = undefined;
  
  do {
    const { emails, nextPageToken } = await gmailAdapter.fetchEmails({
      limit: 50,
      pageToken,
      query: 'has:attachment',
      includeBody: false, // Faster processing
    });
    
    allEmails.push(...emails);
    pageToken = nextPageToken;
    
    console.log(`Fetched ${emails.length} emails, total: ${allEmails.length}`);
  } while (pageToken);

  console.log(`Total emails with attachments: ${allEmails.length}`);
}
```

### Date Range Queries

```typescript
async function dateRangeExample() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);

  // Method 1: Using since/before parameters
  const { emails: recentEmails } = await gmailAdapter.fetchEmails({
    since: '2024-01-01',
    before: '2024-03-31',
    limit: 100
  });

  // Method 2: Using Gmail search syntax
  const { emails: searchEmails } = await gmailAdapter.fetchEmails({
    query: 'after:2024/01/01 before:2024/03/31 has:attachment',
    limit: 100
  });

  // Method 3: Using Date objects
  const { emails: dateEmails } = await gmailAdapter.fetchEmails({
    since: new Date('2024-01-01'),
    before: new Date('2024-03-31'),
    limit: 100
  });
}
```

### Performance Optimization

```typescript
async function performanceExample() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);

  // Metadata only - Fastest for listing
  const { emails: metadataOnly } = await gmailAdapter.fetchEmails({
    format: 'metadata',
    limit: 100,
    includeBody: false,
    includeAttachments: false
  });

  // Full format - Structured but faster than raw
  const { emails: fullFormat } = await gmailAdapter.fetchEmails({
    format: 'full',
    limit: 20,
    includeBody: true,
    includeAttachments: false
  });

  // Raw format - Most complete but slower
  const { emails: rawFormat } = await gmailAdapter.fetchEmails({
    format: 'raw',
    limit: 10,
    includeBody: true,
    includeAttachments: true
  });
}
```

### Attachment Processing

```typescript
import * as fs from 'fs';
import * as path from 'path';

async function processAttachments() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);

  const { emails } = await gmailAdapter.fetchEmails({
    query: 'has:attachment filename:pdf',
    limit: 10,
    includeAttachments: true
  });

  const attachmentsDir = './downloads';
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir);
  }

  emails.forEach(email => {
    email.attachments.forEach(attachment => {
      if (attachment.buffer && attachment.mimeType === 'application/pdf') {
        const filePath = path.join(attachmentsDir, 
          `${email.id}_${attachment.filename}`);
        fs.writeFileSync(filePath, attachment.buffer);
        console.log(`Saved PDF: ${filePath}`);
      }
    });
  });
}
```

---

## 🚀 Email Streaming (Recommended for Large Datasets)

### ⚠️ Memory Issues with Traditional Approach

```typescript
// ❌ This can crash your application with large datasets
const { emails } = await gmailAdapter.fetchEmails({
  limit: 10000,           // 😱 10,000 emails loaded into memory
  getAllPages: true,      // 😱 loads everything at once
  includeAttachments: true
});

// Problems:
// - 2GB+ memory usage for 10k emails
// - Potential out-of-memory crashes
// - No progress feedback
// - All-or-nothing processing
```

### ✅ Streaming Solutions

Unimail's streaming functionality processes emails in small batches, providing **constant memory usage** regardless of dataset size.

#### Method 1: Simple Streaming with AsyncIterator (Recommended)

```typescript
async function processEmailsStream() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);
  
  let totalProcessed = 0;
  
  // ✅ Process emails in batches of 50 - only ~10MB memory usage
  for await (const emailBatch of gmailAdapter.streamEmails({ 
    batchSize: 50,
    query: 'has:attachment',
    maxEmails: 10000  // Optional limit
  })) {
    console.log(`Processing batch of ${emailBatch.length} emails...`);
    
    // Process each email in this batch
    for (const email of emailBatch) {
      await processEmail(email);
      totalProcessed++;
    }
    
    console.log(`Processed ${totalProcessed} emails so far...`);
    // Memory automatically freed after each batch
  }
  
  console.log(`✅ Completed! Processed ${totalProcessed} emails total`);
}
```

#### Method 2: Progress Tracking with Callbacks

```typescript
async function processWithProgress() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);
  
  await gmailAdapter.fetchEmailsStream({
    batchSize: 30,
    query: 'is:unread',
    includeBody: false  // Faster processing
  }, {
    onBatch: async (emails, progress) => {
      console.log(`Batch ${progress.batchCount}: ${emails.length} emails`);
      console.log(`Progress: ${progress.current}/${progress.total} (${
        Math.round((progress.current / progress.total!) * 100)
      }%)`);
      
      // Process this batch
      for (const email of emails) {
        await processEmail(email);
      }
    },
    
    onProgress: async (progress) => {
      // Real-time progress updates
      if (progress.current % 100 === 0) {
        console.log(`📊 Processed ${progress.current} emails so far...`);
      }
    },
    
    onError: async (error, progress) => {
      console.error(`❌ Error at batch ${progress.batchCount}:`, error);
      // Implement retry logic or continue with next batch
    },
    
    onComplete: async (summary) => {
      console.log(`✅ Completed! Processed ${summary.totalProcessed} emails in ${summary.duration}ms`);
      console.log(`Average rate: ${(summary.totalProcessed / (summary.duration / 1000)).toFixed(1)} emails/sec`);
    }
  });
}
```

### Real-World Integration Patterns

#### Database Batch Operations

```typescript
async function syncEmailsToDatabase() {
  const emailsToInsert = [];
  let totalSynced = 0;
  
  for await (const emailBatch of gmailAdapter.streamEmails({ batchSize: 50 })) {
    // Accumulate emails for bulk insert
    emailsToInsert.push(...emailBatch.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      date: email.date
    })));
    
    // Bulk insert every 100 emails
    if (emailsToInsert.length >= 100) {
      await db.emails.insertMany(emailsToInsert);
      totalSynced += emailsToInsert.length;
      console.log(`Synced ${totalSynced} emails to database`);
      emailsToInsert.length = 0; // Clear memory
    }
  }
  
  // Insert remaining emails
  if (emailsToInsert.length > 0) {
    await db.emails.insertMany(emailsToInsert);
    totalSynced += emailsToInsert.length;
  }
  
  console.log(`Total synced: ${totalSynced} emails`);
}
```

#### Express.js API with Real-time Updates

```typescript
app.post('/api/sync-emails', async (req, res) => {
  // Set up Server-Sent Events for real-time progress
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  let totalProcessed = 0;
  
  try {
    for await (const emailBatch of gmailAdapter.streamEmails({ batchSize: 25 })) {
      // Process batch
      for (const email of emailBatch) {
        await processEmailForUser(email, req.body.userId);
        totalProcessed++;
      }
      
      // Send progress update to frontend
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        processed: totalProcessed,
        batch: emailBatch.length
      })}\n\n`);
    }
    
    // Send completion
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      total: totalProcessed
    })}\n\n`);
    
  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message
    })}\n\n`);
  } finally {
    res.end();
  }
});
```

### Memory Usage Comparison

| Dataset Size | Traditional Approach | Streaming Approach |
|--------------|---------------------|-------------------|
| **1,000 emails** | ~200MB memory | ~10MB memory ✅ |
| **10,000 emails** | ~2GB memory ⚠️ | ~10MB memory ✅ |
| **100,000 emails** | ~20GB memory 💥 | ~10MB memory ✅ |

### Configuration Options

```typescript
interface EmailStreamOptions {
  batchSize?: number;           // Emails per batch (default: 50)
  maxEmails?: number;           // Max total emails to process
  query?: string;               // Provider-specific search
  since?: Date | string;        // Emails after this date
  before?: Date | string;       // Emails before this date
  includeBody?: boolean;        // Include email body (default: true)
  includeAttachments?: boolean; // Include attachments (default: true)
  format?: 'raw' | 'full' | 'metadata'; // Fetch format
  pageToken?: string;           // Resume from specific point
}
```

### Performance Recommendations

```typescript
// ⚡ For metadata only (fastest)
{ batchSize: 100, includeBody: false, includeAttachments: false, format: 'metadata' }

// ⚖️ Balanced performance  
{ batchSize: 50, includeBody: true, includeAttachments: false, format: 'full' }

// 🔍 Complete data (slower)
{ batchSize: 25, includeBody: true, includeAttachments: true, format: 'raw' }
```

### Migration Guide

#### Before (Memory Problems)
```typescript
// ❌ Can cause out-of-memory errors
const { emails } = await adapter.fetchEmails({ 
  limit: 10000, 
  getAllPages: true 
});

for (const email of emails) {
  await processEmail(email);
}
```

#### After (Memory Efficient)
```typescript
// ✅ Constant memory usage, real-time progress
for await (const emailBatch of adapter.streamEmails({ 
  batchSize: 50,
  maxEmails: 10000 
})) {
  for (const email of emailBatch) {
    await processEmail(email);
  }
}
```

### Error Handling & Recovery

```typescript
async function processWithRecovery() {
  let lastProcessedId: string | undefined;
  
  try {
    for await (const emailBatch of gmailAdapter.streamEmails({ 
      batchSize: 50,
      pageToken: getLastCheckpoint() // Resume from saved position
    })) {
      try {
        for (const email of emailBatch) {
          await processEmail(email);
          lastProcessedId = email.id;
          await saveCheckpoint(email.id); // Save progress
        }
      } catch (batchError) {
        console.error('Batch failed:', batchError);
        // Continue with next batch or implement retry logic
      }
    }
  } catch (error) {
    console.error('Stream failed, can resume from:', lastProcessedId);
    // Save checkpoint for resumption
  }
}
```

### Key Benefits

✅ **Memory Efficient** - Constant ~10MB usage regardless of dataset size  
✅ **Real-time Progress** - Live updates and percentage completion  
✅ **Error Resilient** - Continue processing after failures  
✅ **Scalable** - Handle millions of emails without memory issues  
✅ **Flexible** - Multiple integration patterns for different use cases  

> **💡 Tip:** For large datasets (>1,000 emails), always use streaming methods instead of `getAllPages: true` to avoid memory issues.

---

## API Reference

### Common Interfaces

#### `FetchOptions`

```typescript
interface FetchOptions {
  limit?: number;                    // Max emails to fetch (default: 10)
  since?: Date | string;             // Emails after this date
  before?: Date | string;            // Emails before this date
  query?: string;                    // Provider-specific search
  includeBody?: boolean;             // Include text/HTML body (default: true)
  includeAttachments?: boolean;      // Include attachment buffers (default: true)
  unreadOnly?: boolean;              // Only unread emails
  format?: 'raw' | 'full' | 'metadata'; // Fetch format
  pageToken?: string;                // Pagination token
  pageSize?: number;                 // Items per page
  getAllPages?: boolean;             // Auto-fetch all pages
}
```

#### `NormalizedEmail`

```typescript
interface NormalizedEmail {
  id: string;                        // Provider-specific ID
  threadId?: string;                 // Thread/conversation ID
  provider: 'gmail' | 'outlook' | 'imap' | 'unknown';
  from: string;                      // Sender email
  to: string[];                      // Recipients
  cc?: string[];                     // CC recipients
  bcc?: string[];                    // BCC recipients
  subject?: string;                  // Email subject
  date: Date;                        // Received date
  bodyText?: string;                 // Plain text content
  bodyHtml?: string;                 // HTML content
  attachments: Attachment[];         // Attachments array
  labels?: string[];                 // Labels/categories
  raw?: any;                         // Raw provider response
}
```

#### `Attachment`

```typescript
interface Attachment {
  filename: string;                  // File name
  mimeType: string;                  // MIME type
  size: number;                      // Size in bytes
  buffer?: Buffer;                   // File content
  contentId?: string;                // For inline attachments
}
```

### GmailAdapter

#### Static Methods

```typescript
// Start OAuth flow
static async startOAuthFlow(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  port?: number,
  callbackPath?: string
): Promise<string>

// Handle OAuth callback manually
static async handleOAuthCallback(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{accessToken: string, refreshToken?: string}>
```

#### Instance Methods

```typescript
// Initialize with credentials
async initialize(credentials: GmailCredentials): Promise<void>

// Authenticate (called automatically by fetchEmails)
async authenticate(): Promise<void>

// Fetch emails
async fetchEmails(options: FetchOptions): Promise<PaginatedEmailsResponse>
```

### OutlookAdapter

#### Static Methods

```typescript
// Start OAuth flow
static async startOAuthFlow(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tenantId?: string,
  port?: number,
  callbackPath?: string
): Promise<string>

// Handle OAuth callback manually
static async handleOAuthCallback(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tenantId?: string
): Promise<{accessToken: string, refreshToken?: string}>
```

#### Instance Methods

```typescript
// Initialize with credentials
async initialize(credentials: OutlookCredentials): Promise<void>

// Authenticate (called automatically by fetchEmails)
async authenticate(): Promise<void>

// Fetch emails
async fetchEmails(options: FetchOptions): Promise<PaginatedEmailsResponse>
```

### ImapAdapter

```typescript
// Constructor
constructor(config: ImapFlowOptions)

// Fetch emails
async fetchEmails(options: {
  since?: Date;
  limit?: number;
  mailbox?: string;
}): Promise<NormalizedEmail[]>

// Close connection
async close(): Promise<void>
```

---

## OAuth Service (Advanced)

For more control over the OAuth flow:

```typescript
import { OAuthService, GoogleOAuthProvider, OutlookOAuthProvider } from 'unimail';

// Google OAuth
const googleOAuth = new OAuthService(new GoogleOAuthProvider());
const authUrl = await googleOAuth.startOAuthFlow({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'your-redirect-uri',
  scopes: ['https://mail.google.com/'],
  accessType: 'offline',
  prompt: 'consent'
});

// Microsoft OAuth
const outlookOAuth = new OAuthService(new OutlookOAuthProvider());
const outlookAuthUrl = await outlookOAuth.startOAuthFlow({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'your-redirect-uri',
  scopes: ['Mail.Read', 'offline_access'],
  prompt: 'consent'
});
```

---

## Provider-Specific Features

### Gmail

- **System Labels:** `INBOX`, `SENT`, `DRAFT`, `SPAM`, `TRASH`, `IMPORTANT`
- **Category Labels:** `CATEGORY_PERSONAL`, `CATEGORY_SOCIAL`, `CATEGORY_PROMOTIONS`, `CATEGORY_UPDATES`, `CATEGORY_FORUMS`
- **Search Operators:** `has:attachment`, `filename:pdf`, `from:sender@example.com`, `label:important`
- **Advanced Queries:** `after:2024/01/01 before:2024/12/31 has:attachment filename:pdf`

### Outlook

- **Categories:** User-defined categories appear in the `labels` field
- **Search:** Text-based search across subject, body, and sender
- **Date Filtering:** Native support for `since` and `before` parameters
- **Graph API:** Full Microsoft Graph API features available

### IMAP

- **Mailbox Support:** Access different mailboxes (INBOX, Sent, Drafts, etc.)
- **Date-based Fetching:** Efficient server-side date filtering
- **Universal Compatibility:** Works with Yahoo, custom servers, and most email providers

---

## Error Handling

```typescript
try {
  const { emails } = await gmailAdapter.fetchEmails(options);
} catch (error) {
  if (error.message.includes('invalid_grant')) {
    console.error('Refresh token expired or revoked');
    // Re-run OAuth flow
  } else if (error.message.includes('quota')) {
    console.error('API quota exceeded');
    // Implement rate limiting
  } else {
    console.error('General error:', error.message);
  }
}
```

---

## Best Practices

### 1. Authentication Management
```typescript
// Store refresh tokens securely
// Implement token refresh handling
// Use environment variables for credentials
```

### 2. Performance Optimization
```typescript
// Use appropriate format for your needs
format: 'metadata', // Fastest - headers only
format: 'full',     // Balanced - structured content
format: 'raw',      // Complete - full email parsing

// Disable unnecessary features
includeBody: false,        // Skip body parsing
includeAttachments: false, // Skip attachment processing
```

### 3. Pagination for Large Datasets
```typescript
// Always implement pagination for production
const getAllEmails = async () => {
  let allEmails = [];
  let pageToken = undefined;
  
  do {
    const { emails, nextPageToken } = await adapter.fetchEmails({
      pageToken,
      limit: 100
    });
    allEmails.push(...emails);
    pageToken = nextPageToken;
  } while (pageToken);
  
  return allEmails;
};
```

### 4. Attachment Handling
```typescript
// Filter attachments by type and size
const processAttachments = (emails) => {
  emails.forEach(email => {
    const pdfs = email.attachments.filter(att => 
      att.mimeType === 'application/pdf' && 
      att.size < 10 * 1024 * 1024 // < 10MB
    );
    
    // Process filtered attachments
    pdfs.forEach(pdf => {
      if (pdf.buffer) {
        // Save or process PDF
      }
    });
  });
};
```

---

## Contributing

Contributions are welcome! Please feel free to submit issues, fork the repository, and create pull requests.

### Development Setup

```bash
git clone https://github.com/snehal96/unimail.git
cd unimail
npm install
npm run build
npm test
```

---

## License

[MIT](LICENSE)

---

## Support

- 📧 **Issues:** [GitHub Issues](https://github.com/snehal96/unimail/issues)
- 📖 **Documentation:** [GitHub Repository](https://github.com/snehal96/unimail)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/snehal96/unimail/discussions)
