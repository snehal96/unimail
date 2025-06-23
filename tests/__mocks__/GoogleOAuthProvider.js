module.exports = jest.fn().mockImplementation(() => {
  return {
    initializeOAuthFlow: jest.fn().mockResolvedValue({
      authUrl: 'https://accounts.google.com/o/oauth2/auth?mock=params',
      state: 'mock-state'
    }),
    handleCallback: jest.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 3600 * 1000,
      tokenType: 'Bearer'
    }),
    refreshToken: jest.fn().mockResolvedValue({
      accessToken: 'new-mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 3600 * 1000,
      tokenType: 'Bearer'
    })
  };
});
