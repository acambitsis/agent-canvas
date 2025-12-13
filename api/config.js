import { getQueryParam } from './lib/auth-utils.js';
import { requireAuth } from './lib/clerk.js';
import { query, queryOne } from './lib/db.js';
import { checkCanvasAccess, checkCanvasWriteAccess, getAccessibleCanvases } from './lib/permissions.js';

const DEFAULT_DOCUMENT = 'config.yaml';
const YAML_CONTENT_TYPE = 'text/yaml';

export const config = {
  api: {
    bodyParser: false,
  },
};

const json = (res, status, payload) =>
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (typeof req.on !== 'function') {
      resolve(Buffer.alloc(0));
      return;
    }
    
    const chunks = [];
    req.on('data', chunk => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getHeader(req, name) {
  return req.headers[name] || req.headers[name.toLowerCase()];
}

function sanitizeSlug(slug) {
  if (!slug) return null;
  // Remove .yaml extension if present, then sanitize
  let normalized = slug.trim().replace(/\.yaml$/, '').replace(/\.yml$/, '');
  // Allow alphanumeric, dash, underscore, dot
  normalized = normalized.replace(/[^A-Za-z0-9._-]/g, '-');
  if (!normalized) {
    throw new Error('Invalid slug. Use alphanumeric, dot, dash, or underscore characters.');
  }
  return normalized;
}

function getDocumentIdentifier(req) {
  const queryDoc = getQueryParam(req, 'doc');
  const headerDoc = getHeader(req, 'x-config-name');
  return queryDoc || headerDoc || null;
}

/**
 * GET handler
 * - list=1 → JSON list of accessible canvases
 * - otherwise → YAML content for requested canvas
 */
async function handleGet(req, res) {
  try {
    const auth = await requireAuth(req);
    const { userId, orgId } = auth;

    const listParam = getQueryParam(req, 'list');
    if (listParam === '1' || listParam === 'true') {
      const canvases = await getAccessibleCanvases(userId, orgId);
      const documents = canvases.map(canvas => ({
        id: canvas.id,
        name: canvas.slug + '.yaml', // Backward compatibility
        slug: canvas.slug,
        title: canvas.title,
        scope_type: canvas.scope_type,
        org_id: canvas.org_id,
        updatedAt: canvas.updated_at,
        updated_at: canvas.updated_at,
      }));

      json(res, 200, { documents });
      return;
    }

    // Get specific canvas
    let docId = getDocumentIdentifier(req);
    if (!docId) {
      json(res, 400, { error: 'Missing document identifier' });
      return;
    }

    // Strip .yaml/.yml extension for database lookup (slugs stored without extension)
    docId = docId.replace(/\.ya?ml$/, '');

    const { hasAccess, canvas } = await checkCanvasAccess(userId, orgId, docId);
    
    if (!hasAccess || !canvas) {
      json(res, 404, { error: `Canvas not found or access denied` });
      return;
    }

    const docName = canvas.slug + '.yaml'; // Backward compatibility
    res.status(200)
      .setHeader('Content-Type', YAML_CONTENT_TYPE)
      .setHeader('Content-Disposition', `inline; filename="${docName}"`)
      .setHeader('X-Config-Document', docName)
      .send(canvas.yaml_text);

  } catch (error) {
    if (error.message === 'Authentication required') {
      json(res, 401, { error: 'Authentication required' });
      return;
    }
    console.error('Error fetching config:', error);
    json(res, 500, { error: 'Failed to load configuration' });
  }
}

/**
 * POST handler
 * Creates or updates a canvas
 */
async function handlePost(req, res) {
  try {
    const auth = await requireAuth(req);
    const { userId, orgId } = auth;

    const buffer = await readRawBody(req);
    let yamlText = buffer.toString('utf8');

    if (!yamlText && req.body) {
      yamlText = typeof req.body === 'string' ? req.body : Buffer.from(req.body).toString('utf8');
    }
    if (!yamlText && req.rawBody) {
      yamlText = Buffer.from(req.rawBody).toString('utf8');
    }

    if (!yamlText) {
      json(res, 400, { error: 'No content provided' });
      return;
    }

    // Determine scope and title from request
    const docId = getDocumentIdentifier(req);
    let scopeType = 'personal';
    let canvasOrgId = null;
    
    // If user is in an org context, default to org canvas
    // Can be overridden by query param
    const scopeParam = getQueryParam(req, 'scope');
    if (scopeParam === 'org' && orgId) {
      scopeType = 'org';
      canvasOrgId = orgId;
    } else if (scopeParam === 'personal') {
      scopeType = 'personal';
    } else if (orgId) {
      // Default to org if in org context
      scopeType = 'org';
      canvasOrgId = orgId;
    }

    // Extract title from YAML if possible, or use slug
    let title = 'Untitled Canvas';
    try {
      // Try to extract title from YAML (simple regex approach to avoid requiring js-yaml)
      const titleMatch = yamlText.match(/^title:\s*(.+)$/m);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
      }
    } catch (e) {
      // Ignore errors
    }

    let slug;
    if (docId) {
      slug = sanitizeSlug(docId);
      if (!slug) {
        json(res, 400, { error: 'Invalid document identifier' });
        return;
      }
    } else {
      // Generate slug from title
      slug = sanitizeSlug(title) || 'canvas-' + Date.now();
    }

    // Check if canvas exists
    const existingCanvas = await queryOne(
      scopeType === 'org'
        ? `SELECT * FROM canvases WHERE scope_type = $1 AND org_id = $2 AND slug = $3`
        : `SELECT * FROM canvases WHERE scope_type = $1 AND owner_user_id = $2 AND slug = $3`,
      scopeType === 'org' ? [scopeType, canvasOrgId, slug] : [scopeType, userId, slug]
    );

    if (existingCanvas) {
      // Update existing canvas
      const { hasAccess } = await checkCanvasWriteAccess(userId, orgId, existingCanvas.id);
      if (!hasAccess) {
        json(res, 403, { error: 'Access denied' });
        return;
      }

      await query(
        `UPDATE canvases 
         SET yaml_text = $1, updated_by_user_id = $2, title = $3, updated_at = now()
         WHERE id = $4`,
        [yamlText, userId, title, existingCanvas.id]
      );

      json(res, 200, {
        success: true,
        document: slug + '.yaml',
        id: existingCanvas.id,
        slug: slug,
        size: yamlText.length
      });
    } else {
      // Create new canvas
      const ownerUserId = userId;
      
      const result = await queryOne(
        `INSERT INTO canvases (scope_type, owner_user_id, org_id, title, slug, yaml_text, created_by_user_id, updated_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [scopeType, ownerUserId, canvasOrgId, title, slug, yamlText, userId, userId]
      );

      json(res, 200, {
        success: true,
        document: slug + '.yaml',
        id: result.id,
        slug: slug,
        size: yamlText.length
      });
    }

  } catch (error) {
    if (error.message === 'Authentication required') {
      json(res, 401, { error: 'Authentication required' });
      return;
    }
    console.error('[api/config POST] Error saving config', { error });
    json(res, 500, { error: error.message || 'Failed to save configuration' });
  }
}

/**
 * PUT handler
 * Renames a canvas (updates slug)
 */
async function handlePut(req, res) {
  try {
    const auth = await requireAuth(req);
    const { userId, orgId } = auth;

    const docId = getDocumentIdentifier(req);
    if (!docId) {
      json(res, 400, { error: 'Missing document identifier' });
      return;
    }

    const newDocParam = getQueryParam(req, 'newDoc');
    if (!newDocParam) {
      json(res, 400, { error: 'Missing new document name' });
      return;
    }

    const newSlug = sanitizeSlug(newDocParam);
    if (!newSlug) {
      json(res, 400, { error: 'Invalid new document name' });
      return;
    }

    // Check access to existing canvas
    const { hasAccess, canvas } = await checkCanvasWriteAccess(userId, orgId, docId);
    if (!hasAccess || !canvas) {
      json(res, 404, { error: `Canvas not found or access denied` });
      return;
    }

    // Check if new slug already exists in same scope
    const existing = await queryOne(
      canvas.scope_type === 'org'
        ? `SELECT * FROM canvases WHERE scope_type = $1 AND org_id = $2 AND slug = $3 AND id != $4`
        : `SELECT * FROM canvases WHERE scope_type = $1 AND owner_user_id = $2 AND slug = $3 AND id != $4`,
      canvas.scope_type === 'org'
        ? [canvas.scope_type, canvas.org_id, newSlug, canvas.id]
        : [canvas.scope_type, canvas.owner_user_id, newSlug, canvas.id]
    );

    if (existing) {
      json(res, 400, { error: 'A canvas with this name already exists' });
      return;
    }

    // Update slug
    await query(
      `UPDATE canvases SET slug = $1, updated_by_user_id = $2, updated_at = now() WHERE id = $3`,
      [newSlug, userId, canvas.id]
    );

    json(res, 200, {
      success: true,
      document: newSlug + '.yaml',
      previous: canvas.slug + '.yaml',
      id: canvas.id
    });

  } catch (error) {
    if (error.message === 'Authentication required') {
      json(res, 401, { error: 'Authentication required' });
      return;
    }
    console.error('Error renaming config:', error);
    json(res, 500, { error: error.message || 'Failed to rename configuration' });
  }
}

/**
 * DELETE handler
 * Deletes a canvas
 */
async function handleDelete(req, res) {
  try {
    const auth = await requireAuth(req);
    const { userId, orgId } = auth;

    const docId = getDocumentIdentifier(req);
    if (!docId) {
      json(res, 400, { error: 'Missing document identifier' });
      return;
    }

    // Check access - only owner can delete
    const { hasAccess, canvas } = await checkCanvasAccess(userId, orgId, docId);
    if (!hasAccess || !canvas) {
      json(res, 404, { error: `Canvas not found or access denied` });
      return;
    }

    // Only owner can delete
    if (canvas.owner_user_id !== userId) {
      json(res, 403, { error: 'Only the owner can delete a canvas' });
      return;
    }

    await query(`DELETE FROM canvases WHERE id = $1`, [canvas.id]);

    json(res, 200, { 
      success: true, 
      deleted: canvas.slug + '.yaml',
      id: canvas.id
    });

  } catch (error) {
    if (error.message === 'Authentication required') {
      json(res, 401, { error: 'Authentication required' });
      return;
    }
    console.error('Error deleting config:', error);
    json(res, 500, { error: error.message || 'Failed to delete configuration' });
  }
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else if (req.method === 'PUT') {
    return handlePut(req, res);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res);
  } else {
    res.status(405).send('Method not allowed');
  }
}
