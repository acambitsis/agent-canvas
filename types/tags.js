/**
 * Tag type definitions for AgentCanvas
 * Fixed tag types: phase, department, status (same across all orgs)
 * Values are loose strings - UI can suggest common values but backend accepts any string
 */

// Core tag types - code-defined, fixed across all orgs
export const TAG_TYPES = {
  phase: {
    id: 'phase',
    label: 'Phase',
    description: 'Business process phase',
    isGroupable: true,
    icon: 'layers',
    // Phase values are dynamic from agents - not predefined
    values: []
  },

  department: {
    id: 'department',
    label: 'Department',
    description: 'Organizational department',
    isGroupable: true,
    icon: 'building-2',
    // Common values for UI suggestions (backend accepts any string)
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
    // Common values for UI suggestions (backend accepts any string)
    values: [
      { id: 'active', label: 'Active', color: '#10B981', icon: 'check-circle' },
      { id: 'draft', label: 'Draft', color: '#6B7280', icon: 'edit-3' },
      { id: 'review', label: 'In Review', color: '#F59E0B', icon: 'eye' },
      { id: 'deprecated', label: 'Deprecated', color: '#EF4444', icon: 'archive' },
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

  let tagValue;
  if (tagType === 'department') {
    tagValue = agent.department;
  } else if (tagType === 'status') {
    tagValue = agent.status;
  } else {
    return null;
  }

  if (!tagValue) return null;

  const tagMeta = getTagValue(tagType, tagValue);
  if (!tagMeta) {
    // Unknown value - return as-is (loose string support)
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
 * Used to build dynamic phase/department/status values
 */
export function getUniqueTagValues(agents, tagType) {
  const values = new Set();

  for (const agent of agents) {
    if (tagType === 'phase') {
      if (agent.phase) values.add(agent.phase);
    } else if (tagType === 'department') {
      if (agent.department) values.add(agent.department);
    } else if (tagType === 'status') {
      if (agent.status) values.add(agent.status);
    }
  }

  return Array.from(values);
}

// Re-export tool definitions from canonical config.js
export { TOOL_DEFINITIONS, getToolDisplay } from './config.js';
