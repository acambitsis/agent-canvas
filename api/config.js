import { head } from '@vercel/blob';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const CONFIG_BLOB_PATH = 'config.yaml';

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

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    try {
      const [, pwd] = Buffer.from(authValue, 'base64').toString().split(':');
      if (pwd === expectedPassword) {
        return true;
      }
    } catch (e) {
      // Invalid auth header format
    }
  }

  res.status(401).setHeader('WWW-Authenticate', 'Basic realm="Secure Area"').send('Authentication required');
  return false;
}

/**
 * GET handler
 * Fetches config from Blob Storage or static file
 */
async function handleGet(req, res) {
  try {
    // For local development (not on Vercel), use static file
    // In production on Vercel, use Blob Storage
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (isProduction && blobToken) {
      try {
        console.log('Attempting to fetch from Blob Storage...');

        const { url } = await head(CONFIG_BLOB_PATH, {
          token: blobToken
        });

        if (url) {
          console.log('Blob found, fetching content...');
          const blobResponse = await fetch(url);
          const yamlText = await blobResponse.text();
          console.log('Blob content fetched successfully');

          res.status(200)
            .setHeader('Content-Type', 'text/yaml')
            .setHeader('X-Config-Source', 'blob-storage')
            .send(yamlText);
          return;
        }
      } catch (blobError) {
        console.log('Blob error, falling back to static file:', blobError.message);
      }
    } else {
      console.log('Local development mode - using static file');
    }

    // Fallback to static file from filesystem
    console.log('Loading from static file...');
    const configPath = join(process.cwd(), 'data', 'config.yaml');
    const yamlText = await readFile(configPath, 'utf8');
    console.log('Static file loaded successfully');

    res.status(200)
      .setHeader('Content-Type', 'text/yaml')
      .setHeader('X-Config-Source', 'static-file')
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
 * Saves config to Blob Storage or local file
 */
async function handlePost(req, res) {
  try {
    // Get YAML content from request body
    let yamlText = '';

    // Collect body data
    for await (const chunk of req) {
      yamlText += chunk;
    }

    if (!yamlText) {
      res.status(400)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({ error: 'No content provided' }));
      return;
    }

    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (isProduction && blobToken) {
      // Production: Save to Blob Storage
      const { put } = await import('@vercel/blob');
      const blob = await put(CONFIG_BLOB_PATH, yamlText, {
        access: 'public',
        token: blobToken,
        addRandomSuffix: false,
        contentType: 'text/yaml'
      });

      res.status(200)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({
          success: true,
          url: blob.url,
          size: yamlText.length,
          environment: 'production'
        }));
    } else {
      // Local development: Save to local filesystem
      const configPath = join(process.cwd(), 'data', 'config.yaml');
      await writeFile(configPath, yamlText, 'utf8');

      res.status(200)
        .setHeader('Content-Type', 'application/json')
        .send(JSON.stringify({
          success: true,
          path: configPath,
          size: yamlText.length,
          environment: 'local'
        }));
    }

  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500)
      .setHeader('Content-Type', 'application/json')
      .send(JSON.stringify({ error: 'Failed to save configuration' }));
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
  } else {
    res.status(405).send('Method not allowed');
  }
}
