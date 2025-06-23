const mockUserMessages = {
  list: jest.fn().mockResolvedValue({
    data: {
      messages: [
        { id: 'email1' },
        { id: 'email2' }
      ],
      nextPageToken: 'next-page-token'
    }
  }),
  get: jest.fn().mockImplementation((params) => {
    return {
      data: {
        id: params.id,
        raw: Buffer.from('test email content').toString('base64'),
        labelIds: ['INBOX'],
        threadId: `thread-${params.id}`
      }
    };
  })
};

const mockUserLabels = {
  list: jest.fn().mockResolvedValue({
    data: {
      labels: [
        { id: 'INBOX', name: 'INBOX' },
        { id: 'SENT', name: 'SENT' }
      ]
    }
  }),
  get: jest.fn()
};

const mockUserThreads = {
  list: jest.fn(),
  get: jest.fn()
};

const mockUserProfile = {
  getProfile: jest.fn().mockResolvedValue({
    data: {
      emailAddress: 'test@example.com',
      messagesTotal: 100,
      threadsTotal: 50
    }
  })
};

const mockGmailInstance = {
  users: {
    getProfile: (...args) => mockUserProfile.getProfile(...args),
    messages: {
      list: (...args) => mockUserMessages.list(...args),
      get: (...args) => mockUserMessages.get(...args)
    },
    labels: {
      list: (...args) => mockUserLabels.list(...args),
      get: (...args) => mockUserLabels.get(...args)
    },
    threads: {
      list: (...args) => mockUserThreads.list(...args),
      get: (...args) => mockUserThreads.get(...args)
    }
  }
};

const mockOAuth2Client = {
  setCredentials: jest.fn(),
  getToken: jest.fn().mockResolvedValue({
    tokens: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expiry_date: Date.now() + 3600 * 1000
    }
  })
};

module.exports = {
  google: {
    gmail: jest.fn(() => mockGmailInstance),
    auth: {
      OAuth2: jest.fn().mockImplementation(() => mockOAuth2Client)
    }
  },
  mockUserMessages,
  mockUserLabels,
  mockUserThreads,
  mockUserProfile,
  mockOAuth2Client
};
