import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasPermission,
  isGlobalAdmin,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  getUserRole,
  hasGlobalRole,
  getGlobalRoles,
  isTeamLeader,
  assignGlobalRole,
  removeGlobalRole,
  updateTeamMemberRole,
  getUsersWithGlobalRole,
  getTeamPermissions
} from './permissions';
import { ROLES } from './permissions-config';

// Mock the database query
const mockQuery = vi.fn();
vi.mock('./db', () => ({
  query: mockQuery,
}));

describe('Permissions', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('hasPermission', () => {
    it('should return false for non-existent user', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_perm: false }] });
      const result = await hasPermission('non-existent-user', 'test-team', 'team.update');
      expect(result).toBe(false);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('EXISTS'),
        ['non-existent-user', 'test-team', 'team.update']
      );
    });

    it('should return true for user with permission', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_perm: true }] });
      const result = await hasPermission('test-user', 'test-team', 'team.update');
      expect(result).toBe(true);
    });

    it('should return false when database returns no rows', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await hasPermission('test-user', 'test-team', 'team.update');
      expect(result).toBe(false);
    });

    it('should validate permission format', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_perm: true }] });
      const userId = 'test-user-id';
      const teamSlug = 'test-team';

      // Test with various permission formats
      const validPermissions = [
        'team.update',
        'team.delete',
        'rag.query',
        'security.view_audit_logs',
      ];

      for (const permission of validPermissions) {
        const result = await hasPermission(userId, teamSlug, permission);
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has at least one permission', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ has_perm: false }] })
        .mockResolvedValueOnce({ rows: [{ has_perm: true }] });

      const result = await hasAnyPermission('test-user', 'test-team', ['team.update', 'team.delete']);
      expect(result).toBe(true);
    });

    it('should return false if user has none of the permissions', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_perm: false }] });

      const result = await hasAnyPermission('test-user', 'test-team', ['team.update', 'team.delete']);
      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_perm: true }] });

      const result = await hasAllPermissions('test-user', 'test-team', ['team.update', 'team.delete']);
      expect(result).toBe(true);
    });

    it('should return false if user is missing any permission', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ has_perm: true }] })
        .mockResolvedValueOnce({ rows: [{ has_perm: false }] });

      const result = await hasAllPermissions('test-user', 'test-team', ['team.update', 'team.delete']);
      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return array of permissions', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { permission: 'team.update' },
          { permission: 'rag.query' },
        ],
      });

      const result = await getUserPermissions('test-user', 'test-team');
      expect(result).toEqual(['team.update', 'rag.query']);
    });

    it('should return empty array when no permissions', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getUserPermissions('test-user', 'test-team');
      expect(result).toEqual([]);
    });
  });

  describe('isGlobalAdmin', () => {
    it('should return false for non-admin users', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_role: false }] });
      const result = await isGlobalAdmin('regular-user-id');
      expect(result).toBe(false);
    });

    it('should return true for global admin', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_role: true }] });
      const result = await isGlobalAdmin('admin-user-id');
      expect(result).toBe(true);
    });

    it('should return false when database returns no rows', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await isGlobalAdmin('regular-user-id');
      expect(result).toBe(false);
    });
  });

  describe('getUserRole', () => {
    it('should return user role when found', async () => {
      mockQuery.mockResolvedValue({ rows: [{ role: ROLES.TEAM_OWNER }] });
      const result = await getUserRole('user-123', 'test-team');
      expect(result).toBe(ROLES.TEAM_OWNER);
    });

    it('should return null when user not in team', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await getUserRole('user-123', 'test-team');
      expect(result).toBeNull();
    });

    it('should return null when role is not active', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await getUserRole('user-123', 'test-team');
      expect(result).toBeNull();
    });
  });

  describe('hasGlobalRole', () => {
    it('should return true when user has role', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_role: true }] });
      const result = await hasGlobalRole('user-123', ROLES.GLOBAL_ADMIN);
      expect(result).toBe(true);
    });

    it('should return false when user does not have role', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_role: false }] });
      const result = await hasGlobalRole('user-123', ROLES.GLOBAL_ADMIN);
      expect(result).toBe(false);
    });
  });

  describe('getGlobalRoles', () => {
    it('should return array of user global roles', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { role: ROLES.GLOBAL_ADMIN },
          { role: 'custom-role' },
        ],
      });
      const result = await getGlobalRoles('user-123');
      expect(result).toEqual([ROLES.GLOBAL_ADMIN, 'custom-role']);
    });

    it('should return empty array when user has no roles', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await getGlobalRoles('user-123');
      expect(result).toEqual([]);
    });
  });

  describe('isTeamLeader', () => {
    it('should return true for team owner', async () => {
      mockQuery.mockResolvedValue({ rows: [{ role: ROLES.TEAM_OWNER }] });
      const result = await isTeamLeader('user-123', 'test-team');
      expect(result).toBe(true);
    });

    it('should return true for team leader', async () => {
      mockQuery.mockResolvedValue({ rows: [{ role: ROLES.TEAM_LEADER }] });
      const result = await isTeamLeader('user-123', 'test-team');
      expect(result).toBe(true);
    });

    it('should return false for regular member', async () => {
      mockQuery.mockResolvedValue({ rows: [{ role: ROLES.MEMBER }] });
      const result = await isTeamLeader('user-123', 'test-team');
      expect(result).toBe(false);
    });

    it('should return false when user not in team', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await isTeamLeader('user-123', 'test-team');
      expect(result).toBe(false);
    });
  });

  describe('assignGlobalRole', () => {
    it('should assign global role to user', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await expect(assignGlobalRole('user-123', 'admin')).resolves.not.toThrow();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        ['user-123', 'admin']
      );
    });
  });

  describe('removeGlobalRole', () => {
    it('should remove global role from user', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      await expect(removeGlobalRole('user-123', 'admin')).resolves.not.toThrow();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM'),
        ['user-123', 'admin']
      );
    });
  });

  describe('updateTeamMemberRole', () => {
    it('should update team member role', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      await expect(updateTeamMemberRole('user-123', 'test-team', ROLES.TEAM_LEADER)).resolves.not.toThrow();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        [ROLES.TEAM_LEADER, 'user-123', 'test-team']
      );
    });
  });

  describe('getUsersWithGlobalRole', () => {
    it('should return users with specific global role', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { user_id: 'user-1' },
          { user_id: 'user-2' },
        ],
      });
      const result = await getUsersWithGlobalRole(ROLES.GLOBAL_ADMIN);
      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('should return empty array when no users have role', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await getUsersWithGlobalRole(ROLES.GLOBAL_ADMIN);
      expect(result).toEqual([]);
    });
  });

  describe('getTeamPermissions', () => {
    it('should return all permissions for a team', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { permission: 'team.update' },
          { permission: 'team.delete' },
          { permission: 'rag.query' },
        ],
      });
      const result = await getTeamPermissions('test-team');
      expect(result).toEqual(['team.update', 'team.delete', 'rag.query']);
    });

    it('should return empty array when team has no permissions', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await getTeamPermissions('test-team');
      expect(result).toEqual([]);
    });
  });
});
