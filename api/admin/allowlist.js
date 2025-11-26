import { isAuthenticated, getAuthenticatedEmail } from '../lib/session.js';
import { normalizeEmail, validateEmail, getQueryParam } from '../lib/auth-utils.js';
import { addToAllowlist, removeFromAllowlist, listAllowlist, isInAllowlist } from '../lib/storage.js';

const json = (res, status, payload) =>
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));

/**
 * Check if user is admin (in ALLOWED_EMAILS env var)
 * This determines who can manage the allowlist
 */
function isAdmin(email) {
  const allowedEmails = process.env.ALLOWED_EMAILS;
  if (!allowedEmails) {
    return false;
  }
  
  const normalized = normalizeEmail(email);
  const allowedList = allowedEmails.split(',').map(e => normalizeEmail(e.trim()));
  
  return allowedList.includes(normalized);
}

async function readBody(req) {
  if (req.body) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * GET /api/admin/allowlist
 * List all emails in the allowlist (from both env var and KV)
 */
async function handleGet(req, res) {
  try {
    // Get emails from KV storage
    const kvEmails = await listAllowlist();
    
    // Get emails from env var (for admins)
    const envEmails = [];
    const allowedEmails = process.env.ALLOWED_EMAILS;
    if (allowedEmails) {
      const envList = allowedEmails.split(',').map(e => normalizeEmail(e.trim()));
      for (const email of envList) {
        // Check if it's also in KV (to avoid duplicates)
        const inKV = kvEmails.some(e => e.email === email);
        if (!inKV) {
          envEmails.push({
            email,
            addedAt: null, // Unknown when added via env var
            addedBy: 'system', // Added via environment variable
            source: 'env'
          });
        } else {
          // Mark KV entries that are also in env var
          const kvEntry = kvEmails.find(e => e.email === email);
          if (kvEntry) {
            kvEntry.source = 'both';
          }
        }
      }
    }
    
    // Combine and sort
    // Preserve existing source property (may be 'both' if also in env var), otherwise default to 'kv'
    const allEmails = [...kvEmails.map(e => ({ ...e, source: e.source || 'kv' })), ...envEmails];
    allEmails.sort((a, b) => {
      // Env var entries first, then by date
      if (a.source === 'env' && b.source !== 'env') return -1;
      if (a.source !== 'env' && b.source === 'env') return 1;
      if (a.addedAt && b.addedAt) {
        return new Date(b.addedAt) - new Date(a.addedAt);
      }
      return 0;
    });
    
    return json(res, 200, {
      success: true,
      emails: allEmails,
      count: allEmails.length
    });
  } catch (error) {
    console.error('Error listing allowlist:', error);
    return json(res, 500, {
      success: false,
      error: 'Failed to list allowlist'
    });
  }
}

/**
 * POST /api/admin/allowlist
 * Add an email to the allowlist
 */
async function handlePost(req, res) {
  try {
    const body = await readBody(req);
    const { email } = body || {};
    
    if (!email || !validateEmail(email)) {
      return json(res, 400, {
        success: false,
        error: 'Invalid email format'
      });
    }
    
    const normalizedEmail = normalizeEmail(email);
    
    // Check if already exists
    const exists = await isInAllowlist(normalizedEmail);
    if (exists) {
      return json(res, 409, {
        success: false,
        error: 'Email already in allowlist'
      });
    }
    
    // Get admin email from session
    const adminEmail = await getAuthenticatedEmail(req);
    
    // Add to KV storage
    const added = await addToAllowlist(normalizedEmail, adminEmail || 'unknown');
    
    if (!added) {
      return json(res, 409, {
        success: false,
        error: 'Email already in allowlist'
      });
    }
    
    return json(res, 200, {
      success: true,
      message: 'Email added to allowlist',
      email: normalizedEmail
    });
  } catch (error) {
    console.error('Error adding to allowlist:', error);
    return json(res, 500, {
      success: false,
      error: 'Failed to add email to allowlist'
    });
  }
}

/**
 * DELETE /api/admin/allowlist
 * Remove an email from the allowlist (query param: ?email=xxx)
 */
async function handleDelete(req, res) {
  try {
    // Get email from query param
    const email = getQueryParam(req, 'email');
    
    if (!email || !validateEmail(email)) {
      return json(res, 400, {
        success: false,
        error: 'Invalid email format'
      });
    }
    
    const normalizedEmail = normalizeEmail(email);
    
    // Check if email is in env var (can't remove those via API)
    const allowedEmails = process.env.ALLOWED_EMAILS;
    if (allowedEmails) {
      const envList = allowedEmails.split(',').map(e => normalizeEmail(e.trim()));
      if (envList.includes(normalizedEmail)) {
        return json(res, 403, {
          success: false,
          error: 'Cannot remove email from environment variable allowlist. Use Vercel environment variables to modify.'
        });
      }
    }
    
    // Remove from KV storage
    const removed = await removeFromAllowlist(normalizedEmail);
    
    if (!removed) {
      return json(res, 404, {
        success: false,
        error: 'Email not found in allowlist'
      });
    }
    
    return json(res, 200, {
      success: true,
      message: 'Email removed from allowlist',
      email: normalizedEmail
    });
  } catch (error) {
    console.error('Error removing from allowlist:', error);
    return json(res, 500, {
      success: false,
      error: 'Failed to remove email from allowlist'
    });
  }
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  // Check authentication
  const authenticated = await isAuthenticated(req);
  if (!authenticated) {
    return json(res, 401, {
      success: false,
      error: 'Authentication required'
    });
  }
  
  // Check if user is admin (in ALLOWED_EMAILS)
  const userEmail = await getAuthenticatedEmail(req);
  if (!userEmail || !isAdmin(userEmail)) {
    return json(res, 403, {
      success: false,
      error: 'Admin access required'
    });
  }
  
  // Route to appropriate handler
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res);
  } else {
    return res.status(405).setHeader('Allow', 'GET, POST, DELETE').send('Method not allowed');
  }
}

