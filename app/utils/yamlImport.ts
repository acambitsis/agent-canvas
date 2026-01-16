/**
 * Legacy YAML import utility
 * One-way import: YAML → Convex (no YAML persistence)
 */

import * as yaml from 'js-yaml';
import { AgentFormData } from '@/types/agent';

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
    usageThisWeek?: string;
    timeSaved?: string;
    roiContribution?: string;
  };
  tags?: {
    department?: string;
    status?: string;
    implementationStatus?: string;
    priority?: string;
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
  if (trimmed.length > 100) {
    throw new Error('Canvas title must be 100 characters or less');
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

        // Parse metrics - only include if we have valid numeric values
        // Note: usageThisWeek is a usage count, not a 0-100 percentage, so we skip it
        // timeSaved is a percentage (e.g., "60%") which we parse
        const satisfaction = agent.metrics?.timeSaved
          ? parseFloat(agent.metrics.timeSaved)
          : undefined;

        // For adoption, we could derive it from usageThisWeek or set a default
        // For now, set to undefined if no valid timeSaved percentage
        const metrics = (satisfaction !== undefined && !isNaN(satisfaction) &&
                        satisfaction >= 0 && satisfaction <= 100)
          ? { adoption: satisfaction, satisfaction } // Use same value for both
          : undefined;

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
          metrics,
          roiContribution: agent.metrics?.roiContribution as any || undefined,
          department: agent.tags?.department || undefined,
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
