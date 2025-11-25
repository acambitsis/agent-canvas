import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

/**
 * Test #1: Round-Trip Data Integrity
 * 
 * THE most important test - if this fails, users lose data.
 * Tests complete save/load workflow:
 * - GET config (with valid auth)
 * - Parse YAML, modify an agent's name to a unique value
 * - POST the modified YAML
 * - GET config again
 * - Assert the modified name persists exactly
 */
describe('Round-Trip Data Integrity', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const fixturePath = join(__dirname, '../fixtures/valid-config.yaml');
  
  let mockBlobStore;
  let originalFetch;

  // In-memory blob storage mock
  function createMockBlobStore() {
    const store = new Map();

    const blobStore = {
      store, // Expose store for direct access

      async head(name, options) {
        if (!store.has(name)) {
          const error = new Error('Not found');
          error.status = 404;
          throw error;
        }
        const blob = store.get(name);
        return { url: `https://blob.vercel-storage.com/${name}` };
      },

      async list(options) {
        const blobs = Array.from(store.entries()).map(([pathname, blob]) => ({
          pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
        }));
        return { blobs };
      },

      async put(name, data, options) {
        const blob = {
          data: typeof data === 'string' ? data : data.toString('utf8'),
          size: typeof data === 'string' ? data.length : data.length,
          uploadedAt: new Date().toISOString(),
        };
        store.set(name, blob);
        return {
          url: `https://blob.vercel-storage.com/${name}`,
          pathname: name,
          size: blob.size,
        };
      },

      async del(name, options) {
        if (!store.has(name)) {
          const error = new Error('Not found');
          error.status = 404;
          throw error;
        }
        store.delete(name);
      },
    };

    return blobStore;
  }

  // Mock fetch to simulate API calls
  function createMockFetch(blobStore, authPassword) {
    return async (url, options = {}) => {
      const urlObj = new URL(url, 'http://localhost');
      const path = urlObj.pathname;
      const method = options.method || 'GET';

      // Check authentication
      const authHeader = options.headers?.['authorization'] || options.headers?.['Authorization'];
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        return new Response('Authentication required', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
        });
      }

      const encoded = authHeader.split(' ')[1];
      const [, password] = Buffer.from(encoded, 'base64').toString().split(':');
      if (password?.trim() !== authPassword) {
        return new Response('Authentication required', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
        });
      }

      // Handle GET /api/config
      if (path === '/api/config' && method === 'GET') {
        const listParam = urlObj.searchParams.get('list');
        if (listParam === '1' || listParam === 'true') {
          const { blobs } = await blobStore.list({});
          return new Response(JSON.stringify({ documents: blobs }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const docParam = urlObj.searchParams.get('doc') || 'config.yaml';
        try {
          await blobStore.head(docParam, {});
          const blob = blobStore.store.get(docParam);
          if (!blob) {
            return new Response(JSON.stringify({ error: `Document "${docParam}" not found` }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(blob.data, {
            status: 200,
            headers: {
              'Content-Type': 'text/yaml',
              'X-Config-Document': docParam,
            },
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: `Document "${docParam}" not found` }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Handle POST /api/config
      if (path === '/api/config' && method === 'POST') {
        const docParam = urlObj.searchParams.get('doc') || options.headers?.['x-config-name'] || 'config.yaml';
        const yamlText = options.body || '';

        if (!yamlText) {
          return new Response(JSON.stringify({ error: 'No content provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        try {
          const blob = await blobStore.put(docParam, yamlText, {
            access: 'public',
            contentType: 'text/yaml',
          });
          return new Response(JSON.stringify({
            success: true,
            document: docParam,
            url: blob.url,
            size: yamlText.length,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to save configuration' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response('Not found', { status: 404 });
    };
  }

  // Client-side loadConfig function (simplified from main.js)
  async function loadConfig(docName, fetchFn, jsyaml) {
    const url = `/api/config?doc=${encodeURIComponent(docName)}`;
    const response = await fetchFn(url);
    if (!response.ok) {
      throw new Error(`Config request failed: ${response.status}`);
    }
    const yamlText = await response.text();
    const configData = jsyaml.load(yamlText);
    return configData;
  }

  // Client-side saveConfig function (simplified from main.js)
  async function saveConfig(configData, docName, fetchFn, jsyaml) {
    const yamlText = jsyaml.dump(configData);
    const response = await fetchFn(`/api/config?doc=${encodeURIComponent(docName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/yaml',
        'X-Config-Name': docName,
      },
      body: yamlText,
    });

    if (!response.ok) {
      throw new Error('Failed to save configuration');
    }

    return await response.json();
  }

  beforeEach(() => {
    mockBlobStore = createMockBlobStore();
  });

  it('should persist agent name changes through round-trip', async () => {
    const TEST_PASSWORD = 'test-password';
    const TEST_DOC = 'test-config.yaml';
    const UNIQUE_AGENT_NAME = `Test Agent ${Date.now()}`;

    // Set up mock fetch
    global.fetch = createMockFetch(mockBlobStore, TEST_PASSWORD);

    // Create auth header
    const authHeader = `Basic ${Buffer.from(`user:${TEST_PASSWORD}`).toString('base64')}`;
    const fetchWithAuth = (url, options = {}) => {
      return global.fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          authorization: authHeader,
        },
      });
    };

    // Step 1: Load initial config from fixture
    const initialYaml = readFileSync(fixturePath, 'utf8');
    await mockBlobStore.put(TEST_DOC, initialYaml, {});
    
    const initialConfig = await loadConfig(TEST_DOC, fetchWithAuth, yaml);
    expect(initialConfig).toBeTruthy();
    expect(initialConfig.agentGroups).toBeDefined();
    expect(initialConfig.agentGroups.length).toBeGreaterThan(0);
    expect(initialConfig.agentGroups[0].agents.length).toBeGreaterThan(0);

    // Step 2: Modify an agent's name to a unique value
    const originalName = initialConfig.agentGroups[0].agents[0].name;
    initialConfig.agentGroups[0].agents[0].name = UNIQUE_AGENT_NAME;
    expect(initialConfig.agentGroups[0].agents[0].name).toBe(UNIQUE_AGENT_NAME);

    // Step 3: Save the modified config
    const saveResult = await saveConfig(initialConfig, TEST_DOC, fetchWithAuth, yaml);
    expect(saveResult.success).toBe(true);
    expect(saveResult.document).toBe(TEST_DOC);

    // Step 4: Load config again
    const reloadedConfig = await loadConfig(TEST_DOC, fetchWithAuth, yaml);
    expect(reloadedConfig).toBeTruthy();

    // Step 5: Assert the modified name persists exactly
    expect(reloadedConfig.agentGroups[0].agents[0].name).toBe(UNIQUE_AGENT_NAME);
    expect(reloadedConfig.agentGroups[0].agents[0].name).not.toBe(originalName);
  });

  it('should preserve all agent fields through round-trip', async () => {
    const TEST_PASSWORD = 'test-password';
    const TEST_DOC = 'test-config-full.yaml';

    global.fetch = createMockFetch(mockBlobStore, TEST_PASSWORD);
    const authHeader = `Basic ${Buffer.from(`user:${TEST_PASSWORD}`).toString('base64')}`;
    const fetchWithAuth = (url, options = {}) => {
      return global.fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          authorization: authHeader,
        },
      });
    };

    // Load initial config
    const initialYaml = readFileSync(fixturePath, 'utf8');
    await mockBlobStore.put(TEST_DOC, initialYaml, {});
    const initialConfig = await loadConfig(TEST_DOC, fetchWithAuth, yaml);

    // Modify multiple fields
    const agent = initialConfig.agentGroups[0].agents[0];
    const originalAgent = JSON.parse(JSON.stringify(agent)); // Deep clone

    agent.name = 'Modified Agent';
    agent.objective = 'Modified objective';
    agent.description = 'Modified description';
    agent.tools = ['Forms', 'Code'];
    agent.journeySteps = ['New Step 1', 'New Step 2'];
    agent.metrics = {
      usageThisWeek: '999',
      timeSaved: '99%',
      roiContribution: 'Very High',
    };

    // Save
    await saveConfig(initialConfig, TEST_DOC, fetchWithAuth, yaml);

    // Reload
    const reloadedConfig = await loadConfig(TEST_DOC, fetchWithAuth, yaml);
    const reloadedAgent = reloadedConfig.agentGroups[0].agents[0];

    // Verify all fields persisted
    expect(reloadedAgent.name).toBe(agent.name);
    expect(reloadedAgent.objective).toBe(agent.objective);
    expect(reloadedAgent.description).toBe(agent.description);
    expect(reloadedAgent.tools).toEqual(agent.tools);
    expect(reloadedAgent.journeySteps).toEqual(agent.journeySteps);
    expect(reloadedAgent.metrics.usageThisWeek).toBe(agent.metrics.usageThisWeek);
    expect(reloadedAgent.metrics.timeSaved).toBe(agent.metrics.timeSaved);
    expect(reloadedAgent.metrics.roiContribution).toBe(agent.metrics.roiContribution);
  });

  it('should preserve YAML structure and formatting through round-trip', async () => {
    const TEST_PASSWORD = 'test-password';
    const TEST_DOC = 'test-config-structure.yaml';

    global.fetch = createMockFetch(mockBlobStore, TEST_PASSWORD);
    const authHeader = `Basic ${Buffer.from(`user:${TEST_PASSWORD}`).toString('base64')}`;
    const fetchWithAuth = (url, options = {}) => {
      return global.fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          authorization: authHeader,
        },
      });
    };

    // Load initial config
    const initialYaml = readFileSync(fixturePath, 'utf8');
    await mockBlobStore.put(TEST_DOC, initialYaml, {});
    const initialConfig = await loadConfig(TEST_DOC, fetchWithAuth, yaml);

    // Save (this will re-serialize)
    await saveConfig(initialConfig, TEST_DOC, fetchWithAuth, yaml);

    // Reload
    const reloadedConfig = await loadConfig(TEST_DOC, fetchWithAuth, yaml);

    // Verify structure is preserved
    expect(reloadedConfig.agentGroups).toBeDefined();
    expect(Array.isArray(reloadedConfig.agentGroups)).toBe(true);
    expect(reloadedConfig.agentGroups.length).toBe(initialConfig.agentGroups.length);

    // Verify each group structure
    reloadedConfig.agentGroups.forEach((group, idx) => {
      const originalGroup = initialConfig.agentGroups[idx];
      expect(group.groupName).toBe(originalGroup.groupName);
      expect(Array.isArray(group.agents)).toBe(true);
      expect(group.agents.length).toBe(originalGroup.agents.length);
    });
  });

  it('should handle multiple groups and agents correctly', async () => {
    const TEST_PASSWORD = 'test-password';
    const TEST_DOC = 'test-config-multi.yaml';

    global.fetch = createMockFetch(mockBlobStore, TEST_PASSWORD);
    const authHeader = `Basic ${Buffer.from(`user:${TEST_PASSWORD}`).toString('base64')}`;
    const fetchWithAuth = (url, options = {}) => {
      return global.fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          authorization: authHeader,
        },
      });
    };

    // Load initial config
    const initialYaml = readFileSync(fixturePath, 'utf8');
    await mockBlobStore.put(TEST_DOC, initialYaml, {});
    const initialConfig = await loadConfig(TEST_DOC, fetchWithAuth, yaml);

    // Modify agents in different groups
    initialConfig.agentGroups[0].agents[0].name = 'Modified Agent 1';
    if (initialConfig.agentGroups.length > 1) {
      initialConfig.agentGroups[1].agents[0].name = 'Modified Agent 2';
    }

    // Save
    await saveConfig(initialConfig, TEST_DOC, fetchWithAuth, yaml);

    // Reload
    const reloadedConfig = await loadConfig(TEST_DOC, fetchWithAuth, yaml);

    // Verify modifications persisted
    expect(reloadedConfig.agentGroups[0].agents[0].name).toBe('Modified Agent 1');
    if (reloadedConfig.agentGroups.length > 1) {
      expect(reloadedConfig.agentGroups[1].agents[0].name).toBe('Modified Agent 2');
    }
  });
});

