
import { GoogleOAuthProvider } from '../../../src/auth/providers/GoogleOAuthProvider.js';
import { OAuthOptions } from '../../../src/auth/interfaces.js';
import { mockData } from '../../setup.js';
import * as googleapis from 'googleapis';

// Mock the googleapis package
jest.mock('googleapis', () => {
  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth'),
          getToken: jest.fn().mockResolvedValue({
            tokens: {
              access_token: 'test-access-token',
              refresh_token: 'test-refresh-token',
              expiry_date: Date.now() + 3600000,
              token_type: 'Bearer',
              id_token: 'test-id-token',
              scope: 'https://mail.google.com/'
            }
          }),
          setCredentials: jest.fn(),
          refreshToken:  jest.fn().mockResolvedValue({
            refresh_token: 'test-refresh-token'
          }),
          refreshAccessToken: jest.fn().mockResolvedValue({
            credentials: {
              access_token: 'refreshed-access-token',
              expiry_date: Date.now() + 3600000,
              token_type: 'Bearer',
              id_token: 'refreshed-id-token',
              scope: 'https://mail.google.com/'
            }
          })
        }))
      }
    }
  };
});

const mockOAuth2 = googleapis.google.auth.OAuth2 as unknown as jest.Mock;

describe('GoogleOAuthProvider', () => {
  let provider: GoogleOAuthProvider;
  let options: OAuthOptions;
  
  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GoogleOAuthProvider();
    options = { ...mockData.oauthOptions };
  });
  
  describe('initializeOAuthFlow', () => {
    test('should initialize OAuth flow with correct parameters', async () => {
      const result = await provider.initializeOAuthFlow(options);
      
      expect(googleapis.google.auth.OAuth2).toHaveBeenCalledWith(
        options.clientId,
        options.clientSecret,
        options.redirectUri
      );
      
      const mockOAuth2Client = mockOAuth2.mock.results[0].value;
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: options.scopes,
        prompt: 'consent'
      });
      
      expect(result).toEqual({
        authUrl: 'https://accounts.google.com/o/oauth2/auth',
        state: undefined
      });
    });
    
    test('should pass additional options correctly', async () => {
      const extendedOptions: OAuthOptions = {
        ...options,
        accessType: 'offline',
        prompt: 'consent',
        forceConsent: true
      };
      
      await provider.initializeOAuthFlow(extendedOptions);

      const mockOAuth2Client = mockOAuth2.mock.results[0].value;
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: options.scopes,
        prompt: 'consent'
      });
    });
  });
  
  describe('handleCallback', () => {
    test('should exchange code for tokens', async () => {
      const result = await provider.handleCallback('auth-code', options);

      const mockOAuth2Client = mockOAuth2.mock.results[0].value;
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith('auth-code');
      
      expect(result).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: expect.any(Number),
        tokenType: 'Bearer',
        idToken: 'test-id-token',
        scope: 'https://mail.google.com/'
      });
    });
  });
  
  describe('refreshToken', () => {
    test('should refresh access token', async () => {
      const result = await provider.refreshToken('refresh-token', options);

      const mockOAuth2Client = mockOAuth2.mock.results[0].value;
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'refresh-token'
      });
      
      expect(result).toEqual({
        accessToken: 'refreshed-access-token',
        expiresAt: expect.any(Number),
        tokenType: 'Bearer',
        idToken: 'refreshed-id-token',
        scope: 'https://mail.google.com/',
        refreshToken: 'refresh-token'
      });
    });
  });
});
