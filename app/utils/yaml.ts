/**
 * YAML import/export utilities for canvas data
 */

import * as yaml from 'js-yaml';
import { Agent, AgentFormData } from '@/types/agent';
import { VALIDATION_CONSTANTS } from '@/types/validationConstants';

/**
 * YAML document structure (legacy format)
 */
interface YamlAgent {
  name?: string;
  objective?: string;
  description?: string;
  tools?: string[];
  journeySteps?: string[];
  demoLink?: string;
  videoLink?: string;
  metrics?: {
    numberOfUsers?: number | string;
    timesUsed?: number | string;
    timeSaved?: number | string; // hours
    roi?: number | string; // integer currency
  };
  tags?: {
    department?: string;
    status?: string;
  };
}

interface YamlAgentGroup {
  groupName?: string;
  agents?: YamlAgent[];
}

interface YamlDocument {
  documentTitle?: string;
  agentGroups?: YamlAgentGroup[];
}

/**
 * Generate a unique slug from a title
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'canvas';
}

/**
 * Generate a unique slug by appending a number suffix if needed
 */
export function generateUniqueSlug(title: string, existingSlugs: Set<string>): string {
  const base = slugifyTitle(title);
  let candidate = base;
  let suffix = 2;

  while (existingSlugs.has(candidate)) {
    candidate = `${base}-${suffix++}`;
  }

  return candidate;
}

/**
 * Extract title from YAML text for preview
 */
export function extractTitleFromYaml(yamlText: string): string | null {
  try {
    const parsed = yaml.load(yamlText) as YamlDocument;
    if (parsed?.documentTitle) {
      return String(parsed.documentTitle).trim() || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Validate canvas title
 */
function validateTitle(title: string): void {
  const trimmed = title?.trim();
  if (!trimmed) {
    throw new Error('Canvas title is required');
  }
  if (trimmed.length > VALIDATION_CONSTANTS.CANVAS_TITLE_MAX_LENGTH) {
    throw new Error(`Canvas title must be ${VALIDATION_CONSTANTS.CANVAS_TITLE_MAX_LENGTH} characters or less`);
  }
}

/**
 * Convert YAML document to Convex agent format
 */
function yamlToConvexAgents(yamlDoc: YamlDocument): AgentFormData[] {
  if (!yamlDoc || !yamlDoc.agentGroups || !Array.isArray(yamlDoc.agentGroups)) {
    return [];
  }

  const agents: AgentFormData[] = [];
  let phaseOrder = 0;

  for (const group of yamlDoc.agentGroups) {
    const phase = group.groupName || `Phase ${phaseOrder + 1}`;
    let agentOrder = 0;

    if (group.agents && Array.isArray(group.agents)) {
      for (const agent of group.agents) {
        // Validate required fields
        if (!agent.name?.trim()) {
          throw new Error(`Agent in phase "${phase}" is missing a name`);
        }

        // Parse metrics - convert string values to numbers
        const parseMetricValue = (val: number | string | undefined): number | undefined => {
          if (val === undefined) return undefined;
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          return isNaN(num) ? undefined : num;
        };

        const metrics: { numberOfUsers?: number; timesUsed?: number; timeSaved?: number; roi?: number } = {};
        const numberOfUsers = parseMetricValue(agent.metrics?.numberOfUsers);
        const timesUsed = parseMetricValue(agent.metrics?.timesUsed);
        const timeSaved = parseMetricValue(agent.metrics?.timeSaved);
        const roi = parseMetricValue(agent.metrics?.roi);

        if (numberOfUsers !== undefined) metrics.numberOfUsers = numberOfUsers;
        if (timesUsed !== undefined) metrics.timesUsed = timesUsed;
        if (timeSaved !== undefined) metrics.timeSaved = timeSaved;
        if (roi !== undefined) metrics.roi = roi;

        agents.push({
          phase,
          phaseOrder,
          agentOrder: agentOrder++,
          name: agent.name.trim(),
          objective: agent.objective?.trim() || undefined,
          description: agent.description?.trim() || undefined,
          tools: Array.isArray(agent.tools) ? agent.tools : [],
          journeySteps: Array.isArray(agent.journeySteps) ? agent.journeySteps : [],
          demoLink: agent.demoLink?.trim() || undefined,
          videoLink: agent.videoLink?.trim() || undefined,
          metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
          category: agent.tags?.department || undefined, // YAML uses 'department', schema uses 'category'
          status: agent.tags?.status || undefined,
        });
      }
    }

    phaseOrder++;
  }

  return agents;
}

/**
 * Parse and validate YAML text
 */
export function parseYaml(yamlText: string): {
  title: string;
  agents: AgentFormData[];
} {
  if (!yamlText || typeof yamlText !== 'string') {
    throw new Error('YAML text is required');
  }

  let parsed: YamlDocument;
  try {
    parsed = yaml.load(yamlText) as YamlDocument;
  } catch (e: any) {
    throw new Error(`YAML parse error: ${e.message || String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('YAML document must be an object');
  }

  const title = parsed.documentTitle?.trim() || 'Imported Canvas';
  validateTitle(title);

  const agents = yamlToConvexAgents(parsed);

  return { title, agents };
}

/**
 * Import parameters
 */
export interface ImportYamlParams {
  yamlText: string;
  overrideTitle?: string;
  existingSlugs: Set<string>;
}

/**
 * Import result
 */
export interface ImportYamlResult {
  title: string;
  slug: string;
  agents: AgentFormData[];
}

/**
 * Prepare YAML for import (parse and generate slug)
 * Does not actually perform the import - that's done by calling Convex mutations
 */
export function prepareYamlImport({
  yamlText,
  overrideTitle,
  existingSlugs,
}: ImportYamlParams): ImportYamlResult {
  const { title: parsedTitle, agents } = parseYaml(yamlText);
  const title = overrideTitle?.trim() || parsedTitle;
  validateTitle(title);

  const slug = generateUniqueSlug(title, existingSlugs);

  return { title, slug, agents };
}

/**
 * Convert agents to YAML document structure
 */
function agentsToYamlDoc(title: string, agents: Agent[]): YamlDocument {
  // Group agents by phase, maintaining order
  const phaseMap = new Map<string, { order: number; agents: Agent[] }>();

  for (const agent of agents) {
    const existing = phaseMap.get(agent.phase);
    if (existing) {
      existing.agents.push(agent);
    } else {
      phaseMap.set(agent.phase, { order: agent.phaseOrder, agents: [agent] });
    }
  }

  // Sort phases by phaseOrder
  const sortedPhases = Array.from(phaseMap.entries())
    .sort((a, b) => a[1].order - b[1].order);

  const agentGroups: YamlAgentGroup[] = sortedPhases.map(([phaseName, { agents: phaseAgents }]) => {
    // Sort agents within phase by agentOrder
    const sortedAgents = [...phaseAgents].sort((a, b) => a.agentOrder - b.agentOrder);

    return {
      groupName: phaseName,
      agents: sortedAgents.map((agent): YamlAgent => {
        const yamlAgent: YamlAgent = {
          name: agent.name,
        };

        if (agent.objective) yamlAgent.objective = agent.objective;
        if (agent.description) yamlAgent.description = agent.description;
        if (agent.tools?.length) yamlAgent.tools = agent.tools;
        if (agent.journeySteps?.length) yamlAgent.journeySteps = agent.journeySteps;
        if (agent.demoLink) yamlAgent.demoLink = agent.demoLink;
        if (agent.videoLink) yamlAgent.videoLink = agent.videoLink;

        if (agent.metrics && Object.keys(agent.metrics).length > 0) {
          yamlAgent.metrics = {};
          if (agent.metrics.numberOfUsers !== undefined) yamlAgent.metrics.numberOfUsers = agent.metrics.numberOfUsers;
          if (agent.metrics.timesUsed !== undefined) yamlAgent.metrics.timesUsed = agent.metrics.timesUsed;
          if (agent.metrics.timeSaved !== undefined) yamlAgent.metrics.timeSaved = agent.metrics.timeSaved;
          if (agent.metrics.roi !== undefined) yamlAgent.metrics.roi = agent.metrics.roi;
        }

        // Map 'category' back to 'department' in tags for YAML format
        if (agent.category || agent.status) {
          yamlAgent.tags = {};
          if (agent.category) yamlAgent.tags.department = agent.category;
          if (agent.status) yamlAgent.tags.status = agent.status;
        }

        return yamlAgent;
      }),
    };
  });

  return {
    documentTitle: title,
    agentGroups,
  };
}

/**
 * Export canvas and agents to YAML string
 */
export function exportToYaml(title: string, agents: Agent[]): string {
  const doc = agentsToYamlDoc(title, agents);
  return yaml.dump(doc, {
    indent: 2,
    lineWidth: -1, // Don't wrap lines
    noRefs: true,
    sortKeys: false,
  });
}
