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
    configData: null,
    dynamicStyleElement: null,
    currentDocumentName: null,
    availableDocuments: [],
    documentListLoaded: false,

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
    const payloadMetrics = agent?.payload?.metrics || {};

    // Convex-native numeric metrics: { adoption, satisfaction }
    if (
        metrics &&
        typeof metrics === 'object' &&
        (typeof metrics.adoption === 'number' || typeof metrics.satisfaction === 'number')
    ) {
        return {
            ...defaultAgentMetrics,
            usageThisWeek: String(metrics.adoption ?? defaultAgentMetrics.usageThisWeek),
            timeSaved: String(metrics.satisfaction ?? defaultAgentMetrics.timeSaved),
            roiContribution: payloadMetrics.roiContribution || defaultAgentMetrics.roiContribution
        };
    }

    // Legacy/UI metrics shape: { usageThisWeek, timeSaved, roiContribution }
    return { ...defaultAgentMetrics, ...payloadMetrics, ...(metrics || {}) };
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

export function getGroupFormatting(group, field, config = state.configData) {
    const defaults = config?.sectionDefaults || {
        iconType: 'target',
        showInFlow: true,
        isSupport: false
    };

    return group[field] !== undefined ? group[field] : defaults[field];
}

export function getGroupClass(group) {
    if (group.groupClass) {
        return group.groupClass;
    }
    const groupId = group.groupId || slugifyIdentifier(group.groupName) || 'section';
    return `group-${groupId}`;
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

function getExistingGroupIdSet(config = state.configData, excludeIndex = -1) {
    if (!Array.isArray(config?.agentGroups)) {
        return new Set();
    }

    return new Set(
        config.agentGroups
            .map((group, index) => (index === excludeIndex ? null : (group?.groupId || null)))
            .filter(id => typeof id === 'string' && id.trim() !== '')
            .map(id => id.trim())
    );
}

export function generateGroupIdFromName(name, maybeExcludeIndex = -1, maybeConfig = state.configData) {
    let excludeIndex = maybeExcludeIndex;
    let config = maybeConfig;

    // Backward compatibility: allow passing (name, config, excludeIndex)
    if (typeof maybeExcludeIndex === 'object' && !Array.isArray(maybeExcludeIndex)) {
        config = maybeExcludeIndex;
        excludeIndex = typeof maybeConfig === 'number' ? maybeConfig : -1;
    }

    const fallbackBase = `section-${(config?.agentGroups?.length || 0) + 1}`;
    const baseId = slugifyIdentifier(name) || fallbackBase;
    const existingIds = getExistingGroupIdSet(config, excludeIndex);

    let candidate = baseId;
    let suffix = 2;
    while (!candidate || existingIds.has(candidate)) {
        candidate = `${baseId}-${suffix++}`;
    }

    return candidate;
}

export function ensureGroupHasId(group, groupIndex = -1, config = state.configData) {
    if (!group || typeof group !== 'object') {
        return group;
    }

    if (typeof group.groupId === 'string' && group.groupId.trim()) {
        group.groupId = group.groupId.trim();
        return group;
    }

    const fallbackName = group.groupName || `section-${Date.now()}`;
    group.groupId = generateGroupIdFromName(fallbackName, config, groupIndex);
    return group;
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

// Group agents by phase for rendering (legacy - use grouping.js for dynamic grouping)
export function groupAgentsByPhase(agents = state.agents) {
    const phases = new Map();

    for (const agent of agents) {
        const phase = agent.phase || 'Uncategorized';
        if (!phases.has(phase)) {
            phases.set(phase, {
                phase,
                phaseOrder: agent.phaseOrder || 0,
                agents: []
            });
        }
        phases.get(phase).agents.push(agent);
    }

    // Sort phases by phaseOrder
    const sortedPhases = Array.from(phases.values()).sort(
        (a, b) => a.phaseOrder - b.phaseOrder
    );

    // Sort agents within each phase by agentOrder
    for (const phaseGroup of sortedPhases) {
        phaseGroup.agents.sort((a, b) => (a.agentOrder || 0) - (b.agentOrder || 0));
    }

    return sortedPhases;
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
