
import { MemoryTokenStorage } from '../../../src/auth/storage/MemoryTokenStorage.js';
import { mockData } from '../../setup.js';

describe('MemoryTokenStorage', () => {
  let storage: MemoryTokenStorage;
  
  beforeEach(() => {
    storage = new MemoryTokenStorage();
  });
  
  test('should save tokens for a user', async () => {
    await storage.saveTokens('user123', mockData.tokenData);
    
    const tokens = await storage.getTokens('user123');
    expect(tokens).toEqual(mockData.tokenData);
  });
  
  test('should update tokens for a user', async () => {
    // First save initial tokens
    await storage.saveTokens('user123', mockData.tokenData);
    
    // Then update with new tokens
    const updatedTokens = {
      ...mockData.tokenData,
      accessToken: 'updated-access-token',
      expiresAt: Date.now() + 7200000
    };
    
    await storage.updateTokens('user123', updatedTokens);
    
    // Check that tokens were updated
    const tokens = await storage.getTokens('user123');
    expect(tokens).toEqual(updatedTokens);
  });
  
  test('should delete tokens for a user', async () => {
    await storage.saveTokens('user123', mockData.tokenData);
    await storage.deleteTokens('user123');
    
    const tokens = await storage.getTokens('user123');
    expect(tokens).toBeNull();
  });
  
  test('should return null for non-existent user', async () => {
    const tokens = await storage.getTokens('nonexistent');
    expect(tokens).toBeNull();
  });
  
  test('should handle updating non-existent tokens', async () => {
    // Should not throw an error
    await expect(storage.updateTokens('nonexistent', mockData.tokenData))
      .resolves.toBeUndefined();
    
    // Should create the tokens
    const tokens = await storage.getTokens('nonexistent');
    expect(tokens).toEqual(mockData.tokenData);
  });
  
  test('should handle deleting non-existent tokens', async () => {
    // Should not throw an error but return false (token not found)
    const result = await storage.deleteTokens('nonexistent');
    expect(result).toBe(false);
  });
});
