
import { OutlookOAuthProvider } from '../../../src/auth/providers/OutlookOAuthProvider.js';
import { OAuthOptions } from '../../../src/auth/interfaces.js';
import { mockData } from '../../setup.js';
import { ConfidentialClientApplication } from '@azure/msal-node';

// Mock the @azure/msal-node package
jest.mock('@azure/msal-node', () => {
  return {
    ConfidentialClientApplication: jest.fn().mockImplementation(() => ({
      getAuthCodeUrl: jest.fn().mockResolvedValue('https://login.microsoftonline.com/oauth2/authorize'),
      acquireTokenByCode: jest.fn().mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresOn: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        idToken: 'test-id-token',
        scopes: ['Mail.Read']
      }),
      acquireTokenByRefreshToken: jest.fn().mockResolvedValue({
        accessToken: 'refreshed-access-token',
        expiresOn: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        idToken: 'refreshed-id-token',
        scopes: ['Mail.Read']
        // Note: acquireTokenByRefreshToken does not return a new refresh token
      })
    }))
  };
});

const mockOAuth2 = ConfidentialClientApplication as unknown as jest.Mock;

describe('OutlookOAuthProvider', () => {
  let provider: OutlookOAuthProvider;
  let options: OAuthOptions;
  
  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OutlookOAuthProvider();
    options = {
      ...mockData.oauthOptions,
      scopes: ['https://graph.microsoft.com/Mail.Read']
    };
  });
  
  describe('initializeOAuthFlow', () => {
    test('should initialize OAuth flow with correct parameters', async () => {
      const result = await provider.initializeOAuthFlow(options);
      
      expect(ConfidentialClientApplication).toHaveBeenCalledWith({
        auth: {
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          authority: 'https://login.microsoftonline.com/common'
        }
      });
      
      const mockMsalApp = mockOAuth2.mock.results[0].value;
      expect(mockMsalApp.getAuthCodeUrl).toHaveBeenCalledWith({
        scopes: ['https://graph.microsoft.com/Mail.Read'],
        redirectUri: options.redirectUri,
        prompt: "consent",
        state: "test-state"
      });
      
      expect(result).toEqual({
        authUrl: 'https://login.microsoftonline.com/oauth2/authorize',
        state: "test-state"
      });
    });
    
    test('should pass additional options correctly', async () => {
      const extendedOptions: OAuthOptions = {
        ...options,
        prompt: 'consent',
        forceConsent: true
      };
      
      await provider.initializeOAuthFlow(extendedOptions);
      
      expect(ConfidentialClientApplication).toHaveBeenCalledWith({
        auth: {
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          authority: 'https://login.microsoftonline.com/common'
        }
      });
      
      const mockMsalApp = mockOAuth2.mock.results[0].value;
      expect(mockMsalApp.getAuthCodeUrl).toHaveBeenCalledWith({
        scopes: ['https://graph.microsoft.com/Mail.Read'],
        redirectUri: options.redirectUri,
        prompt: 'consent',
        state: "test-state"
      });
    });
  });
  
  describe('handleCallback', () => {
    test('should exchange code for tokens', async () => {
      const result = await provider.handleCallback('auth-code', options);
      
      const mockMsalApp = mockOAuth2.mock.results[0].value;
      expect(mockMsalApp.acquireTokenByCode).toHaveBeenCalledWith({
        code: 'auth-code',
        scopes: ['https://graph.microsoft.com/Mail.Read'],
        redirectUri: options.redirectUri
      });
      
      expect(result).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: expect.any(Number),
        tokenType: 'Bearer',
        idToken: 'test-id-token',
        scope: 'Mail.Read'
      });
    });
  });
  
  describe('refreshToken', () => {
    test('should refresh access token', async () => {
      const result = await provider.refreshToken('refresh-token', options);
      
      const mockMsalApp = mockOAuth2.mock.results[0].value;
      expect(mockMsalApp.acquireTokenByRefreshToken).toHaveBeenCalledWith({
        refreshToken: 'refresh-token',
        scopes: ['https://graph.microsoft.com/Mail.Read']
      });
      
      expect(result).toEqual({
        accessToken: 'refreshed-access-token',
        expiresAt: expect.any(Number),
        tokenType: 'Bearer',
        idToken: 'refreshed-id-token',
        scope: 'Mail.Read',
        refreshToken: 'refresh-token'  // Preserving the original refresh token
        // Note: no refreshToken as MSAL doesn't return it on refresh
      });
    });
    
    test('should preserve the original refresh token', async () => {
      const result = await provider.refreshToken('original-refresh-token', options);
      
      // The result should include the original refresh token even though
      // MSAL doesn't return one during the refresh operation
      expect(result.refreshToken).toBe('original-refresh-token');
    });
  });
});
