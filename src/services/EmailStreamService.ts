import { 
  NormalizedEmail, 
  EmailStreamOptions, 
  EmailStreamCallbacks, 
  EmailStreamProgress, 
  EmailStreamSummary,
  EmailStreamBatch 
} from '../interfaces.js';

/**
 * Common streaming utility for email adapters
 * Provides shared functionality for streaming emails in batches
 */
export class EmailStreamService {
  /**
   * Creates an async generator that yields email batches
   * This is the core streaming implementation that adapters can use
   */
  public static async *createEmailStream(
    fetchPageFn: (pageToken?: string, pageSize?: number) => Promise<{
      emails: NormalizedEmail[];
      nextPageToken?: string;
      totalCount?: number;
    }>,
    options: EmailStreamOptions
  ): AsyncGenerator<NormalizedEmail[], void, unknown> {
    const batchSize = options.batchSize || 50;
    const maxEmails = options.maxEmails;
    
    let pageToken = options.pageToken;
    let totalProcessed = 0;
    let hasMore = true;
    
    while (hasMore) {
      try {
        // Determine how many emails to fetch in this request
        let requestSize = batchSize;
        if (maxEmails && (totalProcessed + requestSize) > maxEmails) {
          requestSize = maxEmails - totalProcessed;
        }
        
        if (requestSize <= 0) {
          break;
        }
        
        // Fetch the page
        const response = await fetchPageFn(pageToken, requestSize);
        
        if (!response.emails || response.emails.length === 0) {
          break;
        }
        
        // Yield this batch
        yield response.emails;
        
        totalProcessed += response.emails.length;
        pageToken = response.nextPageToken;
        hasMore = !!pageToken;
        
        // Check if we've reached the maximum
        if (maxEmails && totalProcessed >= maxEmails) {
          break;
        }
        
      } catch (error) {
        console.error('Error in email stream:', error);
        throw error;
      }
    }
  }
  
  /**
   * Executes email streaming with callbacks for progress tracking
   */
  public static async processEmailStream(
    streamGenerator: AsyncGenerator<NormalizedEmail[], void, unknown>,
    callbacks: EmailStreamCallbacks
  ): Promise<void> {
    const summary: EmailStreamSummary = {
      totalProcessed: 0,
      totalBatches: 0,
      errors: 0,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0
    };
    
    try {
      let batchNumber = 0;
      
      for await (const emailBatch of streamGenerator) {
        batchNumber++;
        summary.totalBatches = batchNumber;
        summary.totalProcessed += emailBatch.length;
        
        const progress: EmailStreamProgress = {
          current: summary.totalProcessed,
          batchCount: batchNumber,
          // Note: total and estimatedRemaining would need to be set by the adapter
          // since we don't have access to that information at this level
        };
        
        try {
          // Call the batch callback
          if (callbacks.onBatch) {
            await callbacks.onBatch(emailBatch, progress);
          }
          
          // Call the progress callback
          if (callbacks.onProgress) {
            await callbacks.onProgress(progress);
          }
          
        } catch (error) {
          summary.errors++;
          
          if (callbacks.onError) {
            await callbacks.onError(error as Error, progress);
          } else {
            // Re-throw if no error handler is provided
            throw error;
          }
        }
      }
      
    } finally {
      summary.endTime = new Date();
      summary.duration = summary.endTime.getTime() - summary.startTime.getTime();
      
      if (callbacks.onComplete) {
        await callbacks.onComplete(summary);
      }
    }
  }
  
  /**
   * Utility to create a stream batch object with metadata
   */
  public static createStreamBatch(
    emails: NormalizedEmail[],
    batchNumber: number,
    progress: EmailStreamProgress,
    isLastBatch: boolean = false
  ): EmailStreamBatch {
    return {
      emails,
      batchNumber,
      progress,
      isLastBatch
    };
  }
  
  /**
   * Utility to calculate estimated remaining emails
   */
  public static calculateEstimatedRemaining(
    totalCount: number | undefined,
    currentProcessed: number
  ): number | undefined {
    if (!totalCount || totalCount <= currentProcessed) {
      return undefined;
    }
    return totalCount - currentProcessed;
  }
  
  /**
   * Utility to validate streaming options
   */
  public static validateStreamOptions(options: EmailStreamOptions): void {
    if (options.batchSize && options.batchSize <= 0) {
      throw new Error('batchSize must be greater than 0');
    }
    
    if (options.maxEmails && options.maxEmails <= 0) {
      throw new Error('maxEmails must be greater than 0');
    }
    
    if (options.batchSize && options.batchSize > 1000) {
      console.warn('Warning: Large batch sizes may cause memory issues. Consider using smaller batches.');
    }
  }
} 