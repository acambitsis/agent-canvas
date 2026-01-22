/**
 * Grouping and filtering utilities for agents
 */

import { Agent, AgentGroup } from '@/types/agent';
import { TAG_TYPES, TAG_TYPE_ID, DEFAULT_GROUPING_TAG, DEFAULT_CATEGORY, DEFAULT_PHASE, SECTION_COLOR_PALETTE, getTagValue, isValidTagTypeId } from './config';

/**
 * Get tag value from agent for the specified tag type
 * Returns undefined if tag type is unknown or agent doesn't have the value
 */
export function getAgentTagValue(agent: Agent, tagType: string): string | undefined {
  const tagValueMap: Record<string, string | undefined> = {
    [TAG_TYPE_ID.CATEGORY]: agent.category,
    [TAG_TYPE_ID.PHASE]: agent.phase,
    [TAG_TYPE_ID.STATUS]: agent.status,
  };
  return tagValueMap[tagType];
}

/**
 * Get tag value from agent with a default fallback
 */
export function getAgentTagValueWithDefault(
  agent: Agent,
  tagType: string,
  defaultValue = 'unassigned'
): string {
  return getAgentTagValue(agent, tagType) || defaultValue;
}

/**
 * Group agents by the specified tag type
 */
export function groupAgentsByTag(agents: Agent[], tagType: string = DEFAULT_GROUPING_TAG): AgentGroup[] {
  const groups = new Map<string, AgentGroup>();
  const tagDef = isValidTagTypeId(tagType) ? TAG_TYPES[tagType] : undefined;

  // Process each agent
  for (const agent of agents) {
    // Skip soft-deleted agents
    if (agent.deletedAt) continue;

    // Get tag value from agent
    const defaultValue = tagType === TAG_TYPE_ID.CATEGORY ? DEFAULT_CATEGORY :
                         tagType === TAG_TYPE_ID.PHASE ? DEFAULT_PHASE : 'unassigned';
    const tagValue = getAgentTagValueWithDefault(agent, tagType, defaultValue);

    // Initialize group if needed
    if (!groups.has(tagValue)) {
      let groupMeta: Omit<AgentGroup, 'agents'>;

      if (tagType === TAG_TYPE_ID.CATEGORY) {
        // Category colors are assigned dynamically from palette
        const groupIndex = groups.size;
        groupMeta = {
          id: tagValue,
          label: tagValue,
          color: SECTION_COLOR_PALETTE[groupIndex % SECTION_COLOR_PALETTE.length],
          icon: 'folder',
        };
      } else if (tagType === TAG_TYPE_ID.PHASE) {
        // Phase colors are assigned dynamically from palette
        const groupIndex = groups.size;
        groupMeta = {
          id: tagValue,
          label: tagValue,
          color: SECTION_COLOR_PALETTE[groupIndex % SECTION_COLOR_PALETTE.length],
          icon: 'milestone',
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
  if (tagType === TAG_TYPE_ID.PHASE) {
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

      const agentValue = getAgentTagValue(agent, tagType);

      // If unknown tag type, skip this filter
      if (agentValue === undefined && !Object.values(TAG_TYPE_ID).includes(tagType as typeof TAG_TYPE_ID[keyof typeof TAG_TYPE_ID])) {
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

