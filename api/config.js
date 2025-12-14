import { getQueryParam } from './lib/auth-utils.js';
import { requireAuth } from './lib/clerk.js';
import { query, queryOne } from './lib/db.js';
import { checkCanvasAccess, checkCanvasWriteAccess, getAccessibleCanvases, canManageCanvases, getUserGroups } from './lib/permissions.js';

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
    const { userId, email } = auth;

    const listParam = getQueryParam(req, 'list');
    if (listParam === '1' || listParam === 'true') {
      const canvases = await getAccessibleCanvases(userId, email);
      const documents = canvases.map(canvas => ({
        id: canvas.id,
        name: canvas.slug + '.yaml', // Backward compatibility
        slug: canvas.slug,
        title: canvas.title,
        group_id: canvas.group_id,
        group_name: canvas.group_name,
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

    const { hasAccess, canvas, role } = await checkCanvasAccess(userId, email, docId);

    if (!hasAccess || !canvas) {
      json(res, 404, { error: `Canvas not found or access denied` });
      return;
    }

    const docName = canvas.slug + '.yaml'; // Backward compatibility
    res.status(200)
      .setHeader('Content-Type', YAML_CONTENT_TYPE)
      .setHeader('Content-Disposition', `inline; filename="${docName}"`)
      .setHeader('X-Config-Document', docName)
      .setHeader('X-Canvas-Group-Id', canvas.group_id)
      .setHeader('X-Canvas-Role', role)
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
 * Requires group_id for new canvases
 */
async function handlePost(req, res) {
  try {
    const auth = await requireAuth(req);
    const { userId, email } = auth;

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

    const docId = getDocumentIdentifier(req);
    const groupId = getQueryParam(req, 'group_id') || getHeader(req, 'x-group-id');

    // Extract title from YAML if possible, or use slug
    let title = 'Untitled Canvas';
    try {
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

    // Check if canvas exists (by slug across all groups user has access to)
    // First try to find in specific group if provided
    let existingCanvas = null;
    if (groupId) {
      existingCanvas = await queryOne(
        `SELECT * FROM canvases WHERE group_id = $1 AND slug = $2`,
        [groupId, slug]
      );
    } else {
      // Try to find existing canvas by slug (for updates)
      const { canvas } = await checkCanvasAccess(userId, email, slug);
      existingCanvas = canvas;
    }

    if (existingCanvas) {
      // Update existing canvas - check write access
      const { hasAccess, role } = await checkCanvasWriteAccess(userId, email, existingCanvas.id);
      if (!hasAccess) {
        json(res, 403, { error: 'Access denied. You do not have permission to edit this canvas.' });
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
        group_id: existingCanvas.group_id,
        size: yamlText.length
      });
    } else {
      // Create new canvas - requires group_id
      if (!groupId) {
        // Try to use user's first group as default
        const userGroups = await getUserGroups(userId, email);
        if (userGroups.length === 0) {
          json(res, 400, { error: 'No groups available. You must be a member of a group to create canvases.' });
          return;
        }

        // Find a group where user is admin
        const adminGroup = userGroups.find(g => g.role === 'admin' || g.role === 'super_admin');
        if (!adminGroup) {
          json(res, 403, { error: 'You do not have permission to create canvases. Ask a group admin for access.' });
          return;
        }

        json(res, 400, { error: 'Group ID is required for new canvases. Use group_id query parameter.' });
        return;
      }

      // Verify group exists
      const group = await queryOne(`SELECT * FROM groups WHERE id = $1`, [groupId]);
      if (!group) {
        json(res, 404, { error: 'Group not found' });
        return;
      }

      // Check user can create canvases in this group (admin only)
      const canCreate = await canManageCanvases(userId, email, groupId);
      if (!canCreate) {
        json(res, 403, { error: 'You do not have permission to create canvases in this group.' });
        return;
      }

      // Check slug doesn't already exist in group
      const existing = await queryOne(
        `SELECT * FROM canvases WHERE group_id = $1 AND slug = $2`,
        [groupId, slug]
      );
      if (existing) {
        json(res, 400, { error: 'A canvas with this name already exists in the group' });
        return;
      }

      const result = await queryOne(
        `INSERT INTO canvases (group_id, title, slug, yaml_text, created_by_user_id, updated_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [groupId, title, slug, yamlText, userId, userId]
      );

      json(res, 200, {
        success: true,
        document: slug + '.yaml',
        id: result.id,
        slug: slug,
        group_id: groupId,
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
    const { userId, email } = auth;

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

    // Check access to existing canvas - need admin to rename
    const { hasAccess, canvas, role } = await checkCanvasAccess(userId, email, docId);
    if (!hasAccess || !canvas) {
      json(res, 404, { error: `Canvas not found or access denied` });
      return;
    }

    // Only admins can rename
    const canManage = await canManageCanvases(userId, email, canvas.group_id);
    if (!canManage) {
      json(res, 403, { error: 'Only group admins can rename canvases' });
      return;
    }

    // Check if new slug already exists in same group
    const existing = await queryOne(
      `SELECT * FROM canvases WHERE group_id = $1 AND slug = $2 AND id != $3`,
      [canvas.group_id, newSlug, canvas.id]
    );

    if (existing) {
      json(res, 400, { error: 'A canvas with this name already exists in the group' });
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
      id: canvas.id,
      group_id: canvas.group_id
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
 * Deletes a canvas (admin only)
 */
async function handleDelete(req, res) {
  try {
    const auth = await requireAuth(req);
    const { userId, email } = auth;

    const docId = getDocumentIdentifier(req);
    if (!docId) {
      json(res, 400, { error: 'Missing document identifier' });
      return;
    }

    // Check access
    const { hasAccess, canvas } = await checkCanvasAccess(userId, email, docId);
    if (!hasAccess || !canvas) {
      json(res, 404, { error: `Canvas not found or access denied` });
      return;
    }

    // Only admins can delete
    const canManage = await canManageCanvases(userId, email, canvas.group_id);
    if (!canManage) {
      json(res, 403, { error: 'Only group admins can delete canvases' });
      return;
    }

    await query(`DELETE FROM canvases WHERE id = $1`, [canvas.id]);

    json(res, 200, {
      success: true,
      deleted: canvas.slug + '.yaml',
      id: canvas.id,
      group_id: canvas.group_id
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
