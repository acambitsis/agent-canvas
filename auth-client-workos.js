/**
 * WorkOS AuthKit authentication client
 * Handles user authentication via WorkOS
 */

let currentUser = null;
let currentOrgs = [];
let currentIdToken = null; // WorkOS id_token (JWT) for Convex authentication
let isInitialized = false;
let refreshPromise = null;

/**
 * Refresh the id_token if needed
 * @returns {Promise<{success: boolean, idToken: string|null}>} Refresh result with new idToken
 */
async function refreshTokenIfNeeded() {
  // Prevent concurrent refresh attempts
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", { method: "POST" });
      if (!response.ok) {
        return { success: false, idToken: null };
      }
      const data = await response.json();
      return { success: true, idToken: data.idToken || null };
    } catch (error) {
      console.error("Token refresh failed:", error);
      return { success: false, idToken: null };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

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
      currentIdToken = data.idToken || null; // Store id_token for Convex

      // Proactively refresh token if needed
      if (data.needsRefresh) {
        const refreshResult = await refreshTokenIfNeeded();
        if (refreshResult.success && refreshResult.idToken) {
          currentIdToken = refreshResult.idToken;
        }
      }

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
 * Get the current id_token for Convex authentication
 * @returns {string|null}
 */
export function getIdToken() {
  return currentIdToken;
}

/**
 * Clear all auth state (helper for signOut)
 */
function clearAuthState() {
  currentUser = null;
  currentOrgs = [];
  currentIdToken = null;
  isInitialized = false;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (error) {
    console.error("Sign out error:", error);
    // Continue with cleanup even if logout request fails
  } finally {
    // Always clear state and redirect
    clearAuthState();
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
 * Automatically attempts token refresh on 401 before redirecting
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, options = {}) {
  let response = await fetch(url, {
    ...options,
    credentials: 'include', // Ensure cookies are sent
  });

  // On 401, try refreshing the token once
  if (response.status === 401) {
    const refreshResult = await refreshTokenIfNeeded();
    if (refreshResult.success) {
      // Update idToken if provided
      if (refreshResult.idToken) {
        currentIdToken = refreshResult.idToken;
      }
      // Retry the original request
      response = await fetch(url, {
        ...options,
        credentials: 'include',
      });
    }

    // If still 401 after refresh attempt, redirect to login
    if (response.status === 401) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
  }

  return response;
}
