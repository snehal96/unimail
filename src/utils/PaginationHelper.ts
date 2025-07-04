import { 
  FetchOptions, 
  NormalizedEmail, 
  PaginationMetadata, 
  PaginationState, 
  PaginatedResponse,
  PaginationOptions
} from '../interfaces.js';
import { IAdapter, PaginatedEmailsResponse } from '../adapters/IAdapter.js';

/**
 * Pagination helper utility class that provides convenient methods for managing
 * email pagination state and fetching emails across multiple pages.
 */
export class PaginationHelper {
  private state: PaginationState;
  private adapter: IAdapter;

  constructor(adapter: IAdapter, initialOptions: FetchOptions = {}) {
    this.adapter = adapter;
    this.state = {
      currentPageToken: undefined,
      previousPageTokens: [],
      currentPage: 1,
      pageSize: initialOptions.pageSize || 20,
      totalFetched: 0,
      query: initialOptions.query,
      options: initialOptions
    };
  }

  /**
   * Fetch the current page of emails
   */
  async fetchCurrentPage(): Promise<PaginatedResponse<NormalizedEmail>> {
    const startTime = new Date();
    
    const response = await this.adapter.fetchEmails({
      ...this.state.options,
      pageToken: this.state.currentPageToken,
      pageSize: this.state.pageSize
    });

    const pagination = this.createPaginationMetadata(response);
    
    return {
      data: response.emails,
      pagination,
      query: this.state.query,
      totalFetched: response.emails.length,
      fetchTime: startTime
    };
  }

  /**
   * Fetch the next page of emails
   */
  async fetchNextPage(): Promise<PaginatedResponse<NormalizedEmail> | null> {
    const response = await this.fetchCurrentPage();
    
    if (!response.pagination.hasNextPage) {
      return null;
    }

    return this.goToNextPage();
  }

  /**
   * Fetch the previous page of emails
   */
  async fetchPreviousPage(): Promise<PaginatedResponse<NormalizedEmail> | null> {
    if (!this.state.previousPageTokens.length) {
      return null;
    }

    return this.goToPreviousPage();
  }

  /**
   * Navigate to the next page
   */
  async goToNextPage(): Promise<PaginatedResponse<NormalizedEmail>> {
    // Save current page token to history
    if (this.state.currentPageToken) {
      this.state.previousPageTokens.push(this.state.currentPageToken);
    }

    // Get next page info
    const currentResponse = await this.adapter.fetchEmails({
      ...this.state.options,
      pageToken: this.state.currentPageToken,
      pageSize: this.state.pageSize
    });

    if (!currentResponse.nextPageToken) {
      throw new Error('No next page available');
    }

    // Update state
    this.state.currentPageToken = currentResponse.nextPageToken;
    this.state.currentPage++;
    this.state.totalFetched += currentResponse.emails.length;

    return this.fetchCurrentPage();
  }

  /**
   * Navigate to the previous page
   */
  async goToPreviousPage(): Promise<PaginatedResponse<NormalizedEmail>> {
    if (this.state.previousPageTokens.length === 0) {
      throw new Error('No previous page available');
    }

    // Get previous page token
    const previousToken = this.state.previousPageTokens.pop();
    this.state.currentPageToken = previousToken;
    this.state.currentPage--;

    return this.fetchCurrentPage();
  }

  /**
   * Reset pagination to the first page
   */
  async goToFirstPage(): Promise<PaginatedResponse<NormalizedEmail>> {
    this.state.currentPageToken = undefined;
    this.state.previousPageTokens = [];
    this.state.currentPage = 1;
    this.state.totalFetched = 0;

    return this.fetchCurrentPage();
  }

  /**
   * Fetch all pages up to a specified limit
   */
  async fetchAllPages(maxEmails?: number): Promise<PaginatedResponse<NormalizedEmail>> {
    const allEmails: NormalizedEmail[] = [];
    const startTime = new Date();
    let totalPages = 0;

    // Reset to first page
    await this.goToFirstPage();

    do {
      const response = await this.fetchCurrentPage();
      allEmails.push(...response.data);
      totalPages++;

      // Check if we've reached the limit
      if (maxEmails && allEmails.length >= maxEmails) {
        break;
      }

      // Try to go to next page
      if (response.pagination.hasNextPage) {
        await this.goToNextPage();
      } else {
        break;
      }
    } while (true);

    // Trim to exact limit if specified
    const finalEmails = maxEmails ? allEmails.slice(0, maxEmails) : allEmails;

    return {
      data: finalEmails,
      pagination: {
        currentPage: totalPages,
        pageSize: this.state.pageSize,
        totalCount: undefined,
        hasNextPage: false,
        hasPreviousPage: false,
        isFirstPage: true,
        isLastPage: true,
        estimatedTotalPages: totalPages
      },
      query: this.state.query,
      totalFetched: finalEmails.length,
      fetchTime: startTime
    };
  }

  /**
   * Create an async generator for iterating through all pages
   */
  async *iterateAllPages(): AsyncGenerator<PaginatedResponse<NormalizedEmail>, void, unknown> {
    // Reset to first page
    await this.goToFirstPage();

    do {
      const response = await this.fetchCurrentPage();
      yield response;

      if (response.pagination.hasNextPage) {
        await this.goToNextPage();
      } else {
        break;
      }
    } while (true);
  }

  /**
   * Update pagination options
   */
  updateOptions(newOptions: Partial<FetchOptions>): void {
    this.state.options = { ...this.state.options, ...newOptions };
    
    // Update relevant state
    if (newOptions.pageSize) {
      this.state.pageSize = newOptions.pageSize;
    }
    if (newOptions.query !== undefined) {
      this.state.query = newOptions.query;
    }
  }

  /**
   * Get current pagination state
   */
  getCurrentState(): PaginationState {
    return { ...this.state };
  }

  /**
   * Create pagination metadata from adapter response
   */
  private createPaginationMetadata(response: PaginatedEmailsResponse): PaginationMetadata {
    const hasNextPage = !!response.nextPageToken;
    const hasPreviousPage = this.state.previousPageTokens.length > 0;
    const isFirstPage = this.state.currentPage === 1;
    const isLastPage = !hasNextPage;

    let estimatedTotalPages: number | undefined;
    if (response.totalCount && this.state.pageSize) {
      estimatedTotalPages = Math.ceil(response.totalCount / this.state.pageSize);
    }

    return {
      currentPage: this.state.currentPage,
      pageSize: this.state.pageSize,
      totalCount: response.totalCount,
      estimatedTotalPages,
      nextPageToken: response.nextPageToken,
      previousPageToken: this.state.previousPageTokens[this.state.previousPageTokens.length - 1],
      hasNextPage,
      hasPreviousPage,
      isFirstPage,
      isLastPage
    };
  }
}

/**
 * Static utility functions for pagination
 */
export class PaginationUtils {
  /**
   * Calculate pagination metadata from basic parameters
   */
  static calculatePaginationMetadata(
    currentPage: number,
    pageSize: number,
    totalCount?: number,
    hasNextPage?: boolean,
    hasPreviousPage?: boolean
  ): PaginationMetadata {
    const isFirstPage = currentPage === 1;
    const estimatedTotalPages = totalCount ? Math.ceil(totalCount / pageSize) : undefined;
    const isLastPage = estimatedTotalPages ? currentPage >= estimatedTotalPages : !hasNextPage;

    return {
      currentPage,
      pageSize,
      totalCount,
      estimatedTotalPages,
      hasNextPage: hasNextPage ?? false,
      hasPreviousPage: hasPreviousPage ?? false,
      isFirstPage,
      isLastPage
    };
  }

  /**
   * Create a simple paginated response wrapper
   */
  static createPaginatedResponse<T>(
    data: T[],
    pagination: PaginationMetadata,
    query?: string
  ): PaginatedResponse<T> {
    return {
      data,
      pagination,
      query,
      totalFetched: data.length,
      fetchTime: new Date()
    };
  }

  /**
   * Extract page number from page token (if it's numeric)
   */
  static extractPageFromToken(token: string): number | null {
    try {
      const parsed = parseInt(token, 10);
      return isNaN(parsed) ? null : parsed;
    } catch {
      return null;
    }
  }
}

/**
 * Convenient factory function to create a pagination helper
 */
export function createPaginationHelper(
  adapter: IAdapter, 
  options: FetchOptions = {}
): PaginationHelper {
  return new PaginationHelper(adapter, options);
} 