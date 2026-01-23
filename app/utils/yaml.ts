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
 * YAML document structure (flat format matching database schema)
 */
interface YamlAgent {
  name?: string;
  phase?: string;
  agentOrder?: number;
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
  category?: string;
  status?: string;
}

interface YamlDocument {
  documentTitle?: string;
  agents?: YamlAgent[];
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
 * Parse a metric value from YAML (can be number or string)
 */
function parseMetricValue(val: number | string | undefined): number | undefined {
  if (val === undefined) return undefined;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? undefined : num;
}

/**
 * Convert YAML document to Convex agent format
 * Also extracts phases and categories for canvas-level storage
 */
function yamlToConvexAgents(yamlDoc: YamlDocument): YamlConversionResult {
  if (!yamlDoc || !yamlDoc.agents || !Array.isArray(yamlDoc.agents)) {
    return { agents: [], phases: [], categories: [] };
  }

  const agents: AgentFormData[] = [];
  const phasesSet = new Set<string>();
  const categoriesSet = new Set<string>();

  for (const agent of yamlDoc.agents) {
    // Validate required fields
    if (!agent.name?.trim()) {
      throw new Error('Agent is missing a name');
    }
    if (!agent.phase?.trim()) {
      throw new Error(`Agent "${agent.name}" is missing a phase`);
    }

    const phase = agent.phase.trim();
    phasesSet.add(phase);

    // Parse metrics - convert string values to numbers
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
    const category = agent.category?.trim() || undefined;
    if (category) categoriesSet.add(category);

    agents.push({
      phase,
      agentOrder: agent.agentOrder ?? 0,
      name: agent.name.trim(),
      objective: agent.objective?.trim() || undefined,
      description: agent.description?.trim() || undefined,
      tools: Array.isArray(agent.tools) ? agent.tools : [],
      journeySteps: Array.isArray(agent.journeySteps) ? agent.journeySteps : [],
      demoLink: agent.demoLink?.trim() || undefined,
      videoLink: agent.videoLink?.trim() || undefined,
      metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      category,
      status: parseStatus(agent.status),
    });
  }

  // Extract phases in order of first appearance
  const phases = Array.from(phasesSet);

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
  // Sort agents by phase order, then by agentOrder within phase
  const sortedAgents = [...agents].sort((a, b) => {
    // First sort by phase
    let phaseCompare: number;
    if (phaseOrder && phaseOrder.length > 0) {
      const aIndex = phaseOrder.indexOf(a.phase);
      const bIndex = phaseOrder.indexOf(b.phase);
      // Unknown phases go to the end alphabetically
      if (aIndex === -1 && bIndex === -1) {
        phaseCompare = a.phase.localeCompare(b.phase);
      } else if (aIndex === -1) {
        phaseCompare = 1;
      } else if (bIndex === -1) {
        phaseCompare = -1;
      } else {
        phaseCompare = aIndex - bIndex;
      }
    } else {
      phaseCompare = a.phase.localeCompare(b.phase);
    }

    // If same phase, sort by agentOrder
    if (phaseCompare !== 0) return phaseCompare;
    return a.agentOrder - b.agentOrder;
  });

  const yamlAgents: YamlAgent[] = sortedAgents.map((agent): YamlAgent => {
    const yamlAgent: YamlAgent = {
      name: agent.name,
      phase: agent.phase,
      agentOrder: agent.agentOrder,
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

    if (agent.category) yamlAgent.category = agent.category;
    if (agent.status) yamlAgent.status = agent.status;

    return yamlAgent;
  });

  return {
    documentTitle: title,
    agents: yamlAgents,
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
