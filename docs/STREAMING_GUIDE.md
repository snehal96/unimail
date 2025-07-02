# Email Streaming Guide

## Overview

Unimail's streaming functionality solves critical memory and performance issues when processing large numbers of emails. Instead of loading all emails into memory at once, streaming processes emails in small batches, providing constant memory usage regardless of dataset size.

## ⚠️ Problem with Traditional Approach

```typescript
// ❌ This can crash your application
const { emails } = await gmailAdapter.fetchEmails({
  limit: 10000,           // 😱 10,000 emails in memory
  getAllPages: true,      // 😱 loads everything at once
  includeAttachments: true
});

// Results in:
// - 2GB+ memory usage
// - Potential crashes
// - Long response times
// - No progress feedback
```

## ✅ Streaming Solutions

### 1. Basic Streaming with AsyncIterator

Most memory-efficient approach with simple iteration:

```typescript
import { GmailAdapter } from 'unimail';

async function processEmailsStream() {
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize(credentials);
  
  let totalProcessed = 0;
  
  // Process emails in batches of 50
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
    // Memory is automatically freed after each batch
  }
}
```

### 2. Progress Tracking with Callbacks

Advanced approach with detailed progress information:

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
      console.log(`Total: ${progress.current}/${progress.total} (${
        Math.round((progress.current / progress.total!) * 100)
      }%)`);
      
      // Process this batch
      for (const email of emails) {
        await processEmail(email);
      }
    },
    
    onProgress: async (progress) => {
      if (progress.current % 100 === 0) {
        console.log(`📊 Progress: ${progress.current} emails processed`);
      }
    },
    
    onError: async (error, progress) => {
      console.error(`❌ Error at batch ${progress.batchCount}:`, error);
      // Implement retry logic here
    },
    
    onComplete: async (summary) => {
      console.log(`✅ Completed! Processed ${summary.totalProcessed} emails in ${summary.duration}ms`);
    }
  });
}
```

## Real-World Integration Patterns

### Database Batch Operations

```typescript
async function syncEmailsToDatabase() {
  const emailsToInsert = [];
  
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
      console.log(`Synced ${emailsToInsert.length} emails to database`);
      emailsToInsert.length = 0; // Clear array
    }
  }
  
  // Insert remaining emails
  if (emailsToInsert.length > 0) {
    await db.emails.insertMany(emailsToInsert);
  }
}
```

### Express.js API with Real-time Updates

```typescript
app.post('/api/sync-emails', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  let totalProcessed = 0;
  
  for await (const emailBatch of gmailAdapter.streamEmails({ batchSize: 25 })) {
    // Process batch
    for (const email of emailBatch) {
      await processEmailForUser(email, req.body.userId);
      totalProcessed++;
    }
    
    // Send progress to frontend
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      processed: totalProcessed,
      batch: emailBatch.length
    })}\n\n`);
  }
  
  res.write(`data: ${JSON.stringify({ type: 'complete', total: totalProcessed })}\n\n`);
  res.end();
});
```

### Background Job Processing

```typescript
// Using Bull Queue or similar
async function processEmailsJob(job) {
  const { query, userId } = job.data;
  let processed = 0;
  
  for await (const emailBatch of gmailAdapter.streamEmails({ 
    batchSize: 20,
    query 
  })) {
    // Update job progress
    const progress = Math.round((processed / 1000) * 100); // Estimate
    await job.progress(progress);
    
    // Process with error handling
    const results = await Promise.allSettled(
      emailBatch.map(email => processEmailWithRetry(email, userId))
    );
    
    processed += results.filter(r => r.status === 'fulfilled').length;
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return { totalProcessed: processed };
}
```

## Memory Usage Comparison

| Approach | 1,000 emails | 10,000 emails | 100,000 emails |
|----------|--------------|---------------|-----------------|
| Traditional (`getAllPages: true`) | ~200MB | ~2GB | ~20GB ⚠️ |
| Streaming (`batchSize: 50`) | ~10MB | ~10MB | ~10MB ✅ |

## Configuration Options

### EmailStreamOptions

```typescript
interface EmailStreamOptions {
  batchSize?: number;           // Emails per batch (default: 50)
  maxEmails?: number;           // Max total emails to process
  query?: string;               // Gmail search query
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
const options = {
  batchSize: 100,
  includeBody: false,
  includeAttachments: false,
  format: 'metadata'
};

// ⚖️ Balanced performance
const options = {
  batchSize: 50,
  includeBody: true,
  includeAttachments: false,
  format: 'full'
};

// 🔍 Complete data (slower)
const options = {
  batchSize: 25,
  includeBody: true,
  includeAttachments: true,
  format: 'raw'
};
```

## Error Handling & Recovery

```typescript
async function processWithRecovery() {
  let lastProcessedId: string | undefined;
  
  try {
    for await (const emailBatch of gmailAdapter.streamEmails({ 
      batchSize: 50,
      pageToken: getCheckpoint() // Resume from saved position
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

## Best Practices

### 1. Choose Appropriate Batch Size
- **Small datasets (< 1,000)**: 50-100 emails per batch
- **Medium datasets (1,000-10,000)**: 25-50 emails per batch  
- **Large datasets (> 10,000)**: 10-25 emails per batch

### 2. Optimize for Your Use Case
```typescript
// For analytics/reporting (fast)
{ batchSize: 100, includeBody: false, includeAttachments: false }

// For search/indexing (balanced)
{ batchSize: 50, includeBody: true, includeAttachments: false }

// For document processing (complete)
{ batchSize: 25, includeBody: true, includeAttachments: true }
```

### 3. Implement Progress Tracking
Always provide user feedback for long-running operations:

```typescript
let startTime = Date.now();
let processed = 0;

for await (const batch of stream) {
  processed += batch.length;
  const elapsed = Date.now() - startTime;
  const rate = processed / (elapsed / 1000);
  
  console.log(`Processed: ${processed}, Rate: ${rate.toFixed(1)} emails/sec`);
}
```

### 4. Handle Rate Limits
Add delays between batches to respect API limits:

```typescript
for await (const emailBatch of gmailAdapter.streamEmails(options)) {
  await processBatch(emailBatch);
  
  // Respect Gmail API rate limits
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

## Migration from Traditional Approach

### Before (Memory Issues)
```typescript
// ❌ Memory problems with large datasets
const { emails } = await adapter.fetchEmails({ 
  limit: 10000, 
  getAllPages: true 
});

for (const email of emails) {
  await processEmail(email);
}
```

### After (Memory Efficient)
```typescript
// ✅ Constant memory usage
for await (const emailBatch of adapter.streamEmails({ 
  batchSize: 50,
  maxEmails: 10000 
})) {
  for (const email of emailBatch) {
    await processEmail(email);
  }
}
```

## Troubleshooting

### Common Issues

1. **"Generator already running" error**
   - Don't call `.next()` manually on the stream
   - Use `for await` loops instead

2. **Memory still growing**
   - Check that you're not accumulating emails outside the loop
   - Ensure async operations in batch processing complete

3. **Slow processing**
   - Reduce batch size for better memory usage
   - Disable `includeAttachments` if not needed
   - Use `format: 'metadata'` for basic info only

### Debug Mode
```typescript
// Enable detailed logging
for await (const emailBatch of gmailAdapter.streamEmails(options)) {
  console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  // Process batch...
}
```

## Next Steps

- **Outlook Support**: Streaming will be extended to OutlookAdapter
- **IMAP Support**: Streaming for IMAP servers  
- **Advanced Filters**: More sophisticated email filtering options
- **Parallel Processing**: Process multiple streams concurrently

For questions or issues, see the [GitHub repository](https://github.com/snehal96/unimail) or [create an issue](https://github.com/snehal96/unimail/issues). 