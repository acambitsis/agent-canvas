/**
 * Centralized API endpoint path functions
 * These provide type-safe URL generation for API routes
 */

export const API_ENDPOINTS = {
  orgMembers: (orgId: string) => `/api/org/${orgId}/members`,
  orgMember: (orgId: string, memberId: string) => `/api/org/${orgId}/members/${memberId}`,
  orgInvite: (orgId: string) => `/api/org/${orgId}/invite`,
} as const;
