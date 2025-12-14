import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('super-admin module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isSuperAdmin', () => {
    it('returns true for emails in SUPER_ADMIN_EMAILS', async () => {
      process.env.SUPER_ADMIN_EMAILS = 'admin@example.com,super@test.com';

      const { isSuperAdmin } = await import('../../api/lib/super-admin.js');

      expect(isSuperAdmin('admin@example.com')).toBe(true);
      expect(isSuperAdmin('super@test.com')).toBe(true);
    });

    it('returns false for emails not in SUPER_ADMIN_EMAILS', async () => {
      process.env.SUPER_ADMIN_EMAILS = 'admin@example.com';

      const { isSuperAdmin } = await import('../../api/lib/super-admin.js');

      expect(isSuperAdmin('user@example.com')).toBe(false);
    });

    it('is case-insensitive', async () => {
      process.env.SUPER_ADMIN_EMAILS = 'Admin@Example.com';

      const { isSuperAdmin } = await import('../../api/lib/super-admin.js');

      expect(isSuperAdmin('admin@example.com')).toBe(true);
      expect(isSuperAdmin('ADMIN@EXAMPLE.COM')).toBe(true);
    });

    it('handles empty SUPER_ADMIN_EMAILS', async () => {
      process.env.SUPER_ADMIN_EMAILS = '';

      const { isSuperAdmin } = await import('../../api/lib/super-admin.js');

      expect(isSuperAdmin('admin@example.com')).toBe(false);
    });

    it('handles undefined SUPER_ADMIN_EMAILS', async () => {
      delete process.env.SUPER_ADMIN_EMAILS;

      const { isSuperAdmin } = await import('../../api/lib/super-admin.js');

      expect(isSuperAdmin('admin@example.com')).toBe(false);
    });

    it('handles whitespace in email list', async () => {
      process.env.SUPER_ADMIN_EMAILS = ' admin@example.com , super@test.com ';

      const { isSuperAdmin } = await import('../../api/lib/super-admin.js');

      expect(isSuperAdmin('admin@example.com')).toBe(true);
      expect(isSuperAdmin('super@test.com')).toBe(true);
    });

    it('returns false for null/undefined email', async () => {
      process.env.SUPER_ADMIN_EMAILS = 'admin@example.com';

      const { isSuperAdmin } = await import('../../api/lib/super-admin.js');

      expect(isSuperAdmin(null)).toBe(false);
      expect(isSuperAdmin(undefined)).toBe(false);
    });
  });
});
