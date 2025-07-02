import { GmailAdapter, EmailStreamOptions, EmailStreamCallbacks } from '../src';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

const {
  GOOGLE_CLIENT_ID = '',
  GOOGLE_CLIENT_SECRET = '',
  GOOGLE_REFRESH_TOKEN = ''
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  console.error('Missing required environment variables. Please set:');
  console.error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
  process.exit(1);
}

/**
 * Example 1: Simple streaming with async generator
 */
async function simpleStreamingExample() {
  console.log('\n=== Simple Streaming Example ===');
  
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    refreshToken: GOOGLE_REFRESH_TOKEN
  });
  
  let totalProcessed = 0;
  
  // Stream emails in batches of 25
  for await (const emailBatch of gmailAdapter.streamEmails({ 
    batchSize: 25,
    query: 'has:attachment',
    maxEmails: 100 // Limit to 100 emails for demo
  })) {
    console.log(`Processing batch of ${emailBatch.length} emails...`);
    
    // Process each email in this batch
    for (const email of emailBatch) {
      console.log(`  - ${email.subject} (${email.attachments.length} attachments)`);
      totalProcessed++;
    }
    
    console.log(`Processed ${totalProcessed} emails so far...`);
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`✅ Simple streaming completed. Total processed: ${totalProcessed}`);
}

/**
 * Example 2: Database batch insertion simulation
 */
async function databaseStreamingExample() {
  console.log('\n=== Database Streaming Example ===');
  
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    refreshToken: GOOGLE_REFRESH_TOKEN
  });
  
  const emailsToInsert: Array<{
    id: string;
    subject: string | undefined;
    from: string;
    date: Date;
    labels: string[] | undefined;
  }> = [];
  let totalSynced = 0;
  
  for await (const emailBatch of gmailAdapter.streamEmails({ 
    batchSize: 50,
    since: '2024-01-01',
    includeAttachments: false, // Skip attachments for faster processing
    includeBody: false // Skip body for faster processing
  })) {
    // Accumulate emails for bulk insert
    emailsToInsert.push(...emailBatch.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      date: email.date,
      labels: email.labels
    })));
    
    // Simulate bulk database insert every 100 emails
    if (emailsToInsert.length >= 100) {
      try {
        // Simulate database operation
        console.log(`📦 Bulk inserting ${emailsToInsert.length} emails...`);
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate DB call
        
        totalSynced += emailsToInsert.length;
        console.log(`✅ Synced ${totalSynced} emails to database`);
        emailsToInsert.length = 0; // Clear array
      } catch (error) {
        console.error('❌ Database error:', error);
      }
    }
  }
  
  // Insert remaining emails
  if (emailsToInsert.length > 0) {
    console.log(`📦 Final bulk insert of ${emailsToInsert.length} emails...`);
    await new Promise(resolve => setTimeout(resolve, 200));
    totalSynced += emailsToInsert.length;
  }
  
  console.log(`✅ Database streaming completed. Total synced: ${totalSynced}`);
}

/**
 * Example 3: Progress tracking with callbacks
 */
async function progressTrackingExample() {
  console.log('\n=== Progress Tracking Example ===');
  
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    refreshToken: GOOGLE_REFRESH_TOKEN
  });
  
  const startTime = Date.now();
  
  const callbacks: EmailStreamCallbacks = {
    onBatch: async (emails, progress) => {
      const percentage = progress.total ? 
        Math.round((progress.current / progress.total) * 100) : 
        'unknown';
      
      console.log(`📧 Batch ${progress.batchCount}: ${emails.length} emails (Total: ${progress.current}/${progress.total || '?'} - ${percentage}%)`);
      
      // Simulate processing each email
      for (const email of emails) {
        // Process email here
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
      }
    },
    
    onProgress: async (progress) => {
      if (progress.current % 100 === 0) {
        const elapsed = Date.now() - startTime;
        const rate = progress.current / (elapsed / 1000);
        console.log(`⏱️  Progress: ${progress.current} emails processed (${rate.toFixed(1)} emails/sec)`);
      }
    },
    
    onError: async (error, progress) => {
      console.error(`❌ Error at batch ${progress.batchCount}:`, error.message);
      // Could implement retry logic here
    },
    
    onComplete: async (summary) => {
      console.log(`\n🎉 Streaming completed!`);
      console.log(`   Total processed: ${summary.totalProcessed}`);
      console.log(`   Total batches: ${summary.totalBatches}`);
      console.log(`   Errors: ${summary.errors}`);
      console.log(`   Duration: ${summary.duration}ms`);
      console.log(`   Average rate: ${(summary.totalProcessed / (summary.duration / 1000)).toFixed(1)} emails/sec`);
    }
  };
  
  await gmailAdapter.fetchEmailsStream({
    batchSize: 30,
    query: 'is:unread',
    includeBody: false,
    includeAttachments: false
  }, callbacks);
}

/**
 * Example 4: Error recovery and resumption
 */
async function errorRecoveryExample() {
  console.log('\n=== Error Recovery Example ===');
  
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    refreshToken: GOOGLE_REFRESH_TOKEN
  });
  
  let lastProcessedId: string | undefined;
  let totalProcessed = 0;
  
  try {
    for await (const emailBatch of gmailAdapter.streamEmails({ 
      batchSize: 20,
      query: 'label:inbox'
    })) {
      try {
        // Simulate processing with potential failure
        for (const email of emailBatch) {
          // Simulate random failure (5% chance)
          if (Math.random() < 0.05) {
            throw new Error(`Simulated processing error for email ${email.id}`);
          }
          
          lastProcessedId = email.id;
          totalProcessed++;
          
          if (totalProcessed % 10 === 0) {
            console.log(`✅ Processed ${totalProcessed} emails, last ID: ${lastProcessedId}`);
          }
        }
        
      } catch (error) {
        console.error('❌ Batch failed, implementing recovery:', error.message);
        
        // In a real app, you would save the lastProcessedId and resume from there
        console.log(`💾 Checkpoint saved: last processed ID = ${lastProcessedId}`);
        
        // Continue processing (in real app, you might restart from checkpoint)
        continue;
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.log(`💾 Can resume from email ID: ${lastProcessedId}`);
  }
  
  console.log(`✅ Error recovery example completed. Total processed: ${totalProcessed}`);
}

/**
 * Example 5: Memory usage comparison
 */
async function memoryComparisonExample() {
  console.log('\n=== Memory Usage Comparison ===');
  
  const gmailAdapter = new GmailAdapter();
  await gmailAdapter.initialize({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    refreshToken: GOOGLE_REFRESH_TOKEN
  });
  
  console.log('🔍 Testing memory usage patterns...');
  
  // Show memory before
  const memBefore = process.memoryUsage();
  console.log(`Memory before: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);
  
  // Traditional approach (simulated - don't actually do this)
  console.log('\n❌ Traditional approach (getAllPages):');
  console.log('   This would load ALL emails into memory at once');
  console.log('   For 10,000 emails: ~2GB+ memory usage');
  console.log('   Risk of memory errors and timeouts');
  
  // Streaming approach
  console.log('\n✅ Streaming approach:');
  let streamProcessed = 0;
  for await (const emailBatch of gmailAdapter.streamEmails({ 
    batchSize: 25,
    maxEmails: 100, // Limit for demo
    includeAttachments: false,
    includeBody: false
  })) {
    streamProcessed += emailBatch.length;
    
    if (streamProcessed % 50 === 0) {
      const memNow = process.memoryUsage();
      console.log(`   Processed ${streamProcessed}, Memory: ${Math.round(memNow.heapUsed / 1024 / 1024)}MB`);
    }
  }
  
  const memAfter = process.memoryUsage();
  console.log(`\nMemory after streaming: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
  console.log(`Memory increase: ${Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)}MB`);
  console.log(`✅ Constant memory usage regardless of total email count!`);
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    console.log('🚀 Gmail Streaming Examples');
    console.log('===========================');
    
    await simpleStreamingExample();
    await databaseStreamingExample();
    await progressTrackingExample();
    await errorRecoveryExample();
    await memoryComparisonExample();
    
    console.log('\n🎉 All streaming examples completed successfully!');
    console.log('\nKey Benefits Demonstrated:');
    console.log('✅ Memory efficient - constant memory usage');
    console.log('✅ Progress tracking - real-time feedback');
    console.log('✅ Error resilience - graceful error handling');
    console.log('✅ Scalability - handles large datasets');
    console.log('✅ Flexibility - multiple integration patterns');
    
  } catch (error) {
    console.error('\n❌ Example failed:', error);
  }
}

// Run examples
runAllExamples().catch(console.error); 