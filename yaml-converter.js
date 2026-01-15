/**
 * Legacy YAML conversion utilities (import-only).
 *
 * AgentCanvas is Convex-native; YAML is supported only as a one-way legacy importer.
 */

/**
 * Convert YAML document to Convex agents format
 * @param {object} yamlDoc - Parsed YAML document
 * @returns {Array} Array of agent objects ready for Convex
 */
export function yamlToConvexAgents(yamlDoc) {
  if (!yamlDoc || !yamlDoc.agentGroups || !Array.isArray(yamlDoc.agentGroups)) {
    return [];
  }

  const agents = [];
  let phaseOrder = 0;

  for (const group of yamlDoc.agentGroups) {
    const phase = group.groupName || `Phase ${phaseOrder + 1}`;
    let agentOrder = 0;

    if (group.agents && Array.isArray(group.agents)) {
      for (const agent of group.agents) {
        agents.push({
          phase,
          phaseOrder,
          agentOrder: agentOrder++,
          name: agent.name || '',
          objective: agent.objective || '',
          description: agent.description || '',
          tools: Array.isArray(agent.tools) ? agent.tools : [],
          journeySteps: Array.isArray(agent.journeySteps) ? agent.journeySteps : [],
          demoLink: agent.demoLink || undefined,
          videoLink: agent.videoLink || undefined,
          metrics: agent.metrics ? {
            adoption: parseFloat(agent.metrics.usageThisWeek) || 0,
            satisfaction: parseFloat(agent.metrics.timeSaved) || 0,
          } : undefined,
          payload: { ...agent }, // Store full portable payload for round-trip fidelity
        });
      }
    }

    phaseOrder++;
  }

  return agents;
}
