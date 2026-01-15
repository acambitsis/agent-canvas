// Shared application state and low-level utilities
export const state = {
    // Auth state
    user: null,
    isAuthenticated: false,

    // Organization state (from WorkOS)
    currentOrgId: null,
    userOrgs: [],

    // Canvas state (Convex)
    currentCanvasId: null,
    currentCanvas: null,
    canvases: [],

    // Agent state (Convex) - replaces configData.agentGroups
    agents: [],

    // Org settings (Convex)
    orgSettings: null,

    // Legacy - kept for backward compatibility during migration
    dynamicStyleElement: null,
    availableDocuments: [],
    canvasListLoaded: false,

    // Modal state
    agentModalViewMode: 'form',
    groupModalViewMode: 'form',
    agentModalOriginal: null,
    groupModalOriginal: null,
    documentMenuBound: false,
    collapsedSections: {},

    // Grouping and filtering state
    grouping: {
        activeTagType: 'phase',  // Currently selected grouping tag
        sortOrder: 'asc',        // Group sort order
        filters: {},             // Active filters: { tagType: [values] }
        searchQuery: ''          // Search filter
    },

    // Computed groups cache (result of grouping computation)
    computedGroups: []
};

export const COLLAPSED_SECTIONS_KEY = 'agentcanvas-collapsed-sections';
export const CURRENT_ORG_KEY = 'agentcanvas-current-org';
export const CURRENT_CANVAS_KEY = 'agentcanvas-current-canvas';
export const GROUPING_PREFERENCE_KEY = 'agentcanvas-grouping-pref';

const defaultAgentMetrics = {
    usageThisWeek: '0',
    timeSaved: '0',
    roiContribution: 'Medium'
};

const COLLAPSED_PILL_CLASSES = [
    'pill-palette-0',
    'pill-palette-1',
    'pill-palette-2',
    'pill-palette-3',
    'pill-palette-4'
];

export function getAgentMetrics(agent = {}) {
    const metrics = agent?.metrics || {};

    // Convex-native numeric metrics: { adoption, satisfaction }
    // ROI contribution is now a first-class field
    return {
        ...defaultAgentMetrics,
        usageThisWeek: String(metrics.adoption ?? defaultAgentMetrics.usageThisWeek),
        timeSaved: String(metrics.satisfaction ?? defaultAgentMetrics.timeSaved),
        roiContribution: agent.roiContribution || defaultAgentMetrics.roiContribution
    };
}

export function toArray(value) {
    return Array.isArray(value) ? value : [];
}

export function deepClone(value) {
    if (value === null || value === undefined) {
        return value;
    }
    try {
        return structuredClone(value);
    } catch {
        return JSON.parse(JSON.stringify(value));
    }
}

export function slugifyIdentifier(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');
}


export function getCollapsedPillClass(index) {
    return COLLAPSED_PILL_CLASSES[index % COLLAPSED_PILL_CLASSES.length];
}

export function refreshIcons() {
    if (typeof lucide === 'undefined') {
        return;
    }
    try {
        lucide.createIcons();
    } catch (error) {
        console.warn('Lucide icon refresh failed:', error);
    }
}


export function loadCollapsedState() {
    try {
        const stored = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
        state.collapsedSections = stored ? JSON.parse(stored) : {};
    } catch {
        state.collapsedSections = {};
    }
}

export function saveCollapsedState() {
    try {
        localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(state.collapsedSections));
    } catch { /* ignore */ }
}

// LocalStorage helpers with fallback
function getStoredValue(key) {
    try {
        return localStorage.getItem(key) || null;
    } catch {
        return null;
    }
}

function setStoredValue(key, value) {
    try {
        if (value) {
            localStorage.setItem(key, value);
        } else {
            localStorage.removeItem(key);
        }
    } catch { /* ignore */ }
}

// Organization preference helpers
export function loadOrgPreference() {
    return getStoredValue(CURRENT_ORG_KEY);
}

export function saveOrgPreference(orgId) {
    setStoredValue(CURRENT_ORG_KEY, orgId);
    state.currentOrgId = orgId;
}

// Organization state management (single source of truth)
export function getCurrentOrgId() {
    return state.currentOrgId;
}

export function getUserOrgs() {
    return state.userOrgs || [];
}

export function setUserOrgs(orgs) {
    state.userOrgs = orgs || [];
}

export function setCurrentOrgId(orgId) {
    saveOrgPreference(orgId); // This sets state.currentOrgId and persists to localStorage
    window.dispatchEvent(new CustomEvent('orgChanged', { detail: { orgId } }));
}

export function getCurrentOrg() {
    const orgId = getCurrentOrgId();
    if (!orgId) {
        return getUserOrgs()[0] || null;
    }
    return getUserOrgs().find(org => org.id === orgId) || getUserOrgs()[0] || null;
}

export function isSuperAdmin() {
    return getUserOrgs().some(org => org.role === 'super_admin');
}

export function getCurrentOrgRole() {
    if (isSuperAdmin()) return 'admin';
    const org = getCurrentOrg();
    return org?.role || 'viewer';
}

export function canManageCanvases() {
    if (isSuperAdmin()) return true;
    const org = getCurrentOrg();
    return org?.role === 'admin';
}

// Canvas preference helpers
export function loadCanvasPreference() {
    return getStoredValue(CURRENT_CANVAS_KEY);
}

export function saveCanvasPreference(canvasId) {
    setStoredValue(CURRENT_CANVAS_KEY, canvasId);
    state.currentCanvasId = canvasId;
}


// Grouping preference helpers
export function loadGroupingPreference() {
    try {
        const stored = localStorage.getItem(GROUPING_PREFERENCE_KEY);
        if (stored) {
            const pref = JSON.parse(stored);
            state.grouping = { ...state.grouping, ...pref };
        }
    } catch { /* ignore */ }
    return state.grouping;
}

export function saveGroupingPreference() {
    try {
        localStorage.setItem(GROUPING_PREFERENCE_KEY, JSON.stringify(state.grouping));
    } catch { /* ignore */ }
}

export function setGroupingTagType(tagType) {
    state.grouping.activeTagType = tagType;
    saveGroupingPreference();
    window.dispatchEvent(new CustomEvent('groupingChanged', { detail: { tagType } }));
}

export function getGroupingTagType() {
    return state.grouping.activeTagType || 'phase';
}

export function setGroupingFilter(tagType, values) {
    if (!values || values.length === 0) {
        delete state.grouping.filters[tagType];
    } else {
        state.grouping.filters[tagType] = values;
    }
    saveGroupingPreference();
    window.dispatchEvent(new CustomEvent('filterChanged', { detail: { tagType, values } }));
}

export function clearGroupingFilters() {
    state.grouping.filters = {};
    state.grouping.searchQuery = '';
    saveGroupingPreference();
    window.dispatchEvent(new CustomEvent('filterChanged', { detail: {} }));
}

export function setSearchQuery(query) {
    state.grouping.searchQuery = query;
    window.dispatchEvent(new CustomEvent('searchChanged', { detail: { query } }));
}
