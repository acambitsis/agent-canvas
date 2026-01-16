/**
 * Configuration utilities for tools and tags
 */

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
  phase: {
    id: 'phase',
    label: 'Phase',
    description: 'Business process phase',
    isGroupable: true,
    icon: 'layers',
    values: [],
  },
  department: {
    id: 'department',
    label: 'Department',
    description: 'Organizational department',
    isGroupable: true,
    icon: 'building-2',
    values: [
      { id: 'sales', label: 'Sales', color: '#3B82F6', icon: 'trending-up' },
      { id: 'engineering', label: 'Engineering', color: '#8B5CF6', icon: 'code-2' },
      { id: 'marketing', label: 'Marketing', color: '#EC4899', icon: 'megaphone' },
      { id: 'operations', label: 'Operations', color: '#F59E0B', icon: 'settings' },
      { id: 'support', label: 'Support', color: '#10B981', icon: 'headphones' },
      { id: 'finance', label: 'Finance', color: '#06B6D4', icon: 'wallet' },
      { id: 'hr', label: 'HR', color: '#F472B6', icon: 'users' },
      { id: 'legal', label: 'Legal', color: '#6366F1', icon: 'scale' },
    ],
  },
  status: {
    id: 'status',
    label: 'Status',
    description: 'Agent lifecycle status',
    isGroupable: true,
    icon: 'activity',
    values: [
      { id: 'active', label: 'Active', color: '#10B981', icon: 'check-circle' },
      { id: 'draft', label: 'Draft', color: '#6B7280', icon: 'edit-3' },
      { id: 'review', label: 'In Review', color: '#F59E0B', icon: 'eye' },
      { id: 'deprecated', label: 'Deprecated', color: '#EF4444', icon: 'archive' },
    ],
  },
};

export const DEFAULT_GROUPING_TAG = 'phase';

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
