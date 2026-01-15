import { createCanvas, bulkCreateAgents } from './convex-client.js';
import { slugifyIdentifier } from './state.js';

async function ensureJsYaml() {
  if (typeof window === 'undefined') {
    throw new Error('Legacy YAML import requires a browser environment');
  }
  if (window.jsyaml) return window.jsyaml;

  // Lazy-load js-yaml only for legacy import.
  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-agentcanvas-jsyaml="true"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load js-yaml')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
    script.async = true;
    script.dataset.agentcanvasJsyaml = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load js-yaml'));
    document.head.appendChild(script);
  });

  if (!window.jsyaml) {
    throw new Error('js-yaml loaded but window.jsyaml is unavailable');
  }
  return window.jsyaml;
}

/**
 * Extract title from YAML text (for UI preview/suggestion)
 * @param {string} yamlText - Raw YAML text
 * @returns {Promise<string|null>} Extracted title or null if not found/unparseable
 */
export async function extractTitleFromYaml(yamlText) {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const jsyaml = await ensureJsYaml();
  try {
    const parsed = jsyaml.load(yamlText) || {};
    if (parsed?.documentTitle) {
      return String(parsed.documentTitle).trim() || null;
    }
  } catch {
    // Ignore parse errors - importer will handle validation
  }
  return null;
}

function sanitizeTitle(title) {
  const t = (title || '').toString().trim();
  if (!t) throw new Error('Canvas title is required.');
  return t;
}

function generateUniqueSlug(title, existingSlugs = new Set()) {
  const base = slugifyIdentifier(title) || 'canvas';
  let candidate = base;
  let suffix = 2;
  while (existingSlugs.has(candidate)) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

/**
 * Convert YAML document to Convex agents format
 * @param {object} yamlDoc - Parsed YAML document
 * @returns {Array} Array of agent objects ready for Convex
 */
function yamlToConvexAgents(yamlDoc) {
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
          roiContribution: agent.metrics?.roiContribution || undefined,
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
 * One-way legacy YAML import:
 * YAML -> (create canvas) + (bulkCreate agents)
 * Does NOT store YAML anywhere.
 */
export async function importLegacyYamlToNative({
  workosOrgId,
  yamlText,
  overrideTitle,
  existingSlugs,
} = {}) {
  if (!workosOrgId) throw new Error('workosOrgId is required');
  if (typeof yamlText !== 'string') throw new Error('yamlText must be a string');
  const jsyaml = await ensureJsYaml();

  let parsed;
  try {
    parsed = jsyaml.load(yamlText) || {};
  } catch (e) {
    throw new Error(`YAML parse error: ${e.message || String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('YAML document must be an object');
  }

  const title = sanitizeTitle(overrideTitle || parsed.documentTitle || 'Imported Canvas');
  const slug = generateUniqueSlug(title, existingSlugs);

  const canvasId = await createCanvas({ workosOrgId, title, slug });

  const agents = yamlToConvexAgents(parsed);
  if (agents.length > 0) {
    await bulkCreateAgents(canvasId, agents);
  }

  return { canvasId, title, agentCount: agents.length };
}

