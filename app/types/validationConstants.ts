/**
 * Shared validation constants
 * Used by both frontend and backend validation logic
 */

export const VALIDATION_CONSTANTS = {
  // Agent field lengths
  AGENT_NAME_MAX_LENGTH: 100,
  AGENT_OBJECTIVE_MAX_LENGTH: 500,
  AGENT_DESCRIPTION_MAX_LENGTH: 1000,

  // Phase constraints
  PHASE_MAX_LENGTH: 50,

  // Canvas constraints
  CANVAS_TITLE_MAX_LENGTH: 200,
  CANVAS_SLUG_MAX_LENGTH: 100,

  // Metrics constraints
  METRIC_MIN_VALUE: 0,
} as const;

/**
 * Agent status values
 * Single source of truth for all status-related logic
 */
export const AGENT_STATUS = {
  IDEA: 'idea',
  IN_CONCEPT: 'in_concept', // Legacy status, kept for backward compatibility
  APPROVED: 'approved',
  WIP: 'wip',
  TESTING: 'testing',
  LIVE: 'live',
  SHELVED: 'shelved',
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

/**
 * Complete status display configuration
 * Single source of truth for status labels, colors, and icons
 */
export const AGENT_STATUS_CONFIG: Record<AgentStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  badgeVariant: 'success' | 'warning' | 'error' | 'default';
}> = {
  [AGENT_STATUS.IDEA]: {
    label: 'Idea',
    color: '#6B7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
    icon: 'lightbulb',
    badgeVariant: 'default',
  },
  [AGENT_STATUS.IN_CONCEPT]: {
    label: 'In Concept',
    color: '#6B7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
    icon: 'lightbulb',
    badgeVariant: 'default',
  },
  [AGENT_STATUS.APPROVED]: {
    label: 'Approved',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    icon: 'check',
    badgeVariant: 'default',
  },
  [AGENT_STATUS.WIP]: {
    label: 'WIP',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    icon: 'code',
    badgeVariant: 'warning',
  },
  [AGENT_STATUS.TESTING]: {
    label: 'Testing',
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    icon: 'flask-conical',
    badgeVariant: 'warning',
  },
  [AGENT_STATUS.LIVE]: {
    label: 'Live',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    icon: 'rocket',
    badgeVariant: 'success',
  },
  [AGENT_STATUS.SHELVED]: {
    label: 'Shelved',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    icon: 'archive',
    badgeVariant: 'error',
  },
};

/**
 * Helper to get status config with fallback for unknown statuses
 */
export function getAgentStatusConfig(status?: string) {
  if (status && status in AGENT_STATUS_CONFIG) {
    return AGENT_STATUS_CONFIG[status as AgentStatus];
  }
  return {
    label: status || 'Unknown',
    color: '#6366F1',
    bgColor: 'rgba(99, 102, 241, 0.1)',
    icon: 'help-circle',
    badgeVariant: 'default' as const,
  };
}

/**
 * Status options for form dropdowns
 */
export const AGENT_STATUS_OPTIONS = Object.entries(AGENT_STATUS_CONFIG).map(
  ([value, config]) => ({ value: value as AgentStatus, label: config.label })
);

/**
 * Organization role values
 * Single source of truth for role-related logic
 */
export const ORG_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export type OrgRole = (typeof ORG_ROLES)[keyof typeof ORG_ROLES];
