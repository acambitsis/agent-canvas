/**
 * Convex client adapter for AgentCanvas
 * Handles Convex connection, subscriptions, and mutations
 */

import { ConvexClient } from "convex/browser";
import { state } from "./state.js";

let client = null;
const subscriptions = new Map();
let getIdTokenFn = null; // Function to get current id_token (JWT)

/**
 * Create auth callback function from token getter
 * @param {Function} getIdToken - Function that returns the current WorkOS id_token (JWT)
 * @returns {Function|null} Auth callback or null if no getter provided
 */
function createAuthCallback(getIdToken) {
  if (!getIdToken) return null;
  return async () => {
    const token = getIdToken();
    if (!token) {
      throw new Error("No authentication token available");
    }
    return token;
  };
}

/**
 * Initialize the Convex client
 * @param {string} url - Convex deployment URL
 * @param {Function} getIdToken - Function that returns the current WorkOS id_token (JWT)
 * @returns {ConvexClient}
 */
export function initConvexClient(url, getIdToken) {
  if (client && getIdTokenFn === getIdToken) return client;

  const convexUrl = url || window.CONVEX_URL;
  if (!convexUrl) {
    throw new Error(
      "CONVEX_URL not configured. Please set VITE_CONVEX_URL environment variable " +
      "in your Vercel project settings or inject window.CONVEX_URL at build time."
    );
  }

  client = new ConvexClient(convexUrl);
  getIdTokenFn = getIdToken;
  client.setAuth(createAuthCallback(getIdToken));

  return client;
}

/**
 * Update Convex authentication with a new id_token getter
 * @param {Function|null} getIdToken - Function that returns the current WorkOS id_token (JWT), or null to clear auth
 */
export function updateConvexAuth(getIdToken) {
  if (!client) return;

  getIdTokenFn = getIdToken;
  if (getIdToken) {
    client.setAuth(createAuthCallback(getIdToken));
  } else {
    // Clear auth by passing null
    client.setAuth(null);
  }
}

/**
 * Get the Convex client instance
 * @returns {ConvexClient|null}
 */
export function getConvexClient() {
  return client;
}

// Helper to manage subscriptions with automatic cleanup
function subscribe(key, path, args, stateKey, callback) {
  if (!client) {
    console.error("Convex client not initialized");
    return () => {};
  }

  // Unsubscribe from existing subscription
  if (subscriptions.has(key)) {
    subscriptions.get(key)();
  }

  const unsubscribe = client.onUpdate({ path, args }, (data) => {
    if (stateKey) state[stateKey] = data || (Array.isArray(state[stateKey]) ? [] : null);
    callback(data);
  });

  subscriptions.set(key, unsubscribe);
  return unsubscribe;
}

/**
 * Subscribe to canvases for the current org
 */
export function subscribeToCanvases(workosOrgId, callback) {
  return subscribe(
    `canvases:${workosOrgId}`,
    "canvases:list",
    { workosOrgId },
    "canvases",
    callback
  );
}

/**
 * Subscribe to agents for a canvas
 */
export function subscribeToAgents(canvasId, callback) {
  return subscribe(
    `agents:${canvasId}`,
    "agents:list",
    { canvasId },
    "agents",
    callback
  );
}

/**
 * Subscribe to org settings
 */
export function subscribeToOrgSettings(workosOrgId, callback) {
  return subscribe(
    `orgSettings:${workosOrgId}`,
    "orgSettings:get",
    { workosOrgId },
    "orgSettings",
    callback
  );
}

/**
 * Unsubscribe from all subscriptions
 */
export function unsubscribeAll() {
  for (const unsubscribe of subscriptions.values()) {
    unsubscribe();
  }
  subscriptions.clear();
}

// Mutation/query helper
function requireClient() {
  if (!client) throw new Error("Convex client not initialized");
  return client;
}

// Canvas mutations

export async function createCanvas(data) {
  return requireClient().mutation("canvases:create", {
    workosOrgId: data.workosOrgId || state.currentOrgId,
    title: data.title,
    slug: data.slug,
  });
}

export async function updateCanvas(canvasId, data) {
  await requireClient().mutation("canvases:update", { canvasId, ...data });
}

export async function deleteCanvas(canvasId) {
  // User has already confirmed deletion in UI, so always pass confirmDelete: true
  await requireClient().mutation("canvases:remove", { canvasId, confirmDelete: true });
}

// Agent mutations

export async function createAgent(data) {
  return requireClient().mutation("agents:create", {
    canvasId: data.canvasId || state.currentCanvasId,
    phase: data.phase,
    phaseOrder: data.phaseOrder || 0,
    agentOrder: data.agentOrder || 0,
    name: data.name,
    objective: data.objective,
    description: data.description,
    tools: data.tools || [],
    journeySteps: data.journeySteps || [],
    demoLink: data.demoLink,
    videoLink: data.videoLink,
    metrics: data.metrics,
  });
}

export async function updateAgent(agentId, data) {
  await requireClient().mutation("agents:update", { agentId, ...data });
}

export async function deleteAgent(agentId) {
  await requireClient().mutation("agents:remove", { agentId });
}

export async function reorderAgent(agentId, phase, phaseOrder, agentOrder) {
  await requireClient().mutation("agents:reorder", { agentId, phase, phaseOrder, agentOrder });
}

export async function bulkCreateAgents(canvasId, agents) {
  return requireClient().mutation("agents:bulkCreate", { canvasId, agents });
}

// Org settings mutations

export async function updateOrgSettings(workosOrgId, data) {
  await requireClient().mutation("orgSettings:update", { workosOrgId, ...data });
}

export async function initOrgSettings(workosOrgId) {
  await requireClient().mutation("orgSettings:initDefaults", { workosOrgId });
}

// User org membership sync

/**
 * Sync user's org memberships to Convex
 * SECURITY: This calls an action that verifies memberships server-side with WorkOS API
 */
export async function syncOrgMemberships() {
  await requireClient().action("users:syncOrgMemberships", {});
}

// Query helpers

export async function getCanvasBySlug(workosOrgId, slug) {
  return requireClient().query("canvases:getBySlug", { workosOrgId, slug });
}

export async function getAgentHistory(agentId) {
  return requireClient().query("agentHistory:list", { agentId });
}

export async function getRecentHistory(workosOrgId, limit = 50) {
  return requireClient().query("agentHistory:listRecent", { workosOrgId, limit });
}

// Document operations (replacing /api/config)

/**
 * List all documents (canvases) for an org
 */
export async function listDocuments(workosOrgId) {
  return requireClient().query("canvases:list", { workosOrgId });
}

/**
 * Get a document (canvas) by slug
 */
export async function getDocument(workosOrgId, slug) {
  return requireClient().query("canvases:getBySlug", { workosOrgId, slug });
}

/**
 * Create or update a document (canvas)
 */
export async function saveDocument(workosOrgId, slug, title, sourceYaml) {
  // Try to get existing canvas
  const existing = await requireClient().query("canvases:getBySlug", { workosOrgId, slug });
  
  if (existing) {
    // Update existing
    await requireClient().mutation("canvases:update", {
      canvasId: existing._id,
      title,
      sourceYaml,
    });
    return existing._id;
  } else {
    // Create new
    return await requireClient().mutation("canvases:create", {
      workosOrgId,
      title: title || slug,
      slug,
      sourceYaml,
    });
  }
}

/**
 * Delete a document (canvas)
 */
export async function deleteDocument(workosOrgId, slug) {
  const canvas = await requireClient().query("canvases:getBySlug", { workosOrgId, slug });
  if (!canvas) {
    throw new Error("Document not found");
  }
  // User has already confirmed deletion in UI, so always pass confirmDelete: true
  await requireClient().mutation("canvases:remove", { canvasId: canvas._id, confirmDelete: true });
}

/**
 * Rename a document (canvas)
 */
export async function renameDocument(workosOrgId, oldSlug, newSlug) {
  const canvas = await requireClient().query("canvases:getBySlug", { workosOrgId, oldSlug });
  if (!canvas) {
    throw new Error("Document not found");
  }
  await requireClient().mutation("canvases:update", {
    canvasId: canvas._id,
    slug: newSlug,
  });
}
