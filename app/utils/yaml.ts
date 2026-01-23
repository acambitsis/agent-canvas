/**
 * YAML import/export utilities for canvas data
 */

import * as yaml from 'js-yaml';
import { Agent, AgentFormData } from '@/types/agent';
import { VALIDATION_CONSTANTS, AGENT_STATUS, AgentStatus } from '@/types/validationConstants';

/**
 * Valid status values for validation
 */
const VALID_STATUSES = new Set<string>(Object.values(AGENT_STATUS));

/**
 * Parse and validate status value from YAML
 * Returns undefined for invalid/missing values
 */
function parseStatus(value: string | undefined): AgentStatus | undefined {
  if (!value) return undefined;
  return VALID_STATUSES.has(value) ? (value as AgentStatus) : undefined;
}

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
 * Result of converting YAML document
 */
interface YamlConversionResult {
  agents: AgentFormData[];
  phases: string[];
  categories: string[];
}

/**
 * Convert YAML document to Convex agent format
 * Also extracts phases and categories for canvas-level storage
 */
function yamlToConvexAgents(yamlDoc: YamlDocument): YamlConversionResult {
  if (!yamlDoc || !yamlDoc.agentGroups || !Array.isArray(yamlDoc.agentGroups)) {
    return { agents: [], phases: [], categories: [] };
  }

  const agents: AgentFormData[] = [];
  const phases: string[] = [];
  const categoriesSet = new Set<string>();
  let phaseIndex = 0;

  for (const group of yamlDoc.agentGroups) {
    const phase = group.groupName || `Phase ${phaseIndex + 1}`;
    phases.push(phase);
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

        // Track category for canvas-level storage
        const category = agent.tags?.department || undefined;
        if (category) categoriesSet.add(category);

        agents.push({
          phase,
          agentOrder: agentOrder++,
          name: agent.name.trim(),
          objective: agent.objective?.trim() || undefined,
          description: agent.description?.trim() || undefined,
          tools: Array.isArray(agent.tools) ? agent.tools : [],
          journeySteps: Array.isArray(agent.journeySteps) ? agent.journeySteps : [],
          demoLink: agent.demoLink?.trim() || undefined,
          videoLink: agent.videoLink?.trim() || undefined,
          metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
          category, // YAML uses 'department', schema uses 'category'
          status: parseStatus(agent.tags?.status),
        });
      }
    }

    phaseIndex++;
  }

  return {
    agents,
    phases: phases.length > 0 ? phases : ['Backlog'],
    categories: categoriesSet.size > 0 ? Array.from(categoriesSet) : ['Uncategorized'],
  };
}

/**
 * Parse and validate YAML text
 */
export function parseYaml(yamlText: string): {
  title: string;
  agents: AgentFormData[];
  phases: string[];
  categories: string[];
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

  const { agents, phases, categories } = yamlToConvexAgents(parsed);

  return { title, agents, phases, categories };
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
  phases: string[];
  categories: string[];
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
  const { title: parsedTitle, agents, phases, categories } = parseYaml(yamlText);
  const title = overrideTitle?.trim() || parsedTitle;
  validateTitle(title);

  const slug = generateUniqueSlug(title, existingSlugs);

  return { title, slug, agents, phases, categories };
}

/**
 * Convert agents to YAML document structure
 * Uses canvas-level phaseOrder array for phase ordering
 */
function agentsToYamlDoc(title: string, agents: Agent[], phaseOrder?: string[]): YamlDocument {
  // Group agents by phase
  const phaseMap = new Map<string, Agent[]>();

  for (const agent of agents) {
    const existing = phaseMap.get(agent.phase);
    if (existing) {
      existing.push(agent);
    } else {
      phaseMap.set(agent.phase, [agent]);
    }
  }

  // Sort phases using canvas-level phaseOrder, or alphabetically if not provided
  let sortedPhaseNames: string[];
  if (phaseOrder && phaseOrder.length > 0) {
    sortedPhaseNames = [...phaseMap.keys()].sort((a, b) => {
      const aIndex = phaseOrder.indexOf(a);
      const bIndex = phaseOrder.indexOf(b);
      // Unknown phases go to the end alphabetically
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  } else {
    sortedPhaseNames = [...phaseMap.keys()].sort();
  }

  const agentGroups: YamlAgentGroup[] = sortedPhaseNames.map((phaseName) => {
    const phaseAgents = phaseMap.get(phaseName) || [];
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
 * @param title - Canvas title
 * @param agents - List of agents to export
 * @param phaseOrder - Optional canvas-level phase ordering array
 * @throws Error if title is invalid
 */
export function exportToYaml(title: string, agents: Agent[], phaseOrder?: string[]): string {
  validateTitle(title);
  const doc = agentsToYamlDoc(title, agents, phaseOrder);
  return yaml.dump(doc, {
    indent: 2,
    lineWidth: -1, // Don't wrap lines
    noRefs: true,
    sortKeys: false,
  });
}
