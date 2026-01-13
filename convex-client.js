/**
 * Convex client adapter for AgentCanvas
 * Handles Convex connection, subscriptions, and mutations
 */

import { ConvexClient } from "convex/browser";
import { state } from "./state.js";

let client = null;
const subscriptions = new Map();

/**
 * Initialize the Convex client
 * @param {string} url - Convex deployment URL
 * @returns {ConvexClient}
 */
export function initConvexClient(url) {
  if (client) return client;

  const convexUrl = url || window.CONVEX_URL;
  if (!convexUrl) throw new Error("CONVEX_URL not configured");

  client = new ConvexClient(convexUrl);
  return client;
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
  await requireClient().mutation("canvases:remove", { canvasId });
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
