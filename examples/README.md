# Unimail Examples

This directory contains comprehensive examples demonstrating how to use Unimail's features.

## Available Examples

### Basic Usage
- **`gmailExample.ts`** - Basic Gmail integration and email fetching
- **`outlookExample.ts`** - Basic Outlook/Microsoft 365 integration
- **`imapExample.ts`** - IMAP server integration

### Advanced Features
- **`paginationExample.ts`** - Comprehensive pagination examples with all methods
- **`streamingExample.ts`** - Email streaming for large datasets
- **`labelsExample.ts`** - Working with Gmail labels and Outlook categories
- **`gmailSyncExample.ts`** - Gmail sync using History API

### Authentication
- **`authCodeExample.ts`** - OAuth authentication flow
- **`oauthFlowExample.ts`** - Complete OAuth setup
- **`outlookOAuthExample.ts`** - Outlook-specific OAuth

## Pagination Examples

The `paginationExample.ts` file demonstrates:

1. **Basic Manual Pagination** - Using pageToken to navigate pages
2. **PaginationHelper** - Using the new utility class for easy navigation
3. **Automatic All-Pages Fetching** - Fetching all pages automatically
4. **Pagination with Search and Filters** - Advanced queries with pagination
5. **Async Iterator** - Processing large datasets efficiently
6. **API Response Builder** - Building paginated API responses

## Running Examples

1. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run an example:**
   ```bash
   npx ts-node examples/paginationExample.ts
   npx ts-node examples/gmailExample.ts
   npx ts-node examples/outlookExample.ts
   ```

## Environment Variables

Create a `.env` file in the project root:

```env
# Gmail
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback

# Outlook
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_REFRESH_TOKEN=your_refresh_token
MICROSOFT_REDIRECT_URI=http://localhost:3000/oauth/oauth2callback
MICROSOFT_TENANT_ID=your_tenant_id

# IMAP
IMAP_HOST=imap.example.com
IMAP_PORT=993
IMAP_USERNAME=your_username
IMAP_PASSWORD=your_password
```

## Pagination Quick Start

```typescript
import { GmailAdapter, createPaginationHelper } from 'unimail';

// Simple pagination
const { emails, nextPageToken } = await gmailAdapter.fetchEmails({
  pageSize: 20,
  pageToken: undefined, // First page
});

// Using PaginationHelper
const paginationHelper = createPaginationHelper(gmailAdapter, {
  pageSize: 15,
  query: 'label:inbox',
});

const page1 = await paginationHelper.fetchCurrentPage();
const page2 = await paginationHelper.fetchNextPage();
const backToPage1 = await paginationHelper.fetchPreviousPage();

// Automatic all-pages fetching
const { emails: allEmails } = await gmailAdapter.fetchEmails({
  limit: 100,
  getAllPages: true,
});
```

## Tips

- Use `includeBody: false` and `includeAttachments: false` for faster pagination
- Use `pageSize` between 10-50 for optimal performance
- The `PaginationHelper` class automatically manages page tokens and navigation
- Use async iterators for processing very large datasets without memory issues
- All examples include error handling and authentication setup 