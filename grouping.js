/**
 * Dynamic grouping logic for AgentCanvas
 * Groups agents by any tag type with filtering support
 */

import { TAG_TYPES, getTagValue, DEFAULT_GROUPING_TAG } from './types/tags.js';

// Section color palette for phase grouping
const SECTION_COLORS = [
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#6366F1', // Indigo
];

/**
 * Group agents by the specified tag type
 * @param {Array} agents - Flat array of agent objects
 * @param {string} tagType - Tag type to group by ('phase', 'department', 'status', etc.)
 * @returns {Array} Array of group objects: { id, label, color, icon, agents, order }
 */
export function groupAgentsByTag(agents, tagType = DEFAULT_GROUPING_TAG) {
  const groups = new Map();
  const tagDef = TAG_TYPES[tagType];

  // Process each agent
  for (const agent of agents) {
    // Skip soft-deleted agents
    if (agent.deletedAt) continue;

    // Get tag value from agent
    let tagValue;
    if (tagType === 'phase') {
      tagValue = agent.phase || 'Uncategorized';
    } else {
      tagValue = agent.tags?.[tagType] || 'unassigned';
    }

    // Initialize group if needed
    if (!groups.has(tagValue)) {
      let groupMeta;

      if (tagType === 'phase') {
        // Phase colors are assigned dynamically from palette
        const groupIndex = groups.size;
        groupMeta = {
          id: tagValue,
          label: tagValue,
          color: SECTION_COLORS[groupIndex % SECTION_COLORS.length],
          icon: 'layers',
          order: agent.phaseOrder ?? groupIndex
        };
      } else {
        // Other tags use predefined colors
        const valueMeta = getTagValue(tagType, tagValue);
        groupMeta = {
          id: tagValue,
          label: valueMeta?.label || tagValue,
          color: valueMeta?.color || '#6B7280',
          icon: valueMeta?.icon || tagDef?.icon || 'tag',
          order: tagDef?.values?.findIndex(v => v.id === tagValue) ?? 999
        };
      }

      groups.set(tagValue, {
        ...groupMeta,
        agents: []
      });
    }

    groups.get(tagValue).agents.push(agent);
  }

  // Convert to array and sort groups by order
  const sortedGroups = Array.from(groups.values())
    .sort((a, b) => a.order - b.order);

  // Sort agents within each group by agentOrder
  for (const group of sortedGroups) {
    group.agents.sort((a, b) => (a.agentOrder || 0) - (b.agentOrder || 0));
    group.agentCount = group.agents.length;
  }

  return sortedGroups;
}

/**
 * Flatten agents from config data format
 * @param {Object} configData - The legacy config data format with agentGroups
 * @returns {Array} Flat array of agents with phase info preserved
 */
export function flattenAgentsFromConfig(configData) {
  if (!configData?.agentGroups) return [];

  const agents = [];
  for (const group of configData.agentGroups) {
    for (const agent of (group.agents || [])) {
      agents.push({
        ...agent,
        phase: group.groupName || group.groupId,
        phaseOrder: group.groupNumber ?? 0
      });
    }
  }
  return agents;
}

/**
 * Filter agents by tag values
 * @param {Array} agents - Array of agent objects
 * @param {Object} filters - Filter object: { tagType: [allowedValues] }
 * @returns {Array} Filtered agents
 */
export function filterAgents(agents, filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return agents;
  }

  return agents.filter(agent => {
    for (const [tagType, allowedValues] of Object.entries(filters)) {
      if (!allowedValues || allowedValues.length === 0) continue;

      let agentValue;
      if (tagType === 'phase') {
        agentValue = agent.phase;
      } else {
        agentValue = agent.tags?.[tagType];
      }

      // If agent doesn't have this tag value or it's not in allowed list, filter out
      if (!agentValue || !allowedValues.includes(agentValue)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Get statistics about agents in groups
 */
export function getGroupStats(groups) {
  const totalAgents = groups.reduce((sum, g) => sum + g.agents.length, 0);
  const totalGroups = groups.length;
  const avgPerGroup = totalGroups > 0 ? Math.round(totalAgents / totalGroups) : 0;

  return {
    totalAgents,
    totalGroups,
    avgPerGroup
  };
}

/**
 * Search agents by name, objective, or description
 * @param {Array} agents - Array of agents
 * @param {string} query - Search query
 * @returns {Array} Matching agents
 */
export function searchAgents(agents, query) {
  if (!query || query.trim().length === 0) {
    return agents;
  }

  const lowerQuery = query.toLowerCase().trim();

  return agents.filter(agent => {
    const name = (agent.name || '').toLowerCase();
    const objective = (agent.objective || '').toLowerCase();
    const description = (agent.description || '').toLowerCase();
    const tools = (agent.tools || []).join(' ').toLowerCase();

    return (
      name.includes(lowerQuery) ||
      objective.includes(lowerQuery) ||
      description.includes(lowerQuery) ||
      tools.includes(lowerQuery)
    );
  });
}
