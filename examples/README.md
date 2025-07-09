# Unimail Examples

This directory contains practical examples demonstrating how to use Unimail with different email providers and scenarios.

## Quick Start

1. **Set up environment variables** by copying `.env.example` to `.env` and filling in your credentials:
   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run any example**:
   ```bash
   npx ts-node examples/gmailExample.ts
   npx ts-node examples/outlookExample.ts
   npx ts-node examples/paginationExample.ts
   ```

## Examples Overview

### Basic Provider Examples
- **[gmailExample.ts](./gmailExample.ts)** - Basic Gmail integration with OAuth
- **[outlookExample.ts](./outlookExample.ts)** - Basic Outlook integration with OAuth
- **[imapExample.ts](./imapExample.ts)** - IMAP server integration

### OAuth and Authentication
- **[oauthFlowExample.ts](./oauthFlowExample.ts)** - Complete OAuth flow implementation
- **[gmailOAuthExample.ts](./gmailOAuthExample.ts)** - Gmail-specific OAuth setup
- **[outlookOAuthExample.ts](./outlookOAuthExample.ts)** - Outlook-specific OAuth setup
- **[getRefreshToken.ts](./getRefreshToken.ts)** - Helper to obtain refresh tokens

### Advanced Features
- **[paginationExample.ts](./paginationExample.ts)** - Comprehensive pagination with Gmail
- **[outlookPaginationExample.ts](./outlookPaginationExample.ts)** - Comprehensive pagination with Outlook
- **[streamingExample.ts](./streamingExample.ts)** - Memory-efficient email streaming
- **[labelsExample.ts](./labelsExample.ts)** - Working with Gmail labels
- **[outlookCategoriesExample.ts](./outlookCategoriesExample.ts)** - Working with Outlook categories

### Specific Use Cases
- **[gmailSyncExample.ts](./gmailSyncExample.ts)** - Real-time Gmail synchronization
- **[authCodeExample.ts](./authCodeExample.ts)** - Authorization code handling

## Enhanced Pagination Features

Unimail now provides powerful pagination capabilities that work consistently across all email providers:

### Cross-Provider Compatibility
Both Gmail and Outlook adapters now support identical pagination features:
- **Consistent API**: Same methods and options work across all providers
- **Format Options**: Optimize for speed (`metadata`), balance (`full`), or completeness (`raw`)
- **Helper Classes**: `PaginationHelper` and `PaginationUtils` for easy state management
- **Async Iterators**: Memory-efficient processing of large datasets

### Advanced Pagination Features
1. **Rich Metadata**: Get comprehensive pagination state and navigation info
2. **Auto-Pagination**: Automatically fetch all pages up to a limit
3. **State Management**: Track current page, navigate forward/backward
4. **Performance Optimization**: Choose optimal fetch strategy based on needs
5. **Memory Efficiency**: Process large datasets without loading everything into memory

### Example Usage

```typescript
// Basic pagination
const { emails, nextPageToken } = await adapter.fetchEmails({
  pageSize: 20,
  pageToken: nextPageToken,
  format: 'metadata' // Fast for large datasets
});

// Using PaginationHelper for easy navigation
const helper = createPaginationHelper(adapter, { pageSize: 20 });
const page1 = await helper.fetchCurrentPage();
const page2 = await helper.fetchNextPage();
const backToPage1 = await helper.fetchPreviousPage();

// Async iterator for large datasets
for await (const page of helper.iterateAllPages()) {
  console.log(`Processing ${page.data.length} emails`);
  // Process emails without loading everything into memory
}
```

## Environment Variables

Create a `.env` file with these variables:

```bash
# Gmail OAuth
GMAIL_CLIENT_ID=your_google_client_id
GMAIL_CLIENT_SECRET=your_google_client_secret
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token

# Outlook OAuth
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_REFRESH_TOKEN=your_microsoft_refresh_token
MICROSOFT_TENANT_ID=your_tenant_id_optional

# IMAP (if using IMAP adapter)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USERNAME=your_email@gmail.com
IMAP_PASSWORD=your_password_or_app_password
```

## OAuth Setup

### Gmail OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:3000/oauth/callback` to redirect URIs
6. Run `npx ts-node examples/getRefreshToken.ts` to get refresh token

### Outlook OAuth Setup
1. Go to [Azure App Registration](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Create a new app registration
3. Add platform configuration for web with redirect URI `http://localhost:3000/oauth/oauth2callback`
4. Add API permissions for Microsoft Graph (Mail.Read, Mail.ReadWrite, etc.)
5. Generate a client secret
6. Run `npx ts-node examples/getRefreshToken.ts` to get refresh token

## Performance Tips

### Gmail
- Use `format: 'metadata'` for fastest queries when you only need headers
- Use `format: 'full'` for balanced performance with body content
- Use `format: 'raw'` for complete email data including all attachments

### Outlook
- Use `format: 'metadata'` for fastest queries (maps to minimal Graph API fields)
- Use `format: 'full'` for balanced performance (maps to standard Graph API fields)
- Use `format: 'raw'` for complete data including all attachments

### General
- Use streaming for large datasets to avoid memory issues
- Set appropriate `pageSize` (20-50 is usually optimal)
- Use `PaginationHelper` for complex navigation scenarios
- Consider using `unreadOnly: true` to reduce dataset size

## Error Handling

All examples include proper error handling patterns:
- OAuth token refresh failures
- Network timeouts and retries
- Rate limiting (especially for Gmail)
- API quota exceeded errors
- Invalid credentials handling

## Advanced Features

### Streaming
Memory-efficient processing of large email datasets:
```typescript
// Stream emails in batches
for await (const batch of adapter.streamEmails(options)) {
  console.log(`Processing batch of ${batch.length} emails`);
  // Process without loading everything into memory
}
```

### Synchronization
Real-time email synchronization with change tracking:
```typescript
// Gmail real-time sync
const syncResult = await gmailAdapter.processSync({
  maxResults: 100,
  includeDeleted: true
});
```

### Categories and Labels
Work with email organization:
```typescript
// Gmail labels
const labels = await gmailAdapter.getLabels();

// Outlook categories
const categories = await outlookAdapter.getCategories();
```

## Support

For questions or issues with the examples:
1. Check the main README.md for API documentation
2. Review the inline comments in each example
3. Consult the TypeScript definitions for full API details
4. Open an issue on the GitHub repository

Each example is designed to be self-contained and demonstrates best practices for production use. 