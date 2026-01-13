/**
 * WorkOS AuthKit authentication client
 * Handles user authentication via WorkOS
 */

let currentUser = null;
let currentOrgs = [];
let isInitialized = false;

/**
 * Initialize authentication - check session and set up user
 * @returns {Promise<{authenticated: boolean, user: object|null}>}
 */
export async function initAuth() {
  if (isInitialized) {
    return { authenticated: !!currentUser, user: currentUser };
  }

  try {
    const response = await fetch("/api/auth/session");
    const data = await response.json();

    if (data.authenticated && data.user) {
      currentUser = data.user;
      currentOrgs = data.orgs || [];
      // Fetch additional org details if needed
      if (currentOrgs.length > 0 && !currentOrgs[0].name) {
        await fetchUserOrgs();
      }
    }

    isInitialized = true;
    return { authenticated: !!currentUser, user: currentUser };
  } catch (error) {
    console.error("Auth initialization error:", error);
    isInitialized = true;
    return { authenticated: false, user: null };
  }
}

/**
 * Fetch user's organizations from WorkOS
 */
async function fetchUserOrgs() {
  try {
    const response = await fetch("/api/auth/orgs");
    if (response.ok) {
      const data = await response.json();
      currentOrgs = data.organizations || [];
    }
  } catch (error) {
    console.error("Failed to fetch organizations:", error);
    currentOrgs = [];
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!currentUser;
}

/**
 * Get the current user
 * @returns {object|null}
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Get the current user's ID
 * @returns {string|null}
 */
export function getUserId() {
  return currentUser?.id || null;
}

/**
 * Get the current user's email
 * @returns {string|null}
 */
export function getUserEmail() {
  return currentUser?.email || null;
}

/**
 * Get the current user's display name
 * @returns {string}
 */
export function getUserName() {
  if (!currentUser) return "";
  const { firstName, lastName, email } = currentUser;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  return firstName || email || "";
}

/**
 * Get user's organizations
 * @returns {Array}
 */
export function getUserOrgs() {
  return currentOrgs;
}

/**
 * Initiate sign in via WorkOS
 * @param {object} options - Optional redirect options
 */
export async function signIn(options = {}) {
  try {
    const response = await fetch("/api/auth/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirectUri: options.redirectUri || window.location.origin + "/api/auth/callback",
      }),
    });

    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error("Failed to get auth URL");
    }
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
    currentUser = null;
    currentOrgs = [];
    isInitialized = false;
    window.location.href = "/login";
  } catch (error) {
    console.error("Sign out error:", error);
    // Force redirect even on error
    window.location.href = "/login";
  }
}

/**
 * Check if user has access to an organization
 * @param {string} orgId - WorkOS organization ID
 * @returns {boolean}
 */
export function hasOrgAccess(orgId) {
  return currentOrgs.some((org) => org.id === orgId);
}

/**
 * Get the current/selected organization
 * @returns {object|null}
 */
export function getCurrentOrg() {
  // Return the first org or a stored preference
  const storedOrgId = localStorage.getItem("agentcanvas-current-org");
  if (storedOrgId) {
    const org = currentOrgs.find((o) => o.id === storedOrgId);
    if (org) return org;
  }
  return currentOrgs[0] || null;
}

/**
 * Set the current organization
 * @param {string} orgId - WorkOS organization ID
 */
export function setCurrentOrg(orgId) {
  localStorage.setItem("agentcanvas-current-org", orgId);
  window.dispatchEvent(new CustomEvent("orgChanged", { detail: { orgId } }));
}

/**
 * Enhanced fetch wrapper that handles auth errors
 * With WorkOS, authentication uses session cookies (no Bearer token needed)
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Ensure cookies are sent
  });

  // Handle 401 by redirecting to login
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return response;
}

/**
 * Accept pending organization invites
 * With WorkOS, invites are handled through WorkOS AuthKit UI
 * This is a no-op for backward compatibility
 * @returns {Promise<{processed: number, groups: Array}>}
 */
export async function acceptPendingInvites() {
  // WorkOS handles invites through its own UI flow
  // This function is kept for backward compatibility
  return { processed: 0, groups: [] };
}
