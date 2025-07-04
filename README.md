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
*   **📄 Enhanced Pagination Support:** 
    *   Complete pagination with `nextPageToken` for handling large email volumes
    *   New `PaginationHelper` utility for easy navigation
    *   Automatic all-pages fetching with `getAllPages` option
    *   Cursor-based pagination with metadata (current page, total pages, etc.)
    *   Async iterators for processing large datasets
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

Unimail provides comprehensive pagination support with multiple approaches for different use cases:

#### 1. Basic Manual Pagination

```typescript
async function basicPagination() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);

  let pageToken = undefined;
  let pageNumber = 1;
  
  do {
    const { emails, nextPageToken, totalCount } = await gmailAdapter.fetchEmails({
      pageSize: 20,        // Emails per page
      pageToken,           // Token for current page
      query: 'has:attachment',
      includeBody: false,  // Faster processing
    });
    
    console.log(`Page ${pageNumber}: ${emails.length} emails`);
    if (totalCount) {
      console.log(`Total available: ~${totalCount} emails`);
    }
    
    pageToken = nextPageToken;
    pageNumber++;
    
  } while (pageToken);
}
```

#### 2. Using PaginationHelper (Recommended)

```typescript
import { GmailAdapter, createPaginationHelper } from 'unimail';

async function paginationHelperExample() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);

  // Create pagination helper
  const paginationHelper = createPaginationHelper(gmailAdapter, {
    pageSize: 15,
    query: 'label:inbox',
    includeBody: false,
    includeAttachments: false,
  });

  // Navigate through pages
  const page1 = await paginationHelper.fetchCurrentPage();
  console.log(`Page 1: ${page1.data.length} emails`);
  console.log(`Has next page: ${page1.pagination.hasNextPage}`);

  if (page1.pagination.hasNextPage) {
    const page2 = await paginationHelper.fetchNextPage();
    console.log(`Page 2: ${page2?.data.length} emails`);
    
    // Go back to previous page
    if (page2?.pagination.hasPreviousPage) {
      const backToPage1 = await paginationHelper.fetchPreviousPage();
      console.log(`Back to Page 1: ${backToPage1?.data.length} emails`);
    }
  }
}
```

#### 3. Automatic All-Pages Fetching

```typescript
async function fetchAllPages() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);

  const { emails, totalCount } = await gmailAdapter.fetchEmails({
    limit: 100,          // Maximum total emails to fetch
    pageSize: 25,        // Emails per API call
    getAllPages: true,   // Automatically fetch all pages
    query: 'has:attachment',
    includeBody: false,
  });

  console.log(`Fetched ${emails.length} emails total across all pages`);
  console.log(`Total available: ~${totalCount} emails`);
}
```

#### 4. Async Iterator for Large Datasets

```typescript
async function processLargeDataset() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);

  const paginationHelper = createPaginationHelper(gmailAdapter, {
    pageSize: 50,
    query: 'label:inbox',
    includeBody: false,
  });

  let totalProcessed = 0;
  
  // Process each page as it's fetched
  for await (const page of paginationHelper.iterateAllPages()) {
    console.log(`Processing page ${page.pagination.currentPage}: ${page.data.length} emails`);
    
    // Process emails in this page
    page.data.forEach(email => {
      // Your processing logic here
      totalProcessed++;
    });
  }

  console.log(`Processed ${totalProcessed} emails total`);
}
```

#### 5. Building Paginated API Responses

```typescript
import { PaginationUtils } from 'unimail';

async function buildPaginatedAPI(request: {
  page?: number;
  pageSize?: number;
  query?: string;
  pageToken?: string;
}) {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);

  const { emails, nextPageToken, totalCount } = await gmailAdapter.fetchEmails({
    pageSize: request.pageSize || 20,
    pageToken: request.pageToken,
    query: request.query || '',
    includeBody: true,
    includeAttachments: false,
  });

  // Calculate pagination metadata
  const currentPage = request.page || 1;
  const pagination = PaginationUtils.calculatePaginationMetadata(
    currentPage,
    request.pageSize || 20,
    totalCount,
    !!nextPageToken,
    currentPage > 1
  );

  return {
    status: 'success',
    data: emails,
    pagination: {
      ...pagination,
      nextPageToken,
    },
    metadata: {
      query: request.query,
      fetchTime: new Date().toISOString(),
      totalFetched: emails.length,
    },
  };
}
```

#### Pagination Options

| Option | Description | Default |
|--------|-------------|---------|
| `pageSize` | Number of emails per page | 20 |
| `pageToken` | Token for fetching specific page | `undefined` |
| `limit` | Maximum total emails to fetch | No limit |
| `getAllPages` | Automatically fetch all pages up to limit | `false` |

#### Pagination Response

```typescript
interface PaginationMetadata {
  currentPage: number;
  pageSize: number;
  totalCount?: number;
  estimatedTotalPages?: number;
  nextPageToken?: string;
  previousPageToken?: string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFirstPage: boolean;
  isLastPage: boolean;
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

## 🔄 Gmail Sync & Real-time Updates

### Overview

Gmail sync capabilities enable real-time synchronization with Gmail accounts using the Gmail History API and Push Notifications. This allows you to:

- **Track Changes**: Monitor additions, deletions, and label changes in real-time
- **Efficient Sync**: Only fetch changes since the last sync, not all emails
- **Push Notifications**: Receive instant webhooks when changes occur
- **Persistent State**: Maintain sync state across application restarts

### Quick Start

```typescript
import { GmailAdapter } from 'unimail';

const gmailAdapter = new GmailAdapter();
await gmailAdapter.initialize(credentials);

// 1. Get starting point for sync
const historyId = await gmailAdapter.getCurrentHistoryId();
console.log(`Starting sync from history ID: ${historyId}`);

// 2. Later, check for changes
const syncResult = await gmailAdapter.processSync({
  startHistoryId: historyId,
  maxResults: 50
});

console.log(`Found ${syncResult.addedEmails.length} new emails`);
console.log(`${syncResult.deletedEmailIds.length} emails deleted`);
console.log(`${syncResult.updatedEmails.length} emails updated`);
```

### Core Sync Methods

#### `getCurrentHistoryId(): Promise<string>`
Get the current history ID to start tracking changes.

```typescript
const historyId = await gmailAdapter.getCurrentHistoryId();
// Store this ID to track future changes
```

#### `getHistory(startHistoryId: string, options?: SyncOptions): Promise<HistoryResponse>`
Get raw history records since a specific history ID.

```typescript
const historyResponse = await gmailAdapter.getHistory(startHistoryId, {
  maxResults: 100,
  labelIds: ['INBOX'],
  includeDeleted: true
});

// Process individual history records
for (const record of historyResponse.history) {
  if (record.messagesAdded) {
    console.log(`${record.messagesAdded.length} messages added`);
  }
  if (record.messagesDeleted) {
    console.log(`${record.messagesDeleted.length} messages deleted`);
  }
}
```

#### `getEmailById(id: string): Promise<NormalizedEmail | null>`
Fetch a specific email by ID (useful for processing history records).

```typescript
const email = await gmailAdapter.getEmailById('18c2e1b2d4f5a3b1');
if (email) {
  console.log(`Email: ${email.subject} from ${email.from}`);
}
```

#### `processSync(options: SyncOptions): Promise<SyncResult>`
High-level method that processes history and returns structured results.

```typescript
const syncResult = await gmailAdapter.processSync({
  startHistoryId: lastKnownHistoryId,
  maxResults: 50,
  includeDeleted: true
});

// Process new emails
for (const email of syncResult.addedEmails) {
  await processNewEmail(email);
}

// Handle deletions
for (const deletedId of syncResult.deletedEmailIds) {
  await removeEmailFromDatabase(deletedId);
}

// Handle updates (label changes)
for (const email of syncResult.updatedEmails) {
  await updateEmailLabels(email.id, email.labels);
}

// Update your sync state
lastKnownHistoryId = syncResult.newHistoryId;
```

### Push Notifications

Set up real-time push notifications to receive instant updates when changes occur.

#### Prerequisites
1. **Google Cloud Pub/Sub Topic**: Create a topic in Google Cloud Console
2. **Service Account**: Grant Gmail API publish permissions to the topic
3. **Webhook Endpoint**: Set up an HTTPS endpoint to receive notifications

#### Setup Push Notifications

```typescript
const pushSetup = await gmailAdapter.setupPushNotifications({
  topicName: 'projects/your-project-id/topics/gmail-push',
  webhookUrl: 'https://your-domain.com/webhook/gmail',
  labelIds: ['INBOX'], // Optional: only watch specific labels
  labelFilterAction: 'include'
});

console.log(`Push notifications active until: ${new Date(pushSetup.expiration * 1000)}`);
```

#### Webhook Handler

```typescript
import express from 'express';

const app = express();

app.post('/webhook/gmail', async (req, res) => {
  try {
    // Parse Pub/Sub message
    const message = req.body.message;
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    
    const { emailAddress, historyId } = data;
    console.log(`Changes detected for ${emailAddress} since ${historyId}`);
    
    // Trigger sync for this user
    await performSyncForUser(emailAddress, historyId);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});
```

### Real-World Sync Patterns

#### Continuous Background Sync

```typescript
class GmailSyncService {
  private syncState: Map<string, string> = new Map(); // userId -> historyId
  
  async startContinuousSync(userId: string, gmailAdapter: GmailAdapter) {
    // Initialize sync state
    if (!this.syncState.has(userId)) {
      const historyId = await gmailAdapter.getCurrentHistoryId();
      this.syncState.set(userId, historyId);
    }
    
    // Sync loop
    while (true) {
      try {
        const lastHistoryId = this.syncState.get(userId)!;
        const syncResult = await gmailAdapter.processSync({
          startHistoryId: lastHistoryId,
          maxResults: 50
        });
        
        // Process changes
        await this.processChanges(userId, syncResult);
        
        // Update state
        this.syncState.set(userId, syncResult.newHistoryId);
        
        // Wait before next sync if no more changes
        if (!syncResult.hasMoreChanges) {
          await this.sleep(30000); // 30 seconds
        }
        
      } catch (error) {
        console.error(`Sync error for user ${userId}:`, error);
        await this.sleep(60000); // Wait 1 minute on error
      }
    }
  }
  
  private async processChanges(userId: string, syncResult: SyncResult) {
    // Save new emails to database
    if (syncResult.addedEmails.length > 0) {
      await this.database.emails.insertMany(
        syncResult.addedEmails.map(email => ({
          userId,
          gmailId: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date,
          labels: email.labels
        }))
      );
    }
    
    // Remove deleted emails
    if (syncResult.deletedEmailIds.length > 0) {
      await this.database.emails.deleteMany({
        userId,
        gmailId: { $in: syncResult.deletedEmailIds }
      });
    }
    
    // Update labels for changed emails
    for (const email of syncResult.updatedEmails) {
      await this.database.emails.updateOne(
        { userId, gmailId: email.id },
        { $set: { labels: email.labels } }
      );
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### Express.js Integration with Real-time Updates

```typescript
import express from 'express';
import { GmailAdapter } from 'unimail';

const app = express();

// Server-Sent Events for real-time sync updates
app.get('/api/sync-status/:userId', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  const userId = req.params.userId;
  const gmailAdapter = await getGmailAdapterForUser(userId);
  
  // Start sync process
  const syncInterval = setInterval(async () => {
    try {
      const lastHistoryId = await getLastHistoryId(userId);
      const syncResult = await gmailAdapter.processSync({
        startHistoryId: lastHistoryId
      });
      
      // Send real-time updates
      res.write(`data: ${JSON.stringify({
        type: 'sync_complete',
        addedEmails: syncResult.addedEmails.length,
        deletedEmails: syncResult.deletedEmailIds.length,
        updatedEmails: syncResult.updatedEmails.length,
        timestamp: new Date()
      })}\n\n`);
      
      // Update stored history ID
      await saveHistoryId(userId, syncResult.newHistoryId);
      
    } catch (error) {
      res.write(`data: ${JSON.stringify({
        type: 'sync_error',
        error: error.message,
        timestamp: new Date()
      })}\n\n`);
    }
  }, 30000); // Check every 30 seconds
  
  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(syncInterval);
  });
});

// Manual sync trigger
app.post('/api/sync/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const gmailAdapter = await getGmailAdapterForUser(userId);
    const lastHistoryId = await getLastHistoryId(userId);
    
    const syncResult = await gmailAdapter.processSync({
      startHistoryId: lastHistoryId,
      maxResults: 100
    });
    
    await saveHistoryId(userId, syncResult.newHistoryId);
    
    res.json({
      success: true,
      addedEmails: syncResult.addedEmails.length,
      deletedEmails: syncResult.deletedEmailIds.length,
      updatedEmails: syncResult.updatedEmails.length,
      newHistoryId: syncResult.newHistoryId
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### Configuration Options

```typescript
interface SyncOptions {
  startHistoryId?: string;           // Start from specific history ID
  maxResults?: number;               // Max history records per request (default: 100)
  labelIds?: string[];               // Filter by specific labels
  includeDeleted?: boolean;          // Include deleted messages (default: true)
}

interface PushNotificationConfig {
  topicName: string;                 // Google Cloud Pub/Sub topic
  webhookUrl: string;                // Your webhook endpoint
  labelIds?: string[];               // Optional: only watch specific labels
  labelFilterAction?: 'include' | 'exclude'; // How to apply label filter
}
```

### Error Handling & Recovery

```typescript
async function robustSync(gmailAdapter: GmailAdapter, lastHistoryId: string) {
  try {
    return await gmailAdapter.processSync({
      startHistoryId: lastHistoryId
    });
  } catch (error) {
    // Handle expired history ID
    if (error.message.includes('too old or invalid')) {
      console.log('History ID expired, starting fresh sync...');
      const newHistoryId = await gmailAdapter.getCurrentHistoryId();
      
      // You might want to do a full re-sync here
      await performFullResync(gmailAdapter);
      
      return {
        processedHistoryRecords: 0,
        addedEmails: [],
        deletedEmailIds: [],
        updatedEmails: [],
        newHistoryId,
        hasMoreChanges: false
      };
    }
    
    // Handle rate limiting
    if (error.message.includes('Rate limit')) {
      console.log('Rate limited, waiting before retry...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      return robustSync(gmailAdapter, lastHistoryId);
    }
    
    throw error;
  }
}
```

### Performance Considerations

- **History Retention**: Gmail history is retained for ~1 week. Store history IDs promptly
- **Rate Limits**: Gmail API has quotas. Implement exponential backoff for retries
- **Batch Processing**: Process sync results in batches to avoid overwhelming your database
- **Push Notifications**: Expire after 7 days. Set up monitoring to renew automatically

### Key Benefits

✅ **Real-time Sync** - Get notified instantly when emails change  
✅ **Efficient** - Only fetch changes, not all emails  
✅ **Scalable** - Handle multiple users with separate sync states  
✅ **Resilient** - Built-in error handling and recovery  
✅ **Flexible** - Works with webhooks or polling patterns  

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

// Streaming methods
streamEmails(options: EmailStreamOptions): AsyncGenerator<NormalizedEmail[], void, unknown>
fetchEmailsStream(options: EmailStreamOptions, callbacks: EmailStreamCallbacks): Promise<void>

// Sync capabilities
getCurrentHistoryId(): Promise<string>
getHistory(startHistoryId: string, options?: SyncOptions): Promise<HistoryResponse>
getEmailById(id: string): Promise<NormalizedEmail | null>
setupPushNotifications(config: PushNotificationConfig): Promise<PushNotificationSetup>
stopPushNotifications(): Promise<void>
processSync(options?: SyncOptions): Promise<SyncResult>
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
