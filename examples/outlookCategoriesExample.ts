import { OutlookAdapter, NormalizedEmail } from '../src';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

const {
  MICROSOFT_CLIENT_ID = '',
  MICROSOFT_CLIENT_SECRET = '',
  MICROSOFT_REFRESH_TOKEN = '',
  MICROSOFT_TENANT_ID = '', // Optional
} = process.env;

if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || !MICROSOFT_REFRESH_TOKEN) {
  console.error('Missing required environment variables. Please set:');
  console.error('MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN');
  process.exit(1);
}

/**
 * Example demonstrating how to work with Outlook categories
 */
async function outlookCategoriesExample() {
  try {
    console.log('Initializing OutlookAdapter...');
    
    // Create and initialize the Outlook adapter
    const outlookAdapter = new OutlookAdapter();
    await outlookAdapter.initialize({
      clientId: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
      refreshToken: MICROSOFT_REFRESH_TOKEN,
      tenantId: MICROSOFT_TENANT_ID || undefined,
    });
    
    console.log('OutlookAdapter initialized successfully.');
    
    // Fetch a larger set of emails to find those with categories
    const allEmailsResponse = await outlookAdapter.fetchEmails({
      limit: 30,
      includeBody: false, // For faster fetching
      includeAttachments: false, // For faster fetching
    });
    
    console.log(`Fetched ${allEmailsResponse.emails.length} emails for category analysis.`);
    
    // Group emails by category
    const emailsByCategory = new Map<string, NormalizedEmail[]>();
    
    // Add all emails to appropriate categories
    for (const email of allEmailsResponse.emails) {
      if (email.labels && email.labels.length > 0) {
        for (const category of email.labels) {
          if (!emailsByCategory.has(category)) {
            emailsByCategory.set(category, []);
          }
          emailsByCategory.get(category)!.push(email);
        }
      } else {
        // Handle emails with no categories
        const noCategoryKey = 'NO_CATEGORY';
        if (!emailsByCategory.has(noCategoryKey)) {
          emailsByCategory.set(noCategoryKey, []);
        }
        emailsByCategory.get(noCategoryKey)!.push(email);
      }
    }
    
    // Display results of grouping
    console.log('\nEmail distribution by category:');
    for (const [category, emails] of emailsByCategory.entries()) {
      console.log(`  ${category}: ${emails.length} emails`);
    }
    
    // Find the most used categories
    const categoryCounts = Array.from(emailsByCategory.entries())
      .sort((a, b) => b[1].length - a[1].length);
    
    console.log('\nTop categories by usage:');
    categoryCounts.slice(0, 5).forEach(([category, emails], index) => {
      console.log(`  ${index + 1}. ${category}: ${emails.length} emails`);
    });
    
    // Display some email subjects from the most used category if available
    if (categoryCounts.length > 0 && categoryCounts[0][1].length > 0) {
      const [topCategory, topCategoryEmails] = categoryCounts[0];
      console.log(`\nExample emails from category "${topCategory}":`);
      
      topCategoryEmails.slice(0, 3).forEach((email, index) => {
        console.log(`  ${index + 1}. Subject: ${email.subject || '(No subject)'}`);
        console.log(`     From: ${email.from}`);
        console.log(`     Date: ${email.date.toLocaleString()}`);
      });
    }
    
    // Save results to file
    saveResultsToFile(emailsByCategory);
    
  } catch (error) {
    console.error('Error in Outlook categories example:', error);
  }
}

/**
 * Helper function to save results to JSON files
 */
function saveResultsToFile(emailsByCategory: Map<string, NormalizedEmail[]>) {
  // Create sample_result directory if it doesn't exist
  const resultDir = path.join(__dirname, 'sample_result');
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir, { recursive: true });
  }
  
  // Convert Map to a regular object for JSON serialization
  const categoryGroups: Record<string, any[]> = {};
  for (const [category, emails] of emailsByCategory.entries()) {
    categoryGroups[category] = emails.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      date: email.date,
      categories: email.labels
    }));
  }
  
  // Save emails by category
  fs.writeFileSync(
    path.join(resultDir, 'outlook_emails_by_category.json'),
    JSON.stringify(categoryGroups, null, 2)
  );
  
  console.log('\nResults saved to:');
  console.log('- outlook_emails_by_category.json');
}

// Run the example
outlookCategoriesExample().catch(console.error);
