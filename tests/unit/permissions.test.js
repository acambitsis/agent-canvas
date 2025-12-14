import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../../api/lib/db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryAll: vi.fn(),
}));

// Mock the super-admin module
vi.mock('../../api/lib/super-admin.js', () => ({
  isSuperAdmin: vi.fn(),
}));

import { query, queryOne, queryAll } from '../../api/lib/db.js';
import { isSuperAdmin } from '../../api/lib/super-admin.js';
import {
  getGroupRole,
  canViewGroup,
  canManageCanvases,
  canManageMembers,
  canInviteToGroup,
  canCreateGroup,
  canDeleteGroup,
  getUserGroups,
  checkCanvasAccess,
  checkCanvasWriteAccess,
} from '../../api/lib/permissions.js';

describe('permissions module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGroupRole', () => {
    it('returns super_admin for super admin users', async () => {
      isSuperAdmin.mockReturnValue(true);

      const role = await getGroupRole('user123', 'admin@example.com', 'group1');

      expect(role).toBe('super_admin');
      expect(queryOne).not.toHaveBeenCalled();
    });

    it('returns admin for group admin', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue({ role: 'admin' });

      const role = await getGroupRole('user123', 'user@example.com', 'group1');

      expect(role).toBe('admin');
      expect(queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT role FROM group_members'),
        ['group1', 'user123']
      );
    });

    it('returns viewer for group viewer', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue({ role: 'viewer' });

      const role = await getGroupRole('user123', 'user@example.com', 'group1');

      expect(role).toBe('viewer');
    });

    it('returns null for non-members', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue(null);

      const role = await getGroupRole('user123', 'user@example.com', 'group1');

      expect(role).toBeNull();
    });
  });

  describe('canViewGroup', () => {
    it('returns true for group members', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue({ role: 'viewer' });

      const result = await canViewGroup('user123', 'user@example.com', 'group1');

      expect(result).toBe(true);
    });

    it('returns true for super admins', async () => {
      isSuperAdmin.mockReturnValue(true);

      const result = await canViewGroup('user123', 'admin@example.com', 'group1');

      expect(result).toBe(true);
    });

    it('returns false for non-members', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue(null);

      const result = await canViewGroup('user123', 'user@example.com', 'group1');

      expect(result).toBe(false);
    });
  });

  describe('canManageCanvases', () => {
    it('returns true for admins', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue({ role: 'admin' });

      const result = await canManageCanvases('user123', 'user@example.com', 'group1');

      expect(result).toBe(true);
    });

    it('returns true for super admins', async () => {
      isSuperAdmin.mockReturnValue(true);

      const result = await canManageCanvases('user123', 'admin@example.com', 'group1');

      expect(result).toBe(true);
    });

    it('returns false for viewers', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue({ role: 'viewer' });

      const result = await canManageCanvases('user123', 'user@example.com', 'group1');

      expect(result).toBe(false);
    });
  });

  describe('canManageMembers', () => {
    it('returns true for admins', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue({ role: 'admin' });

      const result = await canManageMembers('user123', 'user@example.com', 'group1');

      expect(result).toBe(true);
    });

    it('returns false for viewers', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue({ role: 'viewer' });

      const result = await canManageMembers('user123', 'user@example.com', 'group1');

      expect(result).toBe(false);
    });
  });

  describe('canInviteToGroup', () => {
    it('returns true for any group member', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue({ role: 'viewer' });

      const result = await canInviteToGroup('user123', 'user@example.com', 'group1');

      expect(result).toBe(true);
    });

    it('returns false for non-members', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryOne.mockResolvedValue(null);

      const result = await canInviteToGroup('user123', 'user@example.com', 'group1');

      expect(result).toBe(false);
    });
  });

  describe('canCreateGroup', () => {
    it('returns true for super admins', () => {
      isSuperAdmin.mockReturnValue(true);

      const result = canCreateGroup('admin@example.com');

      expect(result).toBe(true);
    });

    it('returns false for non-super-admins', () => {
      isSuperAdmin.mockReturnValue(false);

      const result = canCreateGroup('user@example.com');

      expect(result).toBe(false);
    });
  });

  describe('canDeleteGroup', () => {
    it('returns true for super admins', () => {
      isSuperAdmin.mockReturnValue(true);

      const result = canDeleteGroup('admin@example.com');

      expect(result).toBe(true);
    });

    it('returns false for non-super-admins', () => {
      isSuperAdmin.mockReturnValue(false);

      const result = canDeleteGroup('user@example.com');

      expect(result).toBe(false);
    });
  });

  describe('getUserGroups', () => {
    it('returns all groups for super admins', async () => {
      isSuperAdmin.mockReturnValue(true);
      queryAll.mockResolvedValue([
        { id: 'g1', name: 'Group 1' },
        { id: 'g2', name: 'Group 2' },
      ]);

      const groups = await getUserGroups('user123', 'admin@example.com');

      expect(groups).toHaveLength(2);
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('SELECT g.*, \'super_admin\' as role')
      );
    });

    it('returns only member groups for regular users', async () => {
      isSuperAdmin.mockReturnValue(false);
      queryAll.mockResolvedValue([
        { id: 'g1', name: 'Group 1', role: 'admin' },
      ]);

      const groups = await getUserGroups('user123', 'user@example.com');

      expect(groups).toHaveLength(1);
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('INNER JOIN group_members'),
        ['user123']
      );
    });
  });

  describe('checkCanvasAccess', () => {
    it('returns hasAccess=false for non-existent canvas', async () => {
      queryOne.mockResolvedValue(null);

      const result = await checkCanvasAccess('user123', 'user@example.com', 'canvas123');

      expect(result.hasAccess).toBe(false);
      expect(result.canvas).toBeNull();
    });

    it('returns hasAccess=true for group member', async () => {
      queryOne
        .mockResolvedValueOnce({ id: 'canvas123', group_id: 'group1', group_name: 'Test Group' })
        .mockResolvedValueOnce({ role: 'viewer' });
      isSuperAdmin.mockReturnValue(false);

      const result = await checkCanvasAccess('user123', 'user@example.com', 'canvas123');

      expect(result.hasAccess).toBe(true);
      expect(result.role).toBe('viewer');
    });

    it('returns hasAccess=false for non-member', async () => {
      queryOne
        .mockResolvedValueOnce({ id: 'canvas123', group_id: 'group1', group_name: 'Test Group' })
        .mockResolvedValueOnce(null);
      isSuperAdmin.mockReturnValue(false);

      const result = await checkCanvasAccess('user123', 'user@example.com', 'canvas123');

      expect(result.hasAccess).toBe(false);
    });
  });

  describe('checkCanvasWriteAccess', () => {
    it('returns hasAccess=false for viewers', async () => {
      queryOne
        .mockResolvedValueOnce({ id: 'canvas123', group_id: 'group1', group_name: 'Test Group' })
        .mockResolvedValueOnce({ role: 'viewer' });
      isSuperAdmin.mockReturnValue(false);

      const result = await checkCanvasWriteAccess('user123', 'user@example.com', 'canvas123');

      expect(result.hasAccess).toBe(false);
      expect(result.role).toBe('viewer');
    });

    it('returns hasAccess=true for admins', async () => {
      queryOne
        .mockResolvedValueOnce({ id: 'canvas123', group_id: 'group1', group_name: 'Test Group' })
        .mockResolvedValueOnce({ role: 'admin' });
      isSuperAdmin.mockReturnValue(false);

      const result = await checkCanvasWriteAccess('user123', 'user@example.com', 'canvas123');

      expect(result.hasAccess).toBe(true);
      expect(result.role).toBe('admin');
    });
  });
});
