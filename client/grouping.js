/**
 * Dynamic grouping logic for AgentCanvas
 * Groups agents by any tag type with filtering support
 */

import { DEFAULT_GROUPING_TAG, getTagValue, SECTION_COLOR_PALETTE, TAG_TYPES } from './config.js';

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
    } else if (tagType === 'department') {
      tagValue = agent.department || 'unassigned';
    } else if (tagType === 'status') {
      tagValue = agent.status || 'unassigned';
    } else {
      // Unknown tag type - skip or use unassigned
      tagValue = 'unassigned';
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
          color: SECTION_COLOR_PALETTE[groupIndex % SECTION_COLOR_PALETTE.length],
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
      } else if (tagType === 'department') {
        agentValue = agent.department;
      } else if (tagType === 'status') {
        agentValue = agent.status;
      } else {
        // Unknown tag type - skip filter
        continue;
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
