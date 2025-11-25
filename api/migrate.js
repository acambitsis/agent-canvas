import { put } from '@vercel/blob';
import { readFileSync } from 'fs';
import { join } from 'path';

const CONFIG_BLOB_PATH = 'config.yaml';

/**
 * Get header value - works in both Edge and Node.js runtime
 */
function getHeader(request, name) {
  // Edge Runtime (production): request.headers is a Headers object
  if (request.headers && typeof request.headers.get === 'function') {
    return request.headers.get(name);
  }
  // Node.js Runtime (local dev): request.headers is a plain object
  if (request.headers && typeof request.headers === 'object') {
    return request.headers[name] || request.headers[name.toLowerCase()];
  }
  return null;
}

/**
 * Check HTTP Basic Authentication against BASIC_AUTH_PASSWORD env var
 */
function checkAuth(request) {
  const basicAuth = getHeader(request, 'authorization');
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD?.trim();

  if (!expectedPassword) {
    return { authorized: false, response: new Response('Server configuration error', { status: 500 }) };
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    try {
      const [, pwd] = atob(authValue).split(':');
      if (pwd?.trim() === expectedPassword) {
        return { authorized: true };
      }
    } catch (e) {
      // Invalid auth header format
    }
  }

  return {
    authorized: false,
    response: new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' }
    })
  };
}

/**
 * POST /api/migrate
 * One-time migration: copies static config.yaml to Blob Storage
 */
export async function POST(request) {
  // Check authentication
  const auth = checkAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (!blobToken) {
      return new Response(JSON.stringify({
        error: 'Blob storage not configured. Please set BLOB_READ_WRITE_TOKEN environment variable.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Read static config file from filesystem
    let yamlText;
    try {
      const configPath = join(process.cwd(), 'data', 'config.yaml');
      yamlText = readFileSync(configPath, 'utf8');
    } catch (error) {
      console.error('Error reading static config:', error);
      return new Response(JSON.stringify({ 
        error: 'Static config file not found',
        message: 'The data/config.yaml file no longer exists. Migration is no longer needed as the system now uses Blob Storage directly. If you need to create an initial configuration, use the POST /api/config endpoint instead.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Save to Blob Storage
    const blob = await put(CONFIG_BLOB_PATH, yamlText, {
      access: 'public',
      token: blobToken,
      addRandomSuffix: false,
      contentType: 'text/yaml'
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Static config migrated to Blob Storage successfully',
      blobUrl: blob.url,
      size: yamlText.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({
      error: 'Migration failed',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default async function handler(request) {
  if (request.method === 'POST') {
    return POST(request);
  } else {
    return new Response('Method not allowed. Use POST to migrate config.', { status: 405 });
  }
}
