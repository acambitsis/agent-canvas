/**
 * Tag type definitions for AgentCanvas
 * Strongly-typed tag system with validation, colors, and icons
 */

// Core tag types - code-defined, strongly typed
export const TAG_TYPES = {
  phase: {
    id: 'phase',
    label: 'Phase',
    description: 'Business process phase',
    isGroupable: true,
    icon: 'layers',
    // Phase values are dynamic from agentGroups - not predefined
    values: []
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
    ]
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
    ]
  },

  implementationStatus: {
    id: 'implementationStatus',
    label: 'Implementation',
    description: 'Development/deployment status',
    isGroupable: true,
    icon: 'git-branch',
    values: [
      { id: 'ideation', label: 'Ideation', color: '#A78BFA', icon: 'lightbulb' },
      { id: 'planning', label: 'Planning', color: '#6366F1', icon: 'clipboard-list' },
      { id: 'development', label: 'Development', color: '#F59E0B', icon: 'code' },
      { id: 'testing', label: 'Testing', color: '#06B6D4', icon: 'flask-conical' },
      { id: 'deployed', label: 'Deployed', color: '#10B981', icon: 'rocket' },
      { id: 'monitoring', label: 'Monitoring', color: '#3B82F6', icon: 'activity' },
    ]
  },

  priority: {
    id: 'priority',
    label: 'Priority',
    description: 'Business priority level',
    isGroupable: true,
    icon: 'flag',
    values: [
      { id: 'p0', label: 'P0 Critical', color: '#DC2626', icon: 'alert-triangle' },
      { id: 'p1', label: 'P1 High', color: '#F59E0B', icon: 'arrow-up' },
      { id: 'p2', label: 'P2 Medium', color: '#3B82F6', icon: 'minus' },
      { id: 'p3', label: 'P3 Low', color: '#6B7280', icon: 'arrow-down' },
    ]
  }
};

// Default tag type for grouping
export const DEFAULT_GROUPING_TAG = 'phase';

/**
 * Get tag value metadata by tag type and value id
 */
export function getTagValue(tagType, valueId) {
  const tagDef = TAG_TYPES[tagType];
  if (!tagDef) return null;
  return tagDef.values.find(v => v.id === valueId) || null;
}

/**
 * Get all groupable tag types
 */
export function getGroupableTagTypes() {
  return Object.values(TAG_TYPES).filter(t => t.isGroupable);
}

/**
 * Get tag display info for an agent
 */
export function getAgentTagDisplay(agent, tagType) {
  if (tagType === 'phase') {
    return {
      value: agent.phase,
      label: agent.phase,
      color: null, // Phase colors come from section palette
      icon: 'layers'
    };
  }

  const tagValue = agent.tags?.[tagType];
  if (!tagValue) return null;

  const tagMeta = getTagValue(tagType, tagValue);
  if (!tagMeta) {
    return {
      value: tagValue,
      label: tagValue,
      color: '#6B7280',
      icon: TAG_TYPES[tagType]?.icon || 'tag'
    };
  }

  return {
    value: tagValue,
    label: tagMeta.label,
    color: tagMeta.color,
    icon: tagMeta.icon
  };
}

/**
 * Get all tag values for a specific type from a list of agents
 * Used to build dynamic phase values
 */
export function getUniqueTagValues(agents, tagType) {
  const values = new Set();

  for (const agent of agents) {
    if (tagType === 'phase') {
      if (agent.phase) values.add(agent.phase);
    } else {
      const tagValue = agent.tags?.[tagType];
      if (tagValue) values.add(tagValue);
    }
  }

  return Array.from(values);
}

/**
 * Tool definitions with colors and icons
 */
export const TOOL_DEFINITIONS = {
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

/**
 * Get tool display info
 */
export function getToolDisplay(toolName) {
  const normalized = toolName.toLowerCase().replace(/\s+/g, '-');
  return TOOL_DEFINITIONS[normalized] || {
    label: toolName,
    color: '#6B7280',
    icon: 'box'
  };
}
