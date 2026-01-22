/**
 * Centralized localStorage key constants
 * All keys are prefixed with 'agentcanvas-' for namespace isolation
 */

export const STORAGE_KEYS = {
  CURRENT_ORG: 'agentcanvas-current-org',
  CURRENT_CANVAS: 'agentcanvas-current-canvas',
  GROUPING_PREFERENCE: 'agentcanvas-grouping-pref',
  COLLAPSED_SECTIONS: 'agentcanvas-collapsed-sections',
  SIDEBAR_COLLAPSED: 'agentcanvas-sidebar-collapsed',
  SIDEBAR_WIDTH: 'agentcanvas-sidebar-width',
  THEME: 'agentcanvas-theme',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
