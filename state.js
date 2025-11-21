// Shared application state and low-level utilities
export const state = {
    configData: null,
    dynamicStyleElement: null,
    currentDocumentName: null,
    availableDocuments: [],
    documentListLoaded: false,
    agentModalViewMode: 'form',
    groupModalViewMode: 'form',
    agentModalOriginal: null,
    groupModalOriginal: null,
    documentMenuBound: false,
    collapsedSections: {}
};

export const DEFAULT_DOCUMENT_NAME = 'config.yaml';
export const DOCUMENT_STORAGE_KEY = 'tps-active-config-doc';
export const COLLAPSED_SECTIONS_KEY = 'tps-collapsed-sections';

export const BLANK_DOCUMENT_TEMPLATE = [
    '# TPS Agent Ecosystem configuration',
    'sectionDefaults:',
    '  iconType: target',
    '  showInFlow: true',
    '  isSupport: false',
    'agentGroups: []',
    ''
].join('\n');

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
    return { ...defaultAgentMetrics, ...(agent.metrics || {}) };
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
        if (stored) {
            state.collapsedSections = JSON.parse(stored);
        } else {
            state.collapsedSections = {};
        }
    } catch (error) {
        console.warn('Unable to read collapsed sections:', error);
        state.collapsedSections = {};
    }
}

export function saveCollapsedState() {
    try {
        localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(state.collapsedSections));
    } catch (error) {
        console.warn('Unable to save collapsed sections:', error);
    }
}
