/**
 * Grouping and filtering utilities for agents
 */

import { Agent, AgentGroup } from '@/types/agent';
import { TAG_TYPES, DEFAULT_GROUPING_TAG, SECTION_COLOR_PALETTE, getTagValue } from './config';

/**
 * Group agents by the specified tag type
 */
export function groupAgentsByTag(agents: Agent[], tagType: string = DEFAULT_GROUPING_TAG): AgentGroup[] {
  const groups = new Map<string, AgentGroup>();
  const tagDef = TAG_TYPES[tagType];

  // Process each agent
  for (const agent of agents) {
    // Skip soft-deleted agents
    if (agent.deletedAt) continue;

    // Get tag value from agent
    let tagValue: string;
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
      let groupMeta: Omit<AgentGroup, 'agents'>;

      if (tagType === 'phase') {
        // Phase colors are assigned dynamically from palette
        const groupIndex = groups.size;
        groupMeta = {
          id: tagValue,
          label: tagValue,
          color: SECTION_COLOR_PALETTE[groupIndex % SECTION_COLOR_PALETTE.length],
          icon: 'layers',
        };
      } else {
        // Other tags use predefined colors
        const valueMeta = getTagValue(tagType, tagValue);
        groupMeta = {
          id: tagValue,
          label: valueMeta?.label || tagValue,
          color: valueMeta?.color || '#6B7280',
          icon: valueMeta?.icon || tagDef?.icon || 'tag',
        };
      }

      groups.set(tagValue, {
        ...groupMeta,
        agents: [],
      });
    }

    const group = groups.get(tagValue)!;
    group.agents.push(agent);
  }

  // Convert to array and sort agents within each group
  const sortedGroups = Array.from(groups.values());

  for (const group of sortedGroups) {
    group.agents.sort((a, b) => (a.agentOrder || 0) - (b.agentOrder || 0));
  }

  // Sort groups by phase order if grouping by phase
  if (tagType === 'phase') {
    sortedGroups.sort((a, b) => {
      const aOrder = a.agents[0]?.phaseOrder ?? 999;
      const bOrder = b.agents[0]?.phaseOrder ?? 999;
      return aOrder - bOrder;
    });
  }

  return sortedGroups;
}

/**
 * Filter agents by tag values
 */
export function filterAgents(agents: Agent[], filters: Record<string, string[]>): Agent[] {
  if (!filters || Object.keys(filters).length === 0) {
    return agents;
  }

  return agents.filter((agent) => {
    for (const [tagType, allowedValues] of Object.entries(filters)) {
      if (!allowedValues || allowedValues.length === 0) continue;

      let agentValue: string | undefined;
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

