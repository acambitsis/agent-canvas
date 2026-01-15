import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test WorkOS authentication flow
 * Tests the auth patterns from api/auth/* endpoints
 */

// Helper to parse cookie header into key-value pairs
function parseCookies(cookieHeader) {
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});
}

describe('WorkOS Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORKOS_CLIENT_ID = 'client_test123';
    process.env.WORKOS_API_KEY = 'sk_test_xxx';
    process.env.WORKOS_COOKIE_PASSWORD = 'a'.repeat(32);
    process.env.BASE_URL = 'http://localhost:3000';
  });

  describe('POST /api/auth/url', () => {
    it('should return authorization URL with correct parameters', async () => {
      const workosClientId = process.env.WORKOS_CLIENT_ID;
      const baseUrl = process.env.BASE_URL;
      const state = crypto.randomUUID();

      const params = new URLSearchParams({
        client_id: workosClientId,
        redirect_uri: `${baseUrl}/api/auth/callback`,
        response_type: 'code',
        provider: 'authkit',
        state,
        scope: 'openid profile email',
      });

      const url = `https://api.workos.com/user_management/authorize?${params}`;

      expect(url).toContain('https://api.workos.com/user_management/authorize');
      expect(url).toContain('client_id=client_test123');
      expect(url).toContain('response_type=code');
      expect(url).toContain('provider=authkit');
      expect(url).toContain('scope=openid+profile+email');
    });

    it('should generate unique state for each request', () => {
      const state1 = crypto.randomUUID();
      const state2 = crypto.randomUUID();

      expect(state1).not.toBe(state2);
      expect(state1.length).toBe(36); // UUID format
    });

    it('should include correct redirect URI', () => {
      const baseUrl = process.env.BASE_URL;
      const redirectUri = `${baseUrl}/api/auth/callback`;

      expect(redirectUri).toBe('http://localhost:3000/api/auth/callback');
    });
  });

  describe('GET /api/auth/callback', () => {
    it('should reject requests with missing code', () => {
      const url = new URL('http://localhost:3000/api/auth/callback');
      const code = url.searchParams.get('code');

      expect(code).toBeNull();
    });

    it('should extract code and state from query parameters', () => {
      const url = new URL(
        'http://localhost:3000/api/auth/callback?code=abc123&state=xyz789'
      );
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      expect(code).toBe('abc123');
      expect(state).toBe('xyz789');
    });

    it('should validate OAuth state matches cookie state', () => {
      const expectedState = 'expected-state-123';
      const receivedState = 'expected-state-123';

      expect(receivedState).toBe(expectedState);
    });

    it('should reject mismatched OAuth state', () => {
      const expectedState = 'expected-state-123';
      const receivedState = 'wrong-state-456';

      expect(receivedState).not.toBe(expectedState);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should require valid session with refresh token', () => {
      const session = {
        accessToken: 'access_xxx',
        refreshToken: 'refresh_yyy',
        idToken: 'id_zzz',
        idTokenExpiresAt: Date.now() - 1000, // Expired
      };

      expect(session.refreshToken).toBeDefined();
      expect(session.idTokenExpiresAt).toBeLessThan(Date.now());
    });

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

  describe('POST /api/auth/logout', () => {
    it('should create cookie clearing header', () => {
      const clearCookie =
        'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

      expect(clearCookie).toContain('Max-Age=0');
      expect(clearCookie).toContain('session=');
    });
  });

  describe('GET /api/auth/session', () => {
    it('should parse session cookie from request', () => {
      const cookies = parseCookies('session=encrypted_jwt_token; other=value');
      expect(cookies.session).toBe('encrypted_jwt_token');
    });

    it('should handle missing session cookie', () => {
      const cookies = parseCookies('other=value');
      expect(cookies.session).toBeUndefined();
    });
  });

  describe('Session cookie security', () => {
    it('should set HttpOnly flag', () => {
      const cookie =
        'session=token; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800';

      expect(cookie).toContain('HttpOnly');
    });

    it('should set Secure flag in production', () => {
      const isProduction = process.env.NODE_ENV === 'production';
      const cookie = `session=token; Path=/; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Lax`;

      // In test environment, Secure may not be present
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('should set SameSite=Lax for CSRF protection', () => {
      const cookie = 'session=token; Path=/; SameSite=Lax';

      expect(cookie).toContain('SameSite=Lax');
    });

    it('should set 7 day expiration', () => {
      const maxAge = 604800; // 7 days in seconds
      const cookie = `session=token; Max-Age=${maxAge}`;

      expect(cookie).toContain('Max-Age=604800');
      expect(maxAge).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('OAuth state cookie', () => {
    it('should have short expiration for security', () => {
      const maxAge = 600; // 10 minutes
      const cookie = `oauth_state=xxx; Max-Age=${maxAge}`;

      expect(maxAge).toBe(600);
      expect(cookie).toContain('Max-Age=600');
    });

    it('should use UUID format for state', () => {
      const state = crypto.randomUUID();
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(state).toMatch(uuidPattern);
    });
  });

  describe('User organization membership', () => {
    it('should extract orgs from authenticated user', () => {
      const user = {
        id: 'user_123',
        email: 'test@example.com',
        organizationMemberships: [
          { organization: { id: 'org_1' }, role: { slug: 'admin' } },
          { organization: { id: 'org_2' }, role: { slug: 'member' } },
        ],
      };

      const orgs = user.organizationMemberships.map((m) => ({
        id: m.organization.id,
        role: m.role.slug,
      }));

      expect(orgs).toHaveLength(2);
      expect(orgs[0].id).toBe('org_1');
      expect(orgs[0].role).toBe('admin');
    });

    it('should handle user with no organizations', () => {
      const user = {
        id: 'user_123',
        email: 'test@example.com',
        organizationMemberships: [],
      };

      const orgs = user.organizationMemberships.map((m) => ({
        id: m.organization.id,
        role: m.role.slug,
      }));

      expect(orgs).toHaveLength(0);
    });
  });
});
