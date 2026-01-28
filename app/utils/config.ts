/**
 * Configuration utilities for tools and tags
 */

import { AGENT_STATUS_CONFIG, AgentStatus, getAgentStatusConfig } from '@/types/validationConstants';

export interface ToolDefinition {
  label: string;
  color: string;
  icon: string;
}

export interface TagValue {
  id: string;
  label: string;
  color: string;
  icon: string;
}

export interface TagType {
  id: string;
  label: string;
  description: string;
  isGroupable: boolean;
  icon: string;
  values: TagValue[];
}

// Tool definitions with display metadata
export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  forms: { label: 'Forms', color: '#06B6D4', icon: 'file-input' },
  code: { label: 'Code', color: '#8B5CF6', icon: 'code-2' },
  rag: { label: 'RAG', color: '#F59E0B', icon: 'file-search' },
  'web-search': { label: 'Web Search', color: '#10B981', icon: 'globe' },
  'deep-research': { label: 'Deep Research', color: '#EC4899', icon: 'search' },
  context: { label: 'Context', color: '#EF4444', icon: 'database' },
  email: { label: 'Email', color: '#3B82F6', icon: 'mail' },
  calendar: { label: 'Calendar', color: '#6366F1', icon: 'calendar' },
  'ms-teams': { label: 'MS Teams', color: '#6264A7', icon: 'message-square' },
  api: { label: 'API', color: '#14B8A6', icon: 'plug' },
};

// Tag type identifiers - used for grouping agents
export const TAG_TYPE_ID = {
  CATEGORY: 'category',
  PHASE: 'phase',
  STATUS: 'status',
} as const;

export type TagTypeId = typeof TAG_TYPE_ID[keyof typeof TAG_TYPE_ID];

// Section color palette - cycles through for agent groups/phases
export const SECTION_COLOR_PALETTE = [
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#6366F1', // Indigo
];

// Tag type definitions
export const TAG_TYPES: Record<TagTypeId, TagType> = {
  [TAG_TYPE_ID.CATEGORY]: {
    id: TAG_TYPE_ID.CATEGORY,
    label: 'Category',
    description: 'Visual grouping',
    isGroupable: true,
    icon: 'folder',
    values: [],
  },
  [TAG_TYPE_ID.PHASE]: {
    id: TAG_TYPE_ID.PHASE,
    label: 'Implementation Phase',
    description: 'Implementation schedule',
    isGroupable: true,
    icon: 'milestone',
    values: [],
  },
  [TAG_TYPE_ID.STATUS]: {
    id: TAG_TYPE_ID.STATUS,
    label: 'Status',
    description: 'Agent lifecycle status',
    isGroupable: true,
    icon: 'activity',
    values: Object.entries(AGENT_STATUS_CONFIG).map(([id, config]) => ({
      id: id as AgentStatus,
      label: config.label,
      color: config.color,
      icon: config.icon,
    })),
  },
};

export const DEFAULT_GROUPING_TAG = TAG_TYPE_ID.CATEGORY;

/**
 * Check if a string is a valid TagTypeId
 */
export function isValidTagTypeId(tagType: string): tagType is TagTypeId {
  return Object.values(TAG_TYPE_ID).includes(tagType as TagTypeId);
}

// Default values for grouping fields
export const DEFAULT_CATEGORY = 'Uncategorized';
export const DEFAULT_PHASE = 'Backlog';

/**
 * Get tool display info (canonical format with hex colors)
 */
export function getToolDisplay(toolName: string): ToolDefinition {
  const normalized = toolName.toLowerCase().replace(/\s+/g, '-');
  return TOOL_DEFINITIONS[normalized] || {
    label: toolName,
    color: '#6B7280',
    icon: 'box',
  };
}

/**
 * Get section color from palette based on index
 */
export function getSectionColor(groupIndex: number): string {
  return SECTION_COLOR_PALETTE[groupIndex % SECTION_COLOR_PALETTE.length];
}

/**
 * Get tag value definition
 */
export function getTagValue(tagType: string, valueId: string): TagValue | null {
  if (!isValidTagTypeId(tagType)) return null;
  const tagDef = TAG_TYPES[tagType];
  return tagDef.values.find((v: TagValue) => v.id === valueId) || null;
}

/**
 * Get tag definition
 */
export function getTagDefinition(tagType: string): TagType | null {
  if (!isValidTagTypeId(tagType)) return null;
  return TAG_TYPES[tagType];
}

/**
 * Get all available tool names
 */
export function getAvailableTools(): string[] {
  return Object.keys(TOOL_DEFINITIONS);
}

/**
 * Get status color by status name
 * @deprecated Use getAgentStatusConfig from validationConstants instead
 */
export function getStatusColor(status?: string): string {
  return getAgentStatusConfig(status).color;
}

/**
 * Get full status configuration (color, bgColor, label)
 * @deprecated Use getAgentStatusConfig from validationConstants instead
 */
export function getStatusConfig(status?: string): { color: string; bgColor: string; label: string } {
  return getAgentStatusConfig(status);
}

/**
 * Map tool colors to CSS-friendly class names
 */
const TOOL_COLOR_CLASS_MAP: Record<string, string> = {
  '#06B6D4': 'cyan',
  '#3B82F6': 'blue',
  '#8B5CF6': 'violet',
  '#A855F7': 'purple',
  '#EC4899': 'pink',
  '#F43F5E': 'rose',
  '#F97316': 'orange',
  '#F59E0B': 'amber',
  '#10B981': 'emerald',
  '#14B8A6': 'teal',
};

/**
 * Get CSS-friendly color class name from hex color
 */
export function getToolColorClass(color: string): string {
  return TOOL_COLOR_CLASS_MAP[color] || 'default';
}
