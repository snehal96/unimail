
import { GmailAdapter } from '../../src/adapters/GmailAdapter.js';
import { EmailParserService } from '../../src/services/EmailParserService.js';
import { OAuthService } from '../../src/auth/OAuthService.js';
import { GoogleOAuthProvider } from '../../src/auth/providers/GoogleOAuthProvider.js';
import { mockData } from '../setup.js';

// Mock dependencies
jest.mock('googleapis');
jest.mock('google-auth-library');
jest.mock('../../src/services/EmailParserService');
jest.mock('../../src/auth/OAuthService');
jest.mock('../../src/auth/providers/GoogleOAuthProvider');

describe('GmailAdapter', () => {
  let adapter: GmailAdapter;
  let mockOAuth2Client: any;
  let mockGmailApi: any;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock objects for Gmail API and OAuth client
    mockOAuth2Client = {
      setCredentials: jest.fn(),
      getToken: jest.fn().mockResolvedValue({ 
        tokens: { 
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expiry_date: Date.now() + 3600000
        } 
      }),
      getAccessToken: jest.fn().mockResolvedValue({ token: 'mock-access-token' })
    };
    
    mockGmailApi = {
      users: {
        messages: {
          list: jest.fn().mockResolvedValue({
            data: {
              messages: [
                { id: 'msg1', threadId: 'thread1' },
                { id: 'msg2', threadId: 'thread2' }
              ],
              nextPageToken: 'next-page-token'
            }
          }),
          get: jest.fn().mockImplementation(({ id }) => {
            return Promise.resolve({
              data: {
                id,
                threadId: `thread-${id}`,
                raw: Buffer.from('mock email content').toString('base64'),
                labelIds: ['INBOX', 'UNREAD'],
                snippet: 'This is a snippet...'
              }
            });
          })
        },
        labels: {
          list: jest.fn().mockResolvedValue({
            data: {
              labels: [
                { id: 'label1', name: 'Important' },
                { id: 'label2', name: 'Work' }
              ]
            }
          })
        }
      }
    };
    
    // Mock the google-auth-library and googleapis functions
    const { google } = require('googleapis');
    google.auth.OAuth2.mockReturnValue(mockOAuth2Client);
    google.gmail.mockReturnValue(mockGmailApi);
    
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
      provider: 'gmail',
      labels: ['INBOX']
    } as any);
    
    adapter = new GmailAdapter();
  });
  
  describe('initialize', () => {
    test('should initialize with refresh token', async () => {
      await adapter.initialize(mockData.gmailCredentials);
      
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'test-refresh-token'
      });
    });
    
    test('should initialize with auth code', async () => {
      const credentials = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        authCode: 'test-auth-code',
        redirectUri: 'http://localhost:3000/oauth/callback'
      };
      
      await adapter.initialize(credentials);
      
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith('test-auth-code');
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalled();
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
      await adapter.initialize(mockData.gmailCredentials);
      await adapter.authenticate();
      
      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalled();
    });
    
    test('should throw error if authentication fails', async () => {
      await adapter.initialize(mockData.gmailCredentials);
      
      mockOAuth2Client.getAccessToken.mockRejectedValueOnce(new Error('Auth error'));
      
      await expect(adapter.authenticate()).rejects.toThrow('Gmail authentication failed: Auth error');
    });
    
    test('should throw specific error for invalid grant', async () => {
      await adapter.initialize(mockData.gmailCredentials);
      
      mockOAuth2Client.getAccessToken.mockRejectedValueOnce(new Error('invalid_grant'));
      
      await expect(adapter.authenticate()).rejects.toThrow(
        'Gmail authentication failed: Invalid grant. Refresh token might be expired or revoked.'
      );
    });
  });
  
  describe('startOAuthFlow', () => {
    test('should start OAuth flow correctly', async () => {
      const mockOAuthService = OAuthService as jest.MockedClass<typeof OAuthService>;
      const mockStartOAuthFlow = jest.fn().mockResolvedValue('https://accounts.google.com/auth');
      mockOAuthService.prototype.startOAuthFlow = mockStartOAuthFlow;
      
      const result = await GmailAdapter.startOAuthFlow(
        'client-id',
        'client-secret',
        'redirect-uri',
        3000,
        '/callback'
      );
      
      expect(mockStartOAuthFlow).toHaveBeenCalled();
      expect(result).toBe('https://accounts.google.com/auth');
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
      
      const result = await GmailAdapter.handleOAuthCallback(
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
      await adapter.initialize(mockData.gmailCredentials);
    });
    
    test('should fetch emails with default options', async () => {
      const result = await adapter.fetchEmails({});
      
      expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        maxResults: 10,
        q: undefined,
        pageToken: undefined
      });
      expect(result).toEqual({
        emails: expect.any(Array),
        nextPageToken: 'next-page-token',
        totalCount: undefined
      });
      expect(result.emails.length).toBe(2);
    });
    
    test('should apply query filters correctly', async () => {
      const options = {
        limit: 5,
        query: 'is:important',
        since: new Date('2023-01-01'),
        unreadOnly: true
      };
      
      await adapter.fetchEmails(options);
      
      expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        maxResults: 5,
        q: 'is:important after:2023/1/1 is:unread'
      });
    });
    
    test('should handle empty response', async () => {
      mockGmailApi.users.messages.list.mockResolvedValueOnce({
        data: {} // No messages property
      });
      
      const result = await adapter.fetchEmails({});
      
      expect(result).toEqual({
        emails: [],
        nextPageToken: undefined,
        totalCount: undefined
      });
    });
  });
});
