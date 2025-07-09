import { ITokenStorage, TokenData } from '../interfaces.js';

/**
 * Simple in-memory implementation of token storage.
 * Note: This is NOT suitable for production use as tokens are lost when the process exits.
 * It's intended for testing and demonstration purposes only.
 */
export class MemoryTokenStorage implements ITokenStorage {
  private tokenStore: Map<string, TokenData> = new Map();

  /**
   * Save tokens for a user
   */
  public async saveTokens(userId: string, tokens: TokenData): Promise<void> {
    this.tokenStore.set(userId, tokens);
  }

  /**
   * Retrieve tokens for a user
   */
  public async getTokens(userId: string): Promise<TokenData | null> {
    const tokens = this.tokenStore.get(userId);
    return tokens || null;
  }

  /**
   * Update tokens for a user
   */
  public async updateTokens(userId: string, tokens: TokenData): Promise<void> {
    // Merge with existing tokens if they exist
    const existingTokens = this.tokenStore.get(userId);
    if (existingTokens) {
      this.tokenStore.set(userId, {
        ...existingTokens,
        ...tokens,
        // Preserve refresh token if not provided in update
        refreshToken: tokens.refreshToken || existingTokens.refreshToken
      });
    } else {
      // If no existing tokens, just save the new ones
      this.tokenStore.set(userId, tokens);
    }
  }

  /**
   * Delete tokens for a user
   */
  public async deleteTokens(userId: string): Promise<boolean> {
    return this.tokenStore.delete(userId);
  }
}
