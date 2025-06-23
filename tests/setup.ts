
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file if present
config({ path: path.resolve(__dirname, '../.env') });

// Add Jest matchers
expect.extend({
  toHaveDateCloseTo(received: Date, expected: Date, precision = 1000) {
    const pass = Math.abs(received.getTime() - expected.getTime()) < precision;
    return {
      message: () => `expected ${received} ${pass ? 'not' : ''} to be close to ${expected}`,
      pass
    };
  }
});

// Define some mock data that can be used across tests
export const mockData = {
  // Gmail mock data
  gmailRawEmail: Buffer.from('From: test@example.com\r\nTo: recipient@example.com\r\nSubject: Test Email\r\n\r\nThis is a test email body'),
  gmailCredentials: {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    refreshToken: 'test-refresh-token'
  },
  
  // Outlook mock data
  outlookCredentials: {
    clientId: 'test-outlook-client-id',
    clientSecret: 'test-outlook-client-secret',
    refreshToken: 'test-outlook-refresh-token'
  },
  
  // OAuth mock data
  oauthOptions: {
    clientId: 'test-oauth-client-id',
    clientSecret: 'test-oauth-client-secret',
    redirectUri: 'http://localhost:3000/oauth/callback',
    scopes: ['https://mail.google.com/'],
    state: 'test-state'
  },
  
  tokenData: {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: Date.now() + 3600 * 1000,
    tokenType: 'Bearer'
  },
  
  // Parsed email content for tests
  parsedEmail: {
    from: { text: 'sender@example.com' },
    to: [{ text: 'recipient1@example.com' }, { text: 'recipient2@example.com' }],
    cc: [{ text: 'cc1@example.com, cc2@example.com' }],
    subject: 'Test Email Subject',
    text: 'This is the plain text content',
    html: '<p>This is the HTML content</p>',
    attachments: [
      {
        filename: 'attachment1.pdf',
        contentType: 'application/pdf',
        size: 12345,
        content: Buffer.from('fake pdf content')
      },
      {
        filename: 'inline-image.png',
        contentType: 'image/png',
        size: 54321,
        content: Buffer.from('fake image content'),
        contentId: '<image123>',
        contentDisposition: 'inline'
      }
    ],
    messageId: '<test-message-id@example.com>',
    date: new Date('2023-01-15T12:30:00Z'),
    references: ['ref1', 'ref2']
  }
};
