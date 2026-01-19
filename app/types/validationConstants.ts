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
