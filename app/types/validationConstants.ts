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
  DRAFT: 'draft',
  ACTIVE: 'active',
  REVIEW: 'review',
  DEPRECATED: 'deprecated',
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

/**
 * Status display configuration for UI
 */
export const AGENT_STATUS_OPTIONS: { value: AgentStatus; label: string }[] = [
  { value: AGENT_STATUS.DRAFT, label: 'Draft' },
  { value: AGENT_STATUS.ACTIVE, label: 'Active' },
  { value: AGENT_STATUS.REVIEW, label: 'In Review' },
  { value: AGENT_STATUS.DEPRECATED, label: 'Deprecated' },
];
