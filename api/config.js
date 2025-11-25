import { BlobAccessError, BlobNotFoundError, del, head, list, put } from '@vercel/blob';

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
    // Fallback for environments without streams - check before attaching listeners
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

/**
 * Get header value from Node.js request
 */
function getHeader(req, name) {
  return req.headers[name] || req.headers[name.toLowerCase()];
}

/**
 * Check HTTP Basic Authentication against BASIC_AUTH_PASSWORD env var
 */
function checkAuth(req, res) {
  const basicAuth = getHeader(req, 'authorization');
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD?.trim();

  if (!expectedPassword) {
    res.status(500).send('Server configuration error');
    return false;
  }

  if (!basicAuth || !basicAuth.startsWith('Basic ')) {
    res.status(401).setHeader('WWW-Authenticate', 'Basic realm="Secure Area"').send('Authentication required');
    return false;
  }

  const encodedToken = basicAuth.split(' ')[1];
  try {
    const [, pwd] = Buffer.from(encodedToken, 'base64').toString().split(':');
    if (pwd?.trim() === expectedPassword) {
      return true;
    }
  } catch (e) {
    // Invalid auth header format
  }

  res.status(401).setHeader('WWW-Authenticate', 'Basic realm="Secure Area"').send('Authentication required');
  return false;
}

function getQueryParam(req, key) {
  if (req.query && req.query[key] !== undefined) {
    return req.query[key];
  }
  if (req.url) {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      return url.searchParams.get(key);
    } catch {
      // ignore parse errors
    }
  }
  return undefined;
}

function ensureBlobToken(res) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    json(res, 500, { error: 'Blob storage token is not configured. Please set BLOB_READ_WRITE_TOKEN.' });
    return null;
  }
  return blobToken;
}

function sanitizeDocumentName(name) {
  if (!name) return DEFAULT_DOCUMENT;
  let normalized = name.trim();
  if (!normalized.endsWith('.yaml')) {
    normalized += '.yaml';
  }
  const isValid = /^[A-Za-z0-9._-]+\.yaml$/.test(normalized);
  if (!isValid) {
    throw new Error('Invalid document name. Use alphanumeric, dot, dash, or underscore characters only.');
  }
  return normalized;
}

function getDocumentName(req) {
  const queryDoc = getQueryParam(req, 'doc');
  const headerDoc = getHeader(req, 'x-config-name');
  return sanitizeDocumentName(queryDoc || headerDoc || DEFAULT_DOCUMENT);
}

async function fetchDocumentFromBlob(docName, token) {
  try {
    const { url } = await head(docName, { token });
    if (!url) {
      return null;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Blob fetch failed with status ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    // Handle BlobAccessError and BlobNotFoundError from @vercel/blob
    // These are thrown when a document doesn't exist
    // Check both instanceof and error name for robustness
    if (
      error instanceof BlobAccessError ||
      error instanceof BlobNotFoundError ||
      error?.name === 'BlobAccessError' ||
      error?.name === 'BlobNotFoundError'
    ) {
      return null;
    }
    // Backward compatibility: check for status properties (for test mocks)
    // This comes after the real error type checks since BlobAccessError/BlobNotFoundError
    // don't have .status or .statusCode properties
    if (error?.status === 404 || error?.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * GET handler
 * - list=1 → JSON list of YAML documents
 * - otherwise → YAML content for requested doc
 */
async function handleGet(req, res) {
  const blobToken = ensureBlobToken(res);
  if (!blobToken) return;

  const listParam = getQueryParam(req, 'list');
  if (listParam === '1' || listParam === 'true') {
    try {
      const { blobs } = await list({ token: blobToken, limit: 1000 });
      const documents = blobs
        .filter(blob => blob.pathname.endsWith('.yaml') || blob.pathname.endsWith('.yml'))
        .map(blob => ({
          name: blob.pathname,
          size: blob.size,
          updatedAt: blob.uploadedAt
        }));

      json(res, 200, { documents });
    } catch (error) {
      console.error('Error listing documents:', error);
      json(res, 500, { error: 'Failed to list documents' });
    }
    return;
  }

  try {
    const docName = getDocumentName(req);
    const yamlText = await fetchDocumentFromBlob(docName, blobToken);

    if (!yamlText) {
      json(res, 404, { error: `Document "${docName}" not found` });
      return;
    }

    res.status(200)
      .setHeader('Content-Type', YAML_CONTENT_TYPE)
      .setHeader('Content-Disposition', `inline; filename="${docName}"`)
      .setHeader('X-Config-Document', docName)
      .send(yamlText);
  } catch (error) {
    console.error('Error fetching config:', error);
    json(res, 500, { error: 'Failed to load configuration' });
  }
}

/**
 * POST handler
 * Saves config to Blob Storage
 */
async function handlePost(req, res) {
  const blobToken = ensureBlobToken(res);
  if (!blobToken) return;

  try {
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

    const docName = getDocumentName(req);
    const blob = await put(docName, yamlText, {
      access: 'public',
      token: blobToken,
      addRandomSuffix: false,
      contentType: YAML_CONTENT_TYPE
    });

    json(res, 200, {
      success: true,
      document: docName,
      url: blob.url,
      size: yamlText.length
    });

  } catch (error) {
    console.error('[api/config POST] Error saving config', { error });
    json(res, 500, { error: 'Failed to save configuration' });
  }
}

/**
 * PUT handler
 * Renames an existing YAML document
 */
async function handlePut(req, res) {
  const blobToken = ensureBlobToken(res);
  if (!blobToken) return;

  try {
    const docName = getDocumentName(req);
    const newDocParam = getQueryParam(req, 'newDoc');
    if (!newDocParam) {
      json(res, 400, { error: 'Missing new document name' });
      return;
    }

    const newDocName = sanitizeDocumentName(newDocParam);
    if (docName === newDocName) {
      json(res, 400, { error: 'New document name must be different' });
      return;
    }

    const yamlText = await fetchDocumentFromBlob(docName, blobToken);
    if (!yamlText) {
      json(res, 404, { error: `Document "${docName}" not found` });
      return;
    }

    await put(newDocName, yamlText, {
      access: 'public',
      token: blobToken,
      addRandomSuffix: false,
      contentType: YAML_CONTENT_TYPE
    });

    await del(docName, { token: blobToken });

    json(res, 200, {
      success: true,
      document: newDocName,
      previous: docName
    });

  } catch (error) {
    console.error('Error renaming config:', error);
    json(res, 500, { error: 'Failed to rename configuration' });
  }
}

/**
 * DELETE handler
 * Deletes config from Blob Storage
 */
async function handleDelete(req, res) {
  const blobToken = ensureBlobToken(res);
  if (!blobToken) return;

  try {
    const docParam = getQueryParam(req, 'doc');
    if (!docParam) {
      json(res, 400, { error: 'Missing document name' });
      return;
    }

    const docName = sanitizeDocumentName(docParam);

    // Check if document exists
    const exists = await fetchDocumentFromBlob(docName, blobToken);
    if (exists === null) {
      json(res, 404, { error: `Document "${docName}" not found` });
      return;
    }

    // Delete from Blob Storage
    await del(docName, { token: blobToken });

    json(res, 200, { success: true, deleted: docName });

  } catch (error) {
    console.error('Error deleting config:', error);
    json(res, 500, { error: 'Failed to delete configuration' });
  }
}

/**
 * Main handler - routes to GET or POST
 */
export default async function handler(req, res) {
  // Check authentication first
  if (!checkAuth(req, res)) {
    return; // checkAuth already sent the response
  }

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
