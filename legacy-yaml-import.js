import { createCanvas, bulkCreateAgents } from './convex-client.js';
import { slugifyIdentifier } from './state.js';
import { yamlToConvexAgents } from './yaml-converter.js';

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

