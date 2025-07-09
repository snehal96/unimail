import { OutlookAdapter, FetchOptions, NormalizedEmail, OutlookCredentials, PaginationHelper, createPaginationHelper, PaginationUtils } from '../src';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN, MICROSOFT_TENANT_ID } = process.env;

if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || !MICROSOFT_REFRESH_TOKEN) {
  console.error('Missing Microsoft API credentials in .env file. Please set:');
  console.error('MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN');
  process.exit(1);
}

const outlookCredentials: OutlookCredentials = {
  clientId: MICROSOFT_CLIENT_ID!,
  clientSecret: MICROSOFT_CLIENT_SECRET!,
  refreshToken: MICROSOFT_REFRESH_TOKEN!,
  tenantId: MICROSOFT_TENANT_ID,
};

async function main() {
  console.log('=== Outlook Pagination Examples ===\n');

  // Initialize Outlook adapter
  const outlookAdapter = new OutlookAdapter();
  await outlookAdapter.initialize(outlookCredentials);

  // Example 1: Basic Manual Pagination
  console.log('1. Basic Manual Pagination (Outlook):');
  await basicPaginationExample(outlookAdapter);

  // Example 2: Using PaginationHelper
  console.log('\n2. Using PaginationHelper (Outlook):');
  await paginationHelperExample(outlookAdapter);

  // Example 3: Automatic All-Pages Fetching
  console.log('\n3. Automatic All-Pages Fetching (Outlook):');
  await allPagesExample(outlookAdapter);

  // Example 4: Pagination with Search and Filters
  console.log('\n4. Pagination with Search and Filters (Outlook):');
  await paginationWithFiltersExample(outlookAdapter);

  // Example 5: Async Iterator for Large Datasets
  console.log('\n5. Async Iterator for Large Datasets (Outlook):');
  await asyncIteratorExample(outlookAdapter);

  // Example 6: Format Options Performance Comparison
  console.log('\n6. Format Options Performance Comparison (Outlook):');
  await formatOptionsExample(outlookAdapter);

  // Example 7: Building a Paginated API Response
  console.log('\n7. Building a Paginated API Response (Outlook):');
  await apiResponseExample(outlookAdapter);
}

/**
 * Example 1: Basic manual pagination using pageToken (Outlook-specific)
 */
async function basicPaginationExample(adapter: OutlookAdapter) {
  let pageToken: string | undefined;
  let pageNumber = 1;
  const pageSize = 5;

  console.log(`  Fetching emails ${pageSize} per page...`);

  do {
    const { emails, nextPageToken, totalCount } = await adapter.fetchEmails({
      pageSize,
      pageToken,
      // Outlook-specific filter: unread emails from last 30 days
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      unreadOnly: true,
      includeBody: false, // For performance
      includeAttachments: false,
    });

    console.log(`  📄 Page ${pageNumber}: ${emails.length} emails`);
    if (totalCount !== undefined) {
      console.log(`     Total available: ~${totalCount} emails`);
    } else {
      console.log(`     Total count: Not available (Microsoft Graph limitation)`);
    }

    // Display email subjects and categories
    emails.forEach((email, index) => {
      const categories = email.labels?.length ? email.labels.join(', ') : 'None';
      console.log(`     ${index + 1}. ${email.subject || '(No subject)'} [${categories}]`);
    });

    pageToken = nextPageToken;
    pageNumber++;

    // Stop after 3 pages for demo
    if (pageNumber > 3) break;

  } while (pageToken);
}

/**
 * Example 2: Using the PaginationHelper class with Outlook
 */
async function paginationHelperExample(adapter: OutlookAdapter) {
  const paginationHelper = createPaginationHelper(adapter, {
    pageSize: 8,
    // Outlook-specific: filter by importance and recent emails
    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    includeBody: false,
    includeAttachments: false,
    format: 'metadata', // Fastest option for Outlook
  });

  console.log('  Using PaginationHelper for easy Outlook navigation...');

  // Fetch first page
  const page1 = await paginationHelper.fetchCurrentPage();
  console.log(`  📄 Page 1: ${page1.data.length} emails`);
  console.log(`     Has next page: ${page1.pagination.hasNextPage}`);
  console.log(`     Current page: ${page1.pagination.currentPage}`);
  console.log(`     Fetch strategy: metadata (optimized for speed)`);

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
 * Example 3: Automatic fetching of all pages with Outlook
 */
async function allPagesExample(adapter: OutlookAdapter) {
  console.log('  Fetching all pages automatically...');

  const { emails, totalCount } = await adapter.fetchEmails({
    limit: 20,        // Maximum total emails
    pageSize: 7,      // Emails per API call
    getAllPages: true, // Fetch all pages automatically
    // Outlook-specific: emails from last week
    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    includeBody: false,
    includeAttachments: false,
    format: 'full', // Good balance of data and performance
  });

  console.log(`  📄 Fetched ${emails.length} emails total across all pages`);
  if (totalCount !== undefined) {
    console.log(`     Total available: ~${totalCount} emails`);
  } else {
    console.log(`     Total count: Microsoft Graph doesn't provide exact counts`);
  }

  // Display first few subjects with Outlook-specific info
  emails.slice(0, 5).forEach((email, index) => {
    const date = email.date.toISOString().split('T')[0];
    const categories = email.labels?.length ? email.labels.join(', ') : 'No categories';
    console.log(`     ${index + 1}. [${date}] ${email.subject || '(No subject)'}`);
    console.log(`        Categories: ${categories}`);
  });
  
  if (emails.length > 5) {
    console.log(`     ... and ${emails.length - 5} more emails`);
  }
}

/**
 * Example 4: Pagination with Outlook-specific search and filters
 */
async function paginationWithFiltersExample(adapter: OutlookAdapter) {
  console.log('  Paginating with Outlook-specific filters...');

  const searchOptions: FetchOptions = {
    pageSize: 5,
    // Outlook-specific OData filters
    since: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // Last 2 weeks
    query: 'meeting OR call OR schedule', // Content search
    includeBody: false,
    includeAttachments: false,
    format: 'metadata',
  };

  const { emails, nextPageToken, totalCount } = await adapter.fetchEmails(searchOptions);

  console.log(`  📄 Found ${emails.length} emails matching "meeting OR call OR schedule"`);
  if (totalCount !== undefined) {
    console.log(`     Total matching: ~${totalCount} emails`);
  } else {
    console.log(`     Total count: Not available from Microsoft Graph`);
  }
  console.log(`     Has more pages: ${!!nextPageToken}`);

  // Display results with Outlook-specific metadata
  emails.forEach((email, index) => {
    const date = email.date.toISOString().split('T')[0];
    const time = email.date.toTimeString().split(' ')[0];
    const categories = email.labels?.length ? email.labels.join(', ') : 'Uncategorized';
    console.log(`     ${index + 1}. [${date} ${time}] ${email.subject || '(No subject)'}`);
    console.log(`        From: ${email.from}`);
    console.log(`        Categories: ${categories}`);
    console.log(`        Has attachments: ${email.attachments.length > 0 ? 'Yes' : 'No'}`);
  });
}

/**
 * Example 5: Using async iterator for processing large Outlook datasets
 */
async function asyncIteratorExample(adapter: OutlookAdapter) {
  console.log('  Processing large Outlook dataset with async iterator...');

  const paginationHelper = createPaginationHelper(adapter, {
    pageSize: 10,
    since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last month
    includeBody: false,
    includeAttachments: false,
    format: 'metadata', // Fastest for large datasets
  });

  let totalProcessed = 0;
  let pageCount = 0;
  let categoryStats: { [key: string]: number } = {};

  // Use async iterator to process all pages
  for await (const page of paginationHelper.iterateAllPages()) {
    pageCount++;
    totalProcessed += page.data.length;

    console.log(`  📄 Processing page ${pageCount}: ${page.data.length} emails`);
    
    // Process emails in this page - analyze categories
    page.data.forEach(email => {
      const categories = email.labels || ['Uncategorized'];
      categories.forEach(category => {
        categoryStats[category] = (categoryStats[category] || 0) + 1;
      });
    });

    // Stop after 3 pages for demo
    if (pageCount >= 3) break;
  }

  console.log(`  ✅ Processed ${totalProcessed} emails across ${pageCount} pages`);
  console.log(`  📊 Category analysis:`);
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`     ${category}: ${count} emails`);
  });
}

/**
 * Example 6: Format options performance comparison for Outlook
 */
async function formatOptionsExample(adapter: OutlookAdapter) {
  console.log('  Comparing different format options for performance...');

  const baseOptions = {
    pageSize: 5,
    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  // Test metadata format (fastest)
  console.log('  🚀 Testing metadata format (fastest):');
  const startMetadata = Date.now();
  const metadataResult = await adapter.fetchEmails({
    ...baseOptions,
    format: 'metadata',
    includeBody: false,
    includeAttachments: false,
  });
  const metadataTime = Date.now() - startMetadata;
  console.log(`     Fetched ${metadataResult.emails.length} emails in ${metadataTime}ms`);

  // Test minimal format (balanced)
  console.log('  ⚖️ Testing minimal format (balanced):');
  const startMinimal = Date.now();
  const minimalResult = await adapter.fetchEmails({
    ...baseOptions,
    format: 'full', // Maps to minimal internally
    includeBody: true,
    includeAttachments: false,
  });
  const minimalTime = Date.now() - startMinimal;
  console.log(`     Fetched ${minimalResult.emails.length} emails in ${minimalTime}ms`);

  // Test full format (complete data)
  console.log('  🔍 Testing full format (complete data):');
  const startFull = Date.now();
  const fullResult = await adapter.fetchEmails({
    ...baseOptions,
    format: 'raw', // Maps to full internally
    includeBody: true,
    includeAttachments: true,
  });
  const fullTime = Date.now() - startFull;
  console.log(`     Fetched ${fullResult.emails.length} emails in ${fullTime}ms`);

  console.log(`  📊 Performance comparison:`);
  console.log(`     Metadata: ${metadataTime}ms (${(metadataTime / metadataTime * 100).toFixed(0)}% baseline)`);
  console.log(`     Minimal:  ${minimalTime}ms (${(minimalTime / metadataTime * 100).toFixed(0)}% of baseline)`);
  console.log(`     Full:     ${fullTime}ms (${(fullTime / metadataTime * 100).toFixed(0)}% of baseline)`);
}

/**
 * Example 7: Building a paginated API response with Outlook
 */
async function apiResponseExample(adapter: OutlookAdapter) {
  console.log('  Building paginated API response for Outlook...');

  // Simulate API endpoint parameters
  const apiRequest = {
    page: 1,
    pageSize: 6,
    categories: [], // Outlook-specific filter
    timeRange: '7d', // Last 7 days
    includeAttachments: false,
  };

  // Build API response
  const response = await buildOutlookPaginatedApiResponse(adapter, apiRequest);

  console.log('  📄 Outlook API Response:');
  console.log(`     Status: ${response.status}`);
  console.log(`     Data: ${response.data.length} emails`);
  console.log(`     Pagination:`, JSON.stringify(response.pagination, null, 6));
  console.log(`     Outlook Metadata:`, JSON.stringify(response.outlookMetadata, null, 6));
}

/**
 * Helper function to build a paginated API response for Outlook
 */
async function buildOutlookPaginatedApiResponse(
  adapter: OutlookAdapter,
  request: {
    page?: number;
    pageSize?: number;
    categories?: string[];
    timeRange?: string;
    pageToken?: string;
    includeAttachments?: boolean;
  }
) {
  try {
    // Convert timeRange to since date
    let since: string | undefined;
    if (request.timeRange) {
      const days = parseInt(request.timeRange);
      since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    }

    const { emails, nextPageToken, totalCount } = await adapter.fetchEmails({
      pageSize: request.pageSize || 20,
      pageToken: request.pageToken,
      since,
      includeBody: true,
      includeAttachments: request.includeAttachments || false,
      format: 'full', // Good balance for APIs
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

    // Outlook-specific analysis
    const categoryDistribution: { [key: string]: number } = {};
    emails.forEach(email => {
      const categories = email.labels || ['Uncategorized'];
      categories.forEach(category => {
        categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
      });
    });

    return {
      status: 'success',
      data: emails,
      pagination: {
        ...pagination,
        nextPageToken,
      },
      outlookMetadata: {
        timeRange: request.timeRange,
        since,
        fetchTime: new Date().toISOString(),
        provider: 'outlook',
        totalFetched: emails.length,
        categoryDistribution,
        graphApiLimitations: {
          totalCountAvailable: false,
          reason: 'Microsoft Graph API does not provide exact total counts for security and performance reasons'
        }
      },
    };
  } catch (error) {
    return {
      status: 'error',
      error: (error as Error).message,
      data: [],
      pagination: null,
      outlookMetadata: null,
    };
  }
}

// Run the examples
main().catch(console.error); 