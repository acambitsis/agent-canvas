/**
 * Configuration utilities for tools and tags
 */

import { AGENT_STATUS } from '@/types/validationConstants';

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
  slack: { label: 'Slack', color: '#E11D48', icon: 'message-square' },
  api: { label: 'API', color: '#14B8A6', icon: 'plug' },
};

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
export const TAG_TYPES: Record<string, TagType> = {
  category: {
    id: 'category',
    label: 'Category',
    description: 'Visual grouping',
    isGroupable: true,
    icon: 'folder',
    values: [],
  },
  phase: {
    id: 'phase',
    label: 'Implementation Phase',
    description: 'Implementation schedule',
    isGroupable: true,
    icon: 'milestone',
    values: [],
  },
  status: {
    id: 'status',
    label: 'Status',
    description: 'Agent lifecycle status',
    isGroupable: true,
    icon: 'activity',
    values: [
      { id: AGENT_STATUS.ACTIVE, label: 'Active', color: '#10B981', icon: 'check-circle' },
      { id: AGENT_STATUS.DRAFT, label: 'Draft', color: '#6B7280', icon: 'edit-3' },
      { id: AGENT_STATUS.REVIEW, label: 'In Review', color: '#F59E0B', icon: 'eye' },
      { id: AGENT_STATUS.DEPRECATED, label: 'Deprecated', color: '#EF4444', icon: 'archive' },
    ],
  },
};

export const DEFAULT_GROUPING_TAG = 'category';

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
  const tagDef = TAG_TYPES[tagType];
  if (!tagDef) return null;
  return tagDef.values.find((v) => v.id === valueId) || null;
}

/**
 * Get tag definition
 */
export function getTagDefinition(tagType: string): TagType | null {
  return TAG_TYPES[tagType] || null;
}

/**
 * Get all available tool names
 */
export function getAvailableTools(): string[] {
  return Object.keys(TOOL_DEFINITIONS);
}

/**
 * Status color definitions
 */
export const STATUS_COLORS: Record<string, { color: string; bgColor: string; label: string }> = {
  active: { color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)', label: 'Active' },
  draft: { color: '#A8A29E', bgColor: 'rgba(168, 162, 158, 0.1)', label: 'Draft' },
  deprecated: { color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)', label: 'Deprecated' },
  default: { color: '#6366F1', bgColor: 'rgba(99, 102, 241, 0.1)', label: 'Unknown' },
};

/**
 * Get status color by status name
 */
export function getStatusColor(status?: string): string {
  return STATUS_COLORS[status || 'default']?.color || STATUS_COLORS.default.color;
}

/**
 * Get full status configuration (color, bgColor, label)
 */
export function getStatusConfig(status?: string): { color: string; bgColor: string; label: string } {
  const config = STATUS_COLORS[status || 'default'];
  if (config) {
    return { ...config, label: config.label === 'Unknown' && status ? status : config.label };
  }
  return { ...STATUS_COLORS.default, label: status || 'Unknown' };
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
