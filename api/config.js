import { del, head, list, put } from '@vercel/blob';

const DEFAULT_DOCUMENT = 'config.yaml';
const YAML_CONTENT_TYPE = 'text/yaml';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getReadableStreamDiagnostics(req) {
  return {
    hasPipe: typeof req.pipe === 'function',
    hasOn: typeof req.on === 'function',
    readable: req.readable,
    hasBodyProp: Object.prototype.hasOwnProperty.call(req, 'body'),
    typeofBody: typeof req.body,
    hasRawBodyProp: Object.prototype.hasOwnProperty.call(req, 'rawBody'),
    typeofRawBody: typeof req.rawBody,
    reqConstructor: req.constructor?.name,
    httpVersion: req.httpVersion,
    headers: req.headers
  };
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let chunkCount = 0;
    let totalBytes = 0;
    const chunkDetails = [];

    const cleanup = () => {
      req.off?.('data', onData);
      req.off?.('end', onEnd);
      req.off?.('error', onError);
    };

    const onData = chunk => {
      chunkCount += 1;
      const isBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer?.(chunk);
      let bufferChunk;
      if (typeof chunk === 'string') {
        bufferChunk = Buffer.from(chunk, 'utf8');
      } else if (isBuffer) {
        bufferChunk = chunk;
      } else if (chunk instanceof Uint8Array) {
        bufferChunk = Buffer.from(chunk);
      } else if (chunk && typeof chunk === 'object' && typeof chunk.valueOf === 'function') {
        bufferChunk = Buffer.from(String(chunk.valueOf()));
      } else {
        bufferChunk = Buffer.from('');
      }

      totalBytes += bufferChunk.length;
      chunkDetails.push({
        index: chunkCount,
        originalType: typeof chunk,
        isBuffer,
        bufferLength: bufferChunk.length
      });

      chunks.push(bufferChunk);
    };

    const onEnd = () => {
      cleanup();
      resolve({
        buffer: Buffer.concat(chunks),
        chunkCount,
        totalBytes,
        chunkDetails
      });
    };

    const onError = error => {
      cleanup();
      reject(error);
    };

    if (typeof req.on === 'function') {
      req.on('data', onData);
      req.on('end', onEnd);
      req.on('error', onError);
    } else {
      resolve({
        buffer: Buffer.alloc(0),
        chunkCount: 0,
        totalBytes: 0,
        chunkDetails: [],
        unsupported: true
      });
    }
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
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;

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
    if (pwd === expectedPassword) {
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
    res.status(500).setHeader('Content-Type', 'application/json').send(JSON.stringify({
      error: 'Blob storage token is not configured. Please set BLOB_READ_WRITE_TOKEN.'
    }));
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

  if (req.query?.list === '1' || req.query?.list === 'true') {
    try {
      const { blobs } = await list({ token: blobToken, limit: 1000 });
      const documents = blobs
        .filter(blob => blob.pathname.endsWith('.yaml'))
        .map(blob => ({
          name: blob.pathname,
          size: blob.size,
          updatedAt: blob.uploadedAt
        }));

      res.status(200)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ documents }));
    } catch (error) {
      console.error('Error listing documents:', error);
      res.status(500)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ error: 'Failed to list documents' }));
    }
    return;
  }

  try {
    const docName = getDocumentName(req);
    const yamlText = await fetchDocumentFromBlob(docName, blobToken);

    if (!yamlText) {
      res.status(404)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ error: `Document "${docName}" not found` }));
      return;
    }

    res.status(200)
      .setHeader('Content-Type', YAML_CONTENT_TYPE)
      .setHeader('Content-Disposition', `inline; filename="${docName}"`)
      .setHeader('X-Config-Document', docName)
      .send(yamlText);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500)
      .setHeader('Content-Type', 'application/json')
      .send(JSON.stringify({ error: 'Failed to load configuration' }));
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
    const reqDiagnostics = getReadableStreamDiagnostics(req);
    console.log('[api/config POST] Request diagnostics', reqDiagnostics);

    const { buffer, chunkCount, totalBytes, chunkDetails, unsupported } = await readRequestBody(req);
    let yamlText = buffer?.toString('utf8') || '';

    if (!yamlText && !unsupported) {
      console.warn('[api/config POST] Attempted upload with empty body', {
        contentLength: req.headers['content-length'],
        transferEncoding: req.headers['transfer-encoding'],
        chunkCount,
        totalBytes,
        chunkDetails
      });
      res.status(400)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ error: 'No content provided' }));
      return;
    } else if (!yamlText && unsupported) {
      console.warn('[api/config POST] Request stream unsupported, falling back to req.body');
    }

    if (!yamlText) {
      const fallback = req.body ?? req.rawBody;
      const fallbackType = fallback ? typeof fallback : 'undefined';
      if (typeof fallback === 'string') {
        yamlText = fallback;
      } else if (fallback && typeof Buffer !== 'undefined' && Buffer.isBuffer?.(fallback)) {
        yamlText = fallback.toString('utf8');
      }
      console.warn('[api/config POST] Fallback body inspection', {
        hasReqBody: Boolean(req.body),
        hasRawBody: Boolean(req.rawBody),
        fallbackType,
        derivedLength: yamlText.length,
        contentLength: req.headers['content-length'],
        transferEncoding: req.headers['transfer-encoding'],
        chunkCount,
        totalBytes,
        chunkDetails
      });
    }

    if (!yamlText) {
      res.status(400)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ error: 'No content provided' }));
      return;
    }

    const docName = getDocumentName(req);
    console.log('[api/config POST] Upload request received', {
      docName,
      bytes: yamlText.length,
      chunkCount,
      totalBytes,
      contentLength: req.headers['content-length'],
      transferEncoding: req.headers['transfer-encoding'],
      chunkDetails
    });

    const blob = await put(docName, yamlText, {
      access: 'public',
      token: blobToken,
      addRandomSuffix: false,
      contentType: YAML_CONTENT_TYPE
    });

    res.status(200)
      .setHeader('Content-Type', 'application/json')
      .send(JSON.stringify({
        success: true,
        document: docName,
        url: blob.url,
        size: yamlText.length
      }));

  } catch (error) {
    console.error('[api/config POST] Error saving config', { error });
    res.status(500)
      .setHeader('Content-Type', 'application/json')
      .send(JSON.stringify({ error: 'Failed to save configuration' }));
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
      res.status(400)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ error: 'Missing new document name' }));
      return;
    }

    const newDocName = sanitizeDocumentName(newDocParam);
    if (docName === newDocName) {
      res.status(400)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ error: 'New document name must be different' }));
      return;
    }

    const yamlText = await fetchDocumentFromBlob(docName, blobToken);
    if (!yamlText) {
      res.status(404)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ error: `Document "${docName}" not found` }));
      return;
    }

    await put(newDocName, yamlText, {
      access: 'public',
      token: blobToken,
      addRandomSuffix: false,
      contentType: YAML_CONTENT_TYPE
    });

    await del(docName, { token: blobToken });

    res.status(200)
      .setHeader('Content-Type', 'application/json')
      .send(JSON.stringify({
        success: true,
        document: newDocName,
        previous: docName
      }));

  } catch (error) {
    console.error('Error renaming config:', error);
    res.status(500)
      .setHeader('Content-Type', 'application/json')
      .send(JSON.stringify({ error: 'Failed to rename configuration' }));
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
      res.status(400)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ error: 'Missing document name' }));
      return;
    }

    const docName = sanitizeDocumentName(docParam);

    // Check if document exists
    const exists = await fetchDocumentFromBlob(docName, blobToken);
    if (!exists) {
      res.status(404)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ error: `Document "${docName}" not found` }));
      return;
    }

    // Delete from Blob Storage
    await del(docName, { token: blobToken });

    res.status(200)
      .setHeader('Content-Type', 'application/json')
      .send(JSON.stringify({
        success: true,
        deleted: docName
      }));

  } catch (error) {
    console.error('Error deleting config:', error);
    res.status(500)
      .setHeader('Content-Type', 'application/json')
      .send(JSON.stringify({ error: 'Failed to delete configuration' }));
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
