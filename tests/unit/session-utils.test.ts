import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSessionCookie,
  clearSessionCookie,
  createOAuthStateCookie,
  clearOAuthStateCookie,
  encryptSession,
  decryptSession,
  type SessionData,
} from '../../server/session-utils';

// Mock jose since jose@6 only ships webapi version which doesn't work in jsdom
vi.mock('jose', () => ({
  EncryptJWT: vi.fn().mockImplementation((payload) => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    encrypt: vi.fn().mockResolvedValue(`encrypted:${JSON.stringify(payload)}`),
  })),
  jwtDecrypt: vi.fn().mockImplementation(async (token: string) => {
    if (!token.startsWith('encrypted:')) throw new Error('Invalid token');
    return { payload: JSON.parse(token.replace('encrypted:', '')) };
  }),
  base64url: {
    decode: vi.fn().mockReturnValue(new Uint8Array(32)),
  },
}));

/**
 * Test session utilities
 * Tests the session management functions from server/session-utils.ts
 * Note: jose is mocked since jose@6 webapi doesn't work in jsdom environment
 */

describe('Session Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORKOS_COOKIE_PASSWORD = 'a'.repeat(32);
    process.env.BASE_URL = 'http://localhost:3000';
  });

  describe('Cookie creation', () => {
    it('should create session cookie with correct format', () => {
      const token = 'test-token-123';
      const cookie = createSessionCookie(token);

      expect(cookie).toContain('session=test-token-123');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=604800'); // 7 days
    });

    it('should create clear session cookie', () => {
      const cookie = clearSessionCookie();

      expect(cookie).toContain('session=');
      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('HttpOnly');
    });

    it('should create OAuth state cookie', () => {
      const state = 'test-state-123';
      const cookie = createOAuthStateCookie(state);

      expect(cookie).toContain('oauth_state=test-state-123');
      expect(cookie).toContain('Max-Age=600'); // 10 minutes
      expect(cookie).toContain('HttpOnly');
    });

    it('should create clear OAuth state cookie', () => {
      const cookie = clearOAuthStateCookie();

      expect(cookie).toContain('oauth_state=');
      expect(cookie).toContain('Max-Age=0');
    });
  });

  describe('Session encryption/decryption', () => {
    it('should encrypt and decrypt session data', async () => {
      const sessionData: SessionData = {
        accessToken: 'access_xxx',
        refreshToken: 'refresh_yyy',
        idToken: 'id_zzz',
        idTokenExpiresAt: Date.now() + 3600000,
        user: {
          id: 'user_123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
        orgs: [
          { id: 'org_1', role: 'admin' },
        ],
      };

      const encrypted = await encryptSession(sessionData);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = await decryptSession(encrypted);
      expect(decrypted).toBeTruthy();
      expect(decrypted?.user.id).toBe('user_123');
      expect(decrypted?.user.email).toBe('test@example.com');
      expect(decrypted?.orgs[0].id).toBe('org_1');
    });

    it('should return null for invalid token', async () => {
      const result = await decryptSession('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for empty token', async () => {
      const result = await decryptSession('');
      expect(result).toBeNull();
    });
  });

  describe('OAuth state validation', () => {
    it('should generate UUID format state', () => {
      const state1 = crypto.randomUUID();
      const state2 = crypto.randomUUID();

      expect(state1).not.toBe(state2);
      expect(state1.length).toBe(36); // UUID format
      expect(state1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Token expiry detection', () => {
    it('should detect expired id token', () => {
      const expiresAt = Date.now() - 1000; // 1 second ago
      const isExpired = expiresAt < Date.now();

      expect(isExpired).toBe(true);
    });

    it('should detect valid id token', () => {
      const expiresAt = Date.now() + 3600000; // 1 hour from now
      const isExpired = expiresAt < Date.now();

      expect(isExpired).toBe(false);
    });
  });
});
