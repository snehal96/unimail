import { GmailAdapter, FetchOptions, NormalizedEmail, GmailCredentials, PaginationHelper, createPaginationHelper, PaginationUtils } from '../src';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  console.error('Missing Google API credentials in .env file. Please set:');
  console.error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
  process.exit(1);
}

const gmailCredentials: GmailCredentials = {
  clientId: GOOGLE_CLIENT_ID!,
  clientSecret: GOOGLE_CLIENT_SECRET!,
  refreshToken: GOOGLE_REFRESH_TOKEN!,
};

async function main() {
  console.log('=== Unimail Pagination Examples ===\n');

  // Initialize Gmail adapter
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(gmailCredentials);

  // Example 1: Basic Manual Pagination
  console.log('1. Basic Manual Pagination:');
  await basicPaginationExample(gmailAdapter);

  // Example 2: Using PaginationHelper
  console.log('\n2. Using PaginationHelper:');
  await paginationHelperExample(gmailAdapter);

  // Example 3: Automatic All-Pages Fetching
  console.log('\n3. Automatic All-Pages Fetching:');
  await allPagesExample(gmailAdapter);

  // Example 4: Pagination with Search and Filters
  console.log('\n4. Pagination with Search and Filters:');
  await paginationWithFiltersExample(gmailAdapter);

  // Example 5: Async Iterator for Large Datasets
  console.log('\n5. Async Iterator for Large Datasets:');
  await asyncIteratorExample(gmailAdapter);

  // Example 6: Building a Paginated API Response
  console.log('\n6. Building a Paginated API Response:');
  await apiResponseExample(gmailAdapter);
}

/**
 * Example 1: Basic manual pagination using pageToken
 */
async function basicPaginationExample(adapter: GmailAdapter) {
  let pageToken: string | undefined;
  let pageNumber = 1;
  const pageSize = 5;

  console.log(`  Fetching emails ${pageSize} per page...`);

  do {
    const { emails, nextPageToken, totalCount } = await adapter.fetchEmails({
      pageSize,
      pageToken,
      query: 'label:inbox',
      includeBody: false, // For performance
      includeAttachments: false,
    });

    console.log(`  📄 Page ${pageNumber}: ${emails.length} emails`);
    if (totalCount) {
      console.log(`     Total available: ~${totalCount} emails`);
    }

    // Display email subjects
    emails.forEach((email, index) => {
      console.log(`     ${index + 1}. ${email.subject || '(No subject)'}`);
    });

    pageToken = nextPageToken;
    pageNumber++;

    // Stop after 3 pages for demo
    if (pageNumber > 3) break;

  } while (pageToken);
}

/**
 * Example 2: Using the new PaginationHelper class
 */
async function paginationHelperExample(adapter: GmailAdapter) {
  const paginationHelper = createPaginationHelper(adapter, {
    pageSize: 8,
    query: 'label:inbox',
    includeBody: false,
    includeAttachments: false,
  });

  console.log('  Using PaginationHelper for easy navigation...');

  // Fetch first page
  const page1 = await paginationHelper.fetchCurrentPage();
  console.log(`  📄 Page 1: ${page1.data.length} emails`);
  console.log(`     Has next page: ${page1.pagination.hasNextPage}`);
  console.log(`     Current page: ${page1.pagination.currentPage}`);

  if (page1.pagination.hasNextPage) {
    // Go to next page
    const page2 = await paginationHelper.fetchNextPage();
    console.log(`  📄 Page 2: ${page2?.data.length} emails`);
    console.log(`     Has previous page: ${page2?.pagination.hasPreviousPage}`);

    if (page2?.pagination.hasPreviousPage) {
      // Go back to previous page
      const backToPage1 = await paginationHelper.fetchPreviousPage();
      console.log(`  📄 Back to Page 1: ${backToPage1?.data.length} emails`);
    }
  }

  // Get current state
  const state = paginationHelper.getCurrentState();
  console.log(`  Current state: Page ${state.currentPage}, Total fetched: ${state.totalFetched}`);
}

/**
 * Example 3: Automatic fetching of all pages
 */
async function allPagesExample(adapter: GmailAdapter) {
  console.log('  Fetching all pages automatically...');

  const { emails, totalCount } = await adapter.fetchEmails({
    limit: 20,        // Maximum total emails
    pageSize: 7,      // Emails per API call
    getAllPages: true, // Fetch all pages automatically
    query: 'label:inbox',
    includeBody: false,
    includeAttachments: false,
  });

  console.log(`  📄 Fetched ${emails.length} emails total across all pages`);
  if (totalCount) {
    console.log(`     Total available: ~${totalCount} emails`);
  }

  // Display first few subjects
  emails.slice(0, 5).forEach((email, index) => {
    console.log(`     ${index + 1}. ${email.subject || '(No subject)'}`);
  });
  
  if (emails.length > 5) {
    console.log(`     ... and ${emails.length - 5} more emails`);
  }
}

/**
 * Example 4: Pagination with advanced search and filters
 */
async function paginationWithFiltersExample(adapter: GmailAdapter) {
  console.log('  Paginating with search filters...');

  const searchOptions: FetchOptions = {
    pageSize: 5,
    query: 'has:attachment after:2024-01-01',
    since: '2024-01-01',
    includeBody: false,
    includeAttachments: false,
  };

  const { emails, nextPageToken, totalCount } = await adapter.fetchEmails(searchOptions);

  console.log(`  📄 Found ${emails.length} emails with attachments from 2024`);
  if (totalCount) {
    console.log(`     Total matching: ~${totalCount} emails`);
  }
  console.log(`     Has more pages: ${!!nextPageToken}`);

  // Display results with attachment info
  emails.forEach((email, index) => {
    const date = email.date.toISOString().split('T')[0];
    console.log(`     ${index + 1}. [${date}] ${email.subject || '(No subject)'}`);
    console.log(`        From: ${email.from}`);
    console.log(`        Attachments: ${email.attachments.length}`);
  });
}

/**
 * Example 5: Using async iterator for processing large datasets
 */
async function asyncIteratorExample(adapter: GmailAdapter) {
  console.log('  Processing large dataset with async iterator...');

  const paginationHelper = createPaginationHelper(adapter, {
    pageSize: 10,
    query: 'label:inbox',
    includeBody: false,
    includeAttachments: false,
  });

  let totalProcessed = 0;
  let pageCount = 0;

  // Use async iterator to process all pages
  for await (const page of paginationHelper.iterateAllPages()) {
    pageCount++;
    totalProcessed += page.data.length;

    console.log(`  📄 Processing page ${pageCount}: ${page.data.length} emails`);
    
    // Process emails in this page
    page.data.forEach(email => {
      // Your processing logic here
      // console.log(`     Processing: ${email.subject}`);
    });

    // Stop after 3 pages for demo
    if (pageCount >= 3) break;
  }

  console.log(`  ✅ Processed ${totalProcessed} emails across ${pageCount} pages`);
}

/**
 * Example 6: Building a paginated API response
 */
async function apiResponseExample(adapter: GmailAdapter) {
  console.log('  Building paginated API response...');

  // Simulate API endpoint parameters
  const apiRequest = {
    page: 1,
    pageSize: 6,
    query: 'label:inbox',
    includeAttachments: false,
  };

  // Build API response
  const response = await buildPaginatedApiResponse(adapter, apiRequest);

  console.log('  📄 API Response:');
  console.log(`     Status: ${response.status}`);
  console.log(`     Data: ${response.data.length} emails`);
  console.log(`     Pagination:`, JSON.stringify(response.pagination, null, 6));
  console.log(`     Metadata:`, JSON.stringify(response.metadata, null, 6));
}

/**
 * Helper function to build a paginated API response
 */
async function buildPaginatedApiResponse(
  adapter: GmailAdapter,
  request: {
    page?: number;
    pageSize?: number;
    query?: string;
    pageToken?: string;
    includeAttachments?: boolean;
  }
) {
  try {
    const { emails, nextPageToken, totalCount } = await adapter.fetchEmails({
      pageSize: request.pageSize || 20,
      pageToken: request.pageToken,
      query: request.query || '',
      includeBody: true,
      includeAttachments: request.includeAttachments || false,
    });

    // Calculate pagination metadata
    const currentPage = request.page || 1;
    const pageSize = request.pageSize || 20;
    const hasNextPage = !!nextPageToken;
    const hasPreviousPage = currentPage > 1;

    const pagination = PaginationUtils.calculatePaginationMetadata(
      currentPage,
      pageSize,
      totalCount,
      hasNextPage,
      hasPreviousPage
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
        provider: 'gmail',
        totalFetched: emails.length,
      },
    };
  } catch (error) {
    return {
      status: 'error',
      error: (error as Error).message,
      data: [],
      pagination: null,
      metadata: null,
    };
  }
}

// Run the examples
main().catch(console.error); 