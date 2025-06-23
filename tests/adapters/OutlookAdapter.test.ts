
import { OutlookAdapter } from '../../src/adapters/OutlookAdapter.js';
import { EmailParserService } from '../../src/services/EmailParserService.js';
import { OAuthService } from '../../src/auth/OAuthService.js';
import { OutlookOAuthProvider } from '../../src/auth/providers/OutlookOAuthProvider.js';
import { mockData } from '../setup.js';

// Mock dependencies
jest.mock('@microsoft/microsoft-graph-client');
jest.mock('@azure/msal-node');
jest.mock('../../src/services/EmailParserService');
jest.mock('../../src/auth/OAuthService');
jest.mock('../../src/auth/providers/OutlookOAuthProvider');

describe('OutlookAdapter', () => {
  let adapter: OutlookAdapter;
  let mockMsalApp: any;
  let mockGraphClient: any;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock objects for MSAL and Graph API
    mockMsalApp = {
      acquireTokenByCode: jest.fn().mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresOn: new Date(Date.now() + 3600000)
      }),
      acquireTokenByRefreshToken: jest.fn().mockResolvedValue({
        accessToken: 'mock-refreshed-token',
        expiresOn: new Date(Date.now() + 3600000)
      })
    };
    
    mockGraphClient = {
      api: jest.fn().mockReturnThis(),
      get: jest.fn(),
      post: jest.fn(),
      select: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      top: jest.fn().mockReturnThis(),
      orderby: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      expand: jest.fn().mockReturnThis(),
      headers: jest.fn().mockReturnThis(),
      search: jest.fn().mockReturnThis(),
      skipToken: jest.fn().mockReturnThis(),
    };
    
    // Set up mock response for message listing
    mockGraphClient.get.mockImplementation((path:string) => {
      if (path === '/me/messages') {
        return Promise.resolve({
          value: [
            { 
              id: 'msg1',
              subject: 'Test Email 1',
              from: { emailAddress: { address: 'sender1@example.com' }},
              toRecipients: [{ emailAddress: { address: 'recipient1@example.com' }}]
            },
            { 
              id: 'msg2',
              subject: 'Test Email 2',
              from: { emailAddress: { address: 'sender2@example.com' }},
              toRecipients: [{ emailAddress: { address: 'recipient2@example.com' }}]
            }
          ],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/messages?$skipToken=token123'
        });
      } else if (path?.includes('/me/messages/msg')) {
        // For individual message fetches
        return Promise.resolve({
          id: path.split('/').pop(),
          subject: 'Test Email Details',
          body: {
            contentType: 'html',
            content: '<p>This is the email body</p>'
          }
        });
      } else if (path === '/me/mailFolders') {
        // For folders
        return Promise.resolve({
          value: [
            { id: 'inbox', displayName: 'Inbox' },
            { id: 'sent', displayName: 'Sent Items' }
          ]
        });
      }
      return Promise.resolve({});
    });
    
    // Mock the ConfidentialClientApplication and Client from the respective packages
    const { ConfidentialClientApplication } = require('@azure/msal-node');
    ConfidentialClientApplication.mockReturnValue(mockMsalApp);
    
    const { Client } = require('@microsoft/microsoft-graph-client');
    Client.init = jest.fn().mockReturnValue(mockGraphClient);
    
    // Mock EmailParserService
    const MockEmailParserService = EmailParserService as jest.MockedClass<typeof EmailParserService>;
    MockEmailParserService.prototype.parseEmail.mockResolvedValue({
      id: 'test-email-id',
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      subject: 'Test Email',
      bodyText: 'This is a test email',
      bodyHtml: '<p>This is a test email</p>',
      attachments: [],
      date: new Date(),
      provider: 'outlook',
      labels: ['inbox']
    } as any);
    
    adapter = new OutlookAdapter();
  });
  
  describe('initialize', () => {
    test('should initialize with refresh token', async () => {
      await adapter.initialize(mockData.outlookCredentials);
      
      expect(mockMsalApp.acquireTokenByRefreshToken).toHaveBeenCalled();
    });
    
    test('should initialize with auth code', async () => {
      const credentials = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        authCode: 'test-auth-code',
        redirectUri: 'http://localhost:3000/oauth/callback'
      };
      
      await adapter.initialize(credentials);
      
      expect(mockMsalApp.acquireTokenByCode).toHaveBeenCalled();
    });
    
    test('should throw error if neither refresh token nor auth code is provided', async () => {
      const credentials = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      };
      
      await expect(adapter.initialize(credentials as any)).rejects.toThrow(
        'Either refreshToken or authCode must be provided in the credentials'
      );
    });
    
    test('should throw error if auth code is provided without redirect URI', async () => {
      const credentials = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        authCode: 'test-auth-code'
        // Missing redirectUri
      };
      
      await expect(adapter.initialize(credentials as any)).rejects.toThrow(
        'redirectUri is required when using authCode for authentication'
      );
    });
  });
  
  describe('authenticate', () => {
    test('should authenticate successfully', async () => {
      await adapter.initialize(mockData.outlookCredentials);
      await adapter.authenticate();
      
      expect(mockMsalApp.acquireTokenByRefreshToken).toHaveBeenCalled();
    });
  });
  
  describe('startOAuthFlow', () => {
    test('should start OAuth flow correctly', async () => {
      const mockOAuthService = OAuthService as jest.MockedClass<typeof OAuthService>;
      const mockStartOAuthFlow = jest.fn().mockResolvedValue('https://login.microsoftonline.com/oauth2/authorize');
      mockOAuthService.prototype.startOAuthFlow = mockStartOAuthFlow;
      
      const result = await OutlookAdapter.startOAuthFlow(
        'client-id',
        'client-secret',
        'redirect-uri',
        '/callback',
        3000
      );
      
      expect(mockStartOAuthFlow).toHaveBeenCalled();
      expect(result).toBe('https://login.microsoftonline.com/oauth2/authorize');
    });
  });
  
  describe('handleOAuthCallback', () => {
    test('should handle OAuth callback correctly', async () => {
      const mockOAuthService = OAuthService as jest.MockedClass<typeof OAuthService>;
      const mockHandleCallback = jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer'
      });
      mockOAuthService.prototype.handleCallback = mockHandleCallback;
      
      const result = await OutlookAdapter.handleOAuthCallback(
        'auth-code',
        'client-id',
        'client-secret',
        'redirect-uri'
      );
      
      expect(mockHandleCallback).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });
    });
  });
  
  describe('fetchEmails', () => {
    beforeEach(async () => {
      await adapter.initialize(mockData.outlookCredentials);
    });
    
    test('should fetch emails with default options', async () => {
      const result = await adapter.fetchEmails({});
      
      expect(mockGraphClient.api).toHaveBeenCalledWith('/me/messages');
      expect(result).toEqual({
        emails: expect.any(Array),
        nextPageToken: undefined,
        totalCount: undefined
      });
      expect(result.emails.length).toBe(0);
    });
    
    test('should apply query filters correctly', async () => {
      const options = {
        limit: 5,
        query: 'importance:high',
        unreadOnly: true
      };
      
      await adapter.fetchEmails(options);
      
      expect(mockGraphClient.search).toHaveBeenCalled();
      expect(mockGraphClient.filter).toHaveBeenCalled();
      expect(mockGraphClient.top).toHaveBeenCalledWith(5);
    });
  });
});
