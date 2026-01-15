import {
    getAvailableTools,
    getSectionColor
} from './config.js';
import {
    handleDocumentSelection,
    initializeDocumentControls,
    refreshDocumentList,
    registerLoadAgents,
    setActiveDocumentName,
    setDocumentStatusMessage
} from './documents.js';
import {
    copyTextToClipboard,
    setElementText
} from './modal-utils.js';
import { bindToggleMenu } from './menu-utils.js';
import {
    deepClone,
    DEFAULT_DOCUMENT_NAME,
    ensureGroupHasId,
    generateGroupIdFromName,
    getAgentMetrics,
    getCollapsedPillClass,
    getGroupClass,
    getGroupFormatting,
    loadCollapsedState,
    refreshIcons,
    saveCollapsedState,
    state,
    toArray,
    getCurrentOrgId,
    getUserOrgs as getUserOrgsFromState,
    setCurrentOrgId,
    getCurrentOrg,
    canManageCanvases,
    getCurrentOrgRole,
    loadGroupingPreference,
    setGroupingTagType,
    getGroupingTagType
} from './state.js';
import { initAuth, signOut, getCurrentUser, getUserName, getUserEmail, isAuthenticated, getIdToken } from './auth-client-workos.js';
import { initConvexClient, initConvexClientAsync, getConvexClient, updateConvexAuth, getDocument, syncOrgMemberships, unsubscribeAll } from './convex-client.js';
import { convexToYaml, yamlToConvexAgents } from './yaml-converter.js';
import { groupAgentsByTag, flattenAgentsFromConfig, filterAgents, searchAgents } from './grouping.js';
import { TAG_TYPES, getAgentTagDisplay, getToolDisplay } from './types/tags.js';

// Tag type to DOM container ID mapping
const TAG_SELECTOR_IDS = {
    department: 'agentDepartmentTags',
    status: 'agentStatusTags',
    implementationStatus: 'agentImplementationTags',
    priority: 'agentPriorityTags'
};

// ----- Tag selector helpers -----
function populateTagSelector(containerId, tagType, selectedValue) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const tagDef = TAG_TYPES[tagType];
    if (!tagDef?.values) {
        container.innerHTML = '<span class="text-muted">No options available</span>';
        return;
    }

    const optionsHTML = tagDef.values.map(option => {
        const isSelected = option.id === selectedValue;
        return `
            <button type="button"
                class="tag-select__option ${isSelected ? 'is-selected' : ''}"
                data-tag-type="${tagType}"
                data-tag-value="${option.id}"
                style="--tag-color: ${option.color}; --tag-bg: ${option.color}15; --tag-border: ${option.color}40;">
                ${option.label}
            </button>
        `;
    }).join('');

    // Add "None" option at the beginning
    const noneSelected = !selectedValue;
    container.innerHTML = `
        <button type="button"
            class="tag-select__option ${noneSelected ? 'is-selected' : ''}"
            data-tag-type="${tagType}"
            data-tag-value=""
            style="--tag-color: var(--text-muted);">
            None
        </button>
        ${optionsHTML}
    `;

    // Add click handlers
    container.querySelectorAll('.tag-select__option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove selected from all options in this container
            container.querySelectorAll('.tag-select__option').forEach(b => b.classList.remove('is-selected'));
            // Add selected to clicked option
            btn.classList.add('is-selected');
        });
    });
}

function getSelectedTagValue(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    const selected = container.querySelector('.tag-select__option.is-selected');
    return selected?.dataset.tagValue || null;
}

// Re-export for backward compatibility
export function getCurrentGroupId() {
    return getCurrentOrgId();
}

export function getUserGroups() {
    return getUserOrgsFromState();
}

export function canManageCanvasesInCurrentGroup() {
    return canManageCanvases();
}

async function initializeGroups() {
    const orgs = getUserOrgsFromState();

    // Render group switcher (simplified)
    renderGroupSwitcher();

    return orgs;
}

function renderGroupSwitcher() {
    const container = document.getElementById('groupSwitcherContainer');
    const orgs = getUserOrgsFromState();
    const currentOrgId = getCurrentOrgId();
    
    if (!container || orgs.length <= 1) return;

    container.innerHTML = `
        <select id="groupSelect" class="group-select">
            ${orgs.map(org => `
                <option value="${org.id}" ${org.id === currentOrgId ? 'selected' : ''}>
                    ${org.name || org.id}
                </option>
            `).join('')}
        </select>
    `;

    const select = container.querySelector('#groupSelect');
    select?.addEventListener('change', (e) => {
        setCurrentOrgId(e.target.value);
    });
}

// ----- Role-based UI visibility -----
function updateRoleBasedUI() {
    const canManage = canManageCanvasesInCurrentGroup();
    const role = getCurrentOrgRole();

    // Update board menu - hide admin-only actions for viewers
    const boardMenu = document.getElementById('board-menu');
    if (boardMenu) {
        const adminActions = ['edit-title', 'edit-full-yaml', 'add-section'];
        const displayValue = canManage ? '' : 'none';

        adminActions.forEach(action => {
            const btn = boardMenu.querySelector(`[data-board-action="${action}"]`);
            if (btn) btn.style.display = displayValue;
        });
    }

    // Set data attributes on body for CSS-based hiding
    document.body.dataset.userRole = role || 'viewer';
    document.body.dataset.canManage = canManage ? 'true' : 'false';
}

// ----- Loading overlay helpers -----
function showLoadingOverlay(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    if (overlay) {
        if (messageEl) messageEl.textContent = message;
        overlay.classList.add('show');
        refreshIcons();
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

// ----- State and utility helpers -----
function toggleSectionCollapse(groupId) {
    state.collapsedSections[groupId] = !state.collapsedSections[groupId];
    saveCollapsedState();

    const section = document.querySelector(`[data-group-id="${groupId}"]`);
    if (section) {
        section.classList.toggle('collapsed', state.collapsedSections[groupId]);
    }
    updateCollapseAllButton();
}

function collapseAll() {
    if (!state.configData?.agentGroups) return;
    state.configData.agentGroups.forEach(group => {
        state.collapsedSections[group.groupId] = true;
        const section = document.querySelector(`[data-group-id="${group.groupId}"]`);
        section?.classList.add('collapsed');
    });
    saveCollapsedState();
    updateCollapseAllButton();
}

function expandAll() {
    if (!state.configData?.agentGroups) return;
    state.configData.agentGroups.forEach(group => {
        state.collapsedSections[group.groupId] = false;
        const section = document.querySelector(`[data-group-id="${group.groupId}"]`);
        section?.classList.remove('collapsed');
    });
    saveCollapsedState();
    updateCollapseAllButton();
}

function toggleCollapseAll() {
    if (!state.configData?.agentGroups) return;
    const allCollapsed = state.configData.agentGroups.every(group => state.collapsedSections[group.groupId] === true);
    if (allCollapsed) {
        expandAll();
    } else {
        collapseAll();
    }
}

function updateCollapseAllButton() {
    if (!state.configData?.agentGroups || state.configData.agentGroups.length === 0) return;

    const btn = document.getElementById('collapseAllBtn');
    const text = document.getElementById('collapseAllText');
    const icon = document.getElementById('collapseAllIcon');

    if (!btn || !text || !icon) return;

    const allCollapsed = state.configData.agentGroups.every(group => state.collapsedSections[group.groupId] === true);
    text.textContent = allCollapsed ? 'Expand All' : 'Collapse All';
    icon.setAttribute('data-lucide', allCollapsed ? 'chevrons-up' : 'chevrons-down');
    refreshIcons();
}

// ----- Modal YAML view helpers -----
function updateAgentModalViewUI() {
    updateDualViewModalUI(modalViewConfigs.agent);
}

function updateGroupModalViewUI() {
    updateDualViewModalUI(modalViewConfigs.group);
}

function populateAgentFormFields(agent = {}) {
    document.getElementById('agentName').value = agent.name || '';
    document.getElementById('agentObjective').value = agent.objective || '';
    document.getElementById('agentDescription').value = agent.description || '';

    const toolsContainer = document.getElementById('agentTools');
    if (toolsContainer) {
        toolsContainer.innerHTML = '';
        const selectedTools = toArray(agent.tools);
        getAvailableTools().forEach(toolName => {
            const checked = selectedTools.includes(toolName) ? 'checked' : '';
            toolsContainer.innerHTML += `
                <label class="tool-checkbox-label">
                    <input type="checkbox" name="tools" value="${toolName}" ${checked}>
                    ${toolName}
                </label>
            `;
        });
    }

    // Populate journey steps textarea (one per line)
    const journeySteps = toArray(agent.journeySteps);
    document.getElementById('journeySteps').value = journeySteps.join('\n');

    const metrics = getAgentMetrics(agent);
    document.getElementById('metricsUsage').value = metrics.usageThisWeek || '';
    document.getElementById('metricsTimeSaved').value = metrics.timeSaved || '';

    // Populate tag selectors with clickable options
    const tags = agent.tags || {};
    for (const [tagType, containerId] of Object.entries(TAG_SELECTOR_IDS)) {
        populateTagSelector(containerId, tagType, tags[tagType]);
    }

    // Populate phase input if present
    const phaseInput = document.getElementById('agentPhase');
    if (phaseInput) phaseInput.value = agent.phase || '';

    refreshIcons();
}

function populateGroupFormFields(group = {}, options = {}) {
    const derivedIndex = typeof options.groupIndex === 'number'
        ? options.groupIndex
        : parseInt(document.getElementById('groupForm')?.dataset.groupIndex ?? '-1', 10);
    const groupIndex = Number.isNaN(derivedIndex) ? -1 : derivedIndex;

    document.getElementById('groupName').value = group.groupName || '';
    document.getElementById('groupPhaseTag').value = group.phaseTag || '';

    updateGroupIdPreview({ groupIndex, group });
}

function updateGroupIdPreview(options = {}) {
    const previewEl = document.getElementById('groupIdPreview');
    if (!previewEl) {
        return;
    }

    const form = document.getElementById('groupForm');
    const datasetIndex = form ? parseInt(form.dataset.groupIndex ?? '-1', 10) : -1;
    const groupIndex = typeof options.groupIndex === 'number'
        ? options.groupIndex
        : (Number.isNaN(datasetIndex) ? -1 : datasetIndex);

    const isExistingGroup = groupIndex > -1;
    const groupSource = options.group || state.groupModalOriginal || {};
    const configGroup = isExistingGroup && Array.isArray(state.configData?.agentGroups)
        ? state.configData.agentGroups[groupIndex]
        : null;

    const resolvedExistingId = (groupSource.groupId || configGroup?.groupId || '').trim();

    if (isExistingGroup && resolvedExistingId) {
        previewEl.textContent = `Section ID: ${resolvedExistingId}`;
        return;
    }

    const rawName = options.nameOverride !== undefined
        ? options.nameOverride
        : document.getElementById('groupName')?.value || groupSource.groupName || '';
    const trimmedName = rawName.trim();

    if (!trimmedName) {
        previewEl.textContent = 'Section ID will be generated when you enter a name.';
        return;
    }

    const previewId = generateGroupIdFromName(trimmedName, groupIndex);
    previewEl.textContent = `Section ID (auto): ${previewId}`;
}

function buildAgentDraftFromForm() {
    const form = document.getElementById('agentForm');
    if (!form) return null;

    const groupIndex = parseInt(form.dataset.groupIndex);
    const agentIndex = parseInt(form.dataset.agentIndex);
    const isNew = agentIndex === -1;
    const baseAgent = deepClone(state.agentModalOriginal || {});
    const group = state.configData?.agentGroups?.[groupIndex];

    const draft = { ...baseAgent };
    const existingAgentNumber = !isNew ? (baseAgent.agentNumber || group?.agents?.[agentIndex]?.agentNumber) : null;
    draft.agentNumber = existingAgentNumber || ((group?.agents?.length || 0) + 1);
    draft.name = document.getElementById('agentName').value;
    draft.objective = document.getElementById('agentObjective').value;
    draft.description = document.getElementById('agentDescription').value;
    draft.tools = Array.from(document.querySelectorAll('#agentTools input:checked')).map(cb => cb.value);

    // Parse journey steps from textarea (one per line)
    const journeyStepsText = document.getElementById('journeySteps').value;
    draft.journeySteps = journeyStepsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const metrics = { ...(baseAgent.metrics || {}), ...getAgentMetrics(baseAgent) };
    metrics.usageThisWeek = document.getElementById('metricsUsage').value;
    metrics.timeSaved = document.getElementById('metricsTimeSaved').value;
    draft.metrics = metrics;

    // Collect tag values from custom tag selectors
    const tags = { ...(baseAgent.tags || {}) };
    for (const [tagType, containerId] of Object.entries(TAG_SELECTOR_IDS)) {
        const value = getSelectedTagValue(containerId);
        if (value) {
            tags[tagType] = value;
        } else {
            delete tags[tagType];
        }
    }

    draft.tags = Object.keys(tags).length > 0 ? tags : undefined;

    // Phase (for grouping)
    const phaseInput = document.getElementById('agentPhase');
    if (phaseInput?.value) draft.phase = phaseInput.value;

    return draft;
}

function buildGroupDraftFromForm() {
    const form = document.getElementById('groupForm');
    if (!form) return null;

    const groupIndex = parseInt(form.dataset.groupIndex);
    const isNew = groupIndex === -1;
    const baseGroup = deepClone(state.groupModalOriginal || {});

    const draft = { ...baseGroup };
    draft.groupNumber = isNew
        ? state.configData?.agentGroups?.length || 0
        : (baseGroup.groupNumber ?? state.configData.agentGroups[groupIndex].groupNumber);
    draft.groupName = document.getElementById('groupName').value;
    // groupClass is derived from groupId, not set from form - only preserve if explicitly in original
    if (!baseGroup.groupClass) {
        delete draft.groupClass;
    }
    draft.phaseTag = document.getElementById('groupPhaseTag').value;

    ensureGroupHasId(draft, groupIndex);

    if (isNew) {
        draft.agents = draft.agents || [];
    } else {
        draft.agents = state.configData.agentGroups[groupIndex].agents;
    }

    return draft;
}

function syncAgentStateFromForm() {
    const draft = buildAgentDraftFromForm();
    if (!draft) return false;
    state.agentModalOriginal = draft;
    return true;
}

function syncGroupStateFromForm() {
    const draft = buildGroupDraftFromForm();
    if (!draft) return false;
    state.groupModalOriginal = draft;
    return true;
}

function updateYamlEditor(type) {
    const inputId = type === 'agent' ? 'agentYamlInput' : 'groupYamlInput';
    const errorId = type === 'agent' ? 'agentYamlError' : 'groupYamlError';
    const statusId = type === 'agent' ? 'agentYamlStatus' : 'groupYamlStatus';
    const stateKey = type === 'agent' ? 'agentModalOriginal' : 'groupModalOriginal';

    const textarea = document.getElementById(inputId);
    if (!textarea) return;
    textarea.value = window.jsyaml.dump(state[stateKey] || {});
    setElementText(errorId, '');
    setElementText(statusId, '');
}
function updateAgentYamlEditor() { updateYamlEditor('agent'); }
function updateGroupYamlEditor() { updateYamlEditor('group'); }

function applyYamlToForm(type) {
    const inputId = type === 'agent' ? 'agentYamlInput' : 'groupYamlInput';
    const errorId = type === 'agent' ? 'agentYamlError' : 'groupYamlError';
    const stateKey = type === 'agent' ? 'agentModalOriginal' : 'groupModalOriginal';
    const label = type === 'agent' ? 'Agent' : 'Section';

    const textarea = document.getElementById(inputId);
    if (!textarea) return false;
    try {
        const parsed = window.jsyaml.load(textarea.value) || {};
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error(`${label} YAML must describe an object.`);
        }

        if (type === 'agent') {
            state[stateKey] = parsed;
            populateAgentFormFields(parsed);
        } else {
            const form = document.getElementById('groupForm');
            const datasetIndex = form ? parseInt(form.dataset.groupIndex ?? '-1', 10) : -1;
            const groupIndex = Number.isNaN(datasetIndex) ? -1 : datasetIndex;
            state[stateKey] = ensureGroupHasId(parsed, groupIndex);
            populateGroupFormFields(state[stateKey], { groupIndex });
        }

        setElementText(errorId, '');
        return true;
    } catch (error) {
        setElementText(errorId, error.message);
        return false;
    }
}
function applyAgentYamlToForm() { return applyYamlToForm('agent'); }
function applyGroupYamlToForm() { return applyYamlToForm('group'); }

const modalViewConfigs = {
    agent: {
        formId: 'agentForm', modalId: 'agentModal', titleId: 'modalAgentTitle',
        stateKey: 'agentModalOriginal', indexKey: 'agentIndex', secondIndexKey: 'groupIndex',
        numberKey: 'agentNumber', nameKey: 'name',
        getMode: () => state.agentModalViewMode,
        setMode: mode => { state.agentModalViewMode = mode; },
        selectors: {
            formContentId: 'agentFormContent',
            yamlContentId: 'agentYamlContent',
            formToggleId: 'agentFormToggle',
            yamlToggleId: 'agentYamlToggle'
        },
        syncFromForm: syncAgentStateFromForm,
        applyFromYaml: applyAgentYamlToForm,
        updateYamlEditor: updateAgentYamlEditor,
        formReadError: 'Unable to read agent form data.',
        yamlValidationError: 'Please fix YAML errors before returning to form view.',
        getCollection: (gi) => state.configData.agentGroups[gi].agents
    },
    group: {
        formId: 'groupForm', modalId: 'groupModal', titleId: 'modalGroupTitle',
        stateKey: 'groupModalOriginal', indexKey: 'groupIndex',
        numberKey: 'groupNumber', nameKey: 'groupName',
        getMode: () => state.groupModalViewMode,
        setMode: mode => { state.groupModalViewMode = mode; },
        selectors: {
            formContentId: 'groupFormContent',
            yamlContentId: 'groupYamlContent',
            formToggleId: 'groupFormToggle',
            yamlToggleId: 'groupYamlToggle'
        },
        syncFromForm: syncGroupStateFromForm,
        applyFromYaml: applyGroupYamlToForm,
        updateYamlEditor: updateGroupYamlEditor,
        formReadError: 'Unable to read section form data.',
        yamlValidationError: 'Please fix YAML errors before returning to form view.',
        getCollection: () => state.configData.agentGroups
    }
};

function updateDualViewModalUI(config) {
    const mode = config.getMode();
    const {
        formContentId,
        yamlContentId,
        formToggleId,
        yamlToggleId
    } = config.selectors;

    const formContent = document.getElementById(formContentId);
    const yamlContent = document.getElementById(yamlContentId);
    const formToggle = document.getElementById(formToggleId);
    const yamlToggle = document.getElementById(yamlToggleId);

    if (formContent) {
        formContent.style.display = mode === 'form' ? 'block' : 'none';
    }
    if (yamlContent) {
        yamlContent.style.display = mode === 'yaml' ? 'block' : 'none';
    }
    if (formToggle) {
        formToggle.classList.toggle('active', mode === 'form');
    }
    if (yamlToggle) {
        yamlToggle.classList.toggle('active', mode === 'yaml');
    }
}

function setModalView(mode, config) {
    if (mode === config.getMode()) {
        return;
    }

    if (mode === 'yaml') {
        if (!config.syncFromForm()) {
            alert(config.formReadError);
            return;
        }
        config.updateYamlEditor();
    } else {
        if (!config.applyFromYaml()) {
            alert(config.yamlValidationError);
            return;
        }
    }

    config.setMode(mode);
    updateDualViewModalUI(config);
}

function ensureModalStateFromCurrentView(config) {
    if (config.getMode() === 'yaml') {
        return config.applyFromYaml();
    }
    return config.syncFromForm();
}

function ensureAgentStateFromCurrentView() { return ensureModalStateFromCurrentView(modalViewConfigs.agent); }
function ensureGroupStateFromCurrentView() { return ensureModalStateFromCurrentView(modalViewConfigs.group); }

async function copyYaml(type) {
    const inputId = type === 'agent' ? 'agentYamlInput' : 'groupYamlInput';
    const statusId = type === 'agent' ? 'agentYamlStatus' : 'groupYamlStatus';
    const textarea = document.getElementById(inputId);
    if (!textarea) return;
    const success = await copyTextToClipboard(textarea.value);
    setElementText(statusId, success ? 'Copied to clipboard' : 'Clipboard unavailable');
    if (success) setTimeout(() => setElementText(statusId, ''), 2000);
}
async function copyAgentYaml() { return copyYaml('agent'); }
async function copyGroupYaml() { return copyYaml('group'); }

// ----- Config load/save -----
async function loadConfig(docName = state.currentDocumentName || DEFAULT_DOCUMENT_NAME) {
    try {
        const currentOrg = getCurrentOrg();
        if (!currentOrg) {
            throw new Error('No organization selected');
        }

        // Get canvas from Convex
        const canvas = await getDocument(currentOrg.id, docName);
        if (!canvas) {
            throw new Error(`Document "${docName}" not found`);
        }

        // Get agents for this canvas
        const agents = await getConvexClient().query("agents:list", { canvasId: canvas._id });
        
        // Get org settings for toolsConfig and sectionDefaults
        const orgSettings = await getConvexClient().query("orgSettings:get", { workosOrgId: currentOrg.id }).catch(() => null);

        // Convert Convex data to YAML format
        state.configData = convexToYaml(canvas, agents, orgSettings);
        
        // Store canvas ID for future operations
        state.currentCanvasId = canvas._id;
        
        return state.configData;
    } catch (error) {
        console.error('Error loading config:', error);
        document.getElementById('agentGroupsContainer').innerHTML =
            '<p class="empty-state-message">Error loading configuration file</p>';
        throw error;
    }
}

async function saveConfig() {
    try {
        setDocumentStatusMessage('Saving configuration...');
        const docName = state.currentDocumentName || DEFAULT_DOCUMENT_NAME;
        const currentOrg = getCurrentOrg();
        if (!currentOrg) {
            throw new Error('No organization selected');
        }

        // Convert YAML to Convex agents format
        const agents = yamlToConvexAgents(state.configData);
        
        // Get or create canvas
        let canvas = await getDocument(currentOrg.id, docName);
        const title = state.configData.documentTitle || docName;
        const yamlText = window.jsyaml.dump(state.configData);

        if (!canvas) {
            // Create new canvas
            const canvasId = await getConvexClient().mutation("canvases:create", {
                workosOrgId: currentOrg.id,
                title,
                slug: docName,
                sourceYaml: yamlText,
            });
            canvas = await getConvexClient().query("canvases:get", { canvasId });
        } else {
            // Update existing canvas
            await getConvexClient().mutation("canvases:update", {
                canvasId: canvas._id,
                title,
                sourceYaml: yamlText,
            });
        }

        // Atomically replace all agents for this canvas
        await getConvexClient().mutation("agents:bulkReplace", {
            canvasId: canvas._id,
            agents,
        });

        state.currentCanvasId = canvas._id;
        setDocumentStatusMessage('Saved.', 'success');
        await refreshDocumentList(docName);
        return true;
    } catch (error) {
        console.error('Error saving config:', error);
        alert('Failed to save configuration: ' + error.message);
        setDocumentStatusMessage('Save failed.', 'error');
        return false;
    }
}

// ----- Rendering helpers -----
function renderMenuItems(actions = []) {
    return actions.map(action => {
        if (action.type === 'divider') {
            return '<div class="context-menu-divider menu-divider"></div>';
        }
        const dangerClass = action.danger ? ' danger' : '';
        const iconMarkup = action.icon ? `<i data-lucide="${action.icon}"></i>` : '';
        const dataAttrs = action.dataAttrs || '';
        return `<button type="button" class="menu-item${dangerClass}" ${dataAttrs}>
            ${iconMarkup}
            ${action.label}
        </button>`;
    }).join('');
}

function renderContextMenuTrigger({ menuId, title, actions, icon = 'more-vertical', stopPropagation = false }) {
    const menuMarkup = renderMenuItems(actions);
    const stopClass = stopPropagation ? ' data-stop-prop="true"' : '';
    return `
        <div class="context-menu-trigger" data-menu-trigger="${menuId}"${stopClass} title="${title}">
            <i data-lucide="${icon}"></i>
            <div class="context-menu menu-panel" id="${menuId}">
                ${menuMarkup}
            </div>
        </div>
    `;
}

// Template Functions
function createJourneyTooltip(steps) {
    const stepsList = toArray(steps);
    if (stepsList.length === 0) {
        return '<div class="journey-tooltip"><strong>User Journey:</strong><br>No steps defined</div>';
    }
    const stepsHTML = stepsList.map(step => `→ ${step}`).join('<br>');
    return `<div class="journey-tooltip"><strong>User Journey:</strong><br>${stepsHTML}</div>`;
}

function createAgentCard(agent, groupIndex, agentIndex) {
    const tools = toArray(agent.tools);
    const journeySteps = toArray(agent.journeySteps);
    const metrics = getAgentMetrics(agent);

    // Create tool chips with new design
    const toolsHTML = tools.map(tool => {
        const toolInfo = getToolDisplay(tool);
        return `<span class="tool-chip" data-tool="${tool.toLowerCase().replace(/\s+/g, '-')}" style="--chip-color: ${toolInfo.color}; --chip-bg: ${toolInfo.color}15; --chip-border: ${toolInfo.color}40;">
            <i data-lucide="${toolInfo.icon}"></i> ${toolInfo.label}
        </span>`;
    }).join('');

    // Create tag indicators
    const tagIndicatorsHTML = createTagIndicators(agent);

    // Status color based on status tag
    const statusTag = agent.tags?.status || 'active';
    const statusColors = { active: '#10B981', draft: '#64748B', review: '#F59E0B', deprecated: '#EF4444' };
    const statusColor = statusColors[statusTag] || '#F59E0B';

    // Metrics display
    const adoptionValue = metrics.usageThisWeek || '0';
    const timeSavedValue = metrics.timeSaved || '0%';

    // Agent menu trigger (simplified for new design)
    const agentMenuId = `agent-menu-${groupIndex}-${agentIndex}`;

    // Stagger class for animation
    const staggerClass = `stagger-${((agentIndex % 8) + 1)}`;

    return `
        <article class="agent-card ${staggerClass}" data-group-index="${groupIndex}" data-agent-index="${agentIndex}">
            <div class="agent-card__status-strip" style="--status-color: ${statusColor};"></div>

            <header class="agent-card__header">
                <span class="agent-card__number">${String(agent.agentNumber || agentIndex + 1).padStart(2, '0')}</span>
                <div class="agent-card__title">
                    <h3 class="agent-card__name">${agent.name || 'Untitled Agent'}</h3>
                </div>
                <button type="button" class="agent-card__menu" data-menu-trigger="${agentMenuId}" title="Agent options">
                    <i data-lucide="more-horizontal"></i>
                </button>
                <div class="context-menu" id="${agentMenuId}">
                    <div class="context-menu__item" data-action-type="agent-edit" data-group-index="${groupIndex}" data-agent-index="${agentIndex}">
                        <i data-lucide="edit-3"></i>
                        <span>Edit Agent</span>
                    </div>
                    <div class="context-menu__divider"></div>
                    <div class="context-menu__item context-menu__item--danger" data-action-type="agent-delete" data-group-index="${groupIndex}" data-agent-index="${agentIndex}">
                        <i data-lucide="trash-2"></i>
                        <span>Delete</span>
                    </div>
                </div>
            </header>

            ${tagIndicatorsHTML ? `<div class="agent-card__tags">${tagIndicatorsHTML}</div>` : ''}

            ${agent.objective ? `<p class="agent-card__objective">${agent.objective}</p>` : ''}

            ${agent.description ? `<p class="agent-card__description">${agent.description}</p>` : ''}

            ${toolsHTML ? `<div class="agent-card__tools">${toolsHTML}</div>` : ''}

            <footer class="agent-card__footer">
                <div class="agent-card__metrics">
                    <div class="metric">
                        <i data-lucide="trending-up"></i>
                        <span class="metric__value">${adoptionValue}</span>
                    </div>
                    <div class="metric">
                        <i data-lucide="clock"></i>
                        <span class="metric__value">${timeSavedValue}</span>
                    </div>
                </div>
                <div class="agent-card__actions">
                    ${journeySteps.length > 0 ? `
                    <button type="button" class="action-icon journey-trigger" title="View journey steps">
                        <i data-lucide="map"></i>
                        ${createJourneyTooltip(journeySteps)}
                    </button>` : ''}
                    ${agent.demoLink ? `
                    <a href="${agent.demoLink}" target="_blank" class="action-icon" title="Try Demo">
                        <i data-lucide="external-link"></i>
                    </a>` : ''}
                    ${agent.videoLink ? `
                    <a href="${agent.videoLink}" target="_blank" class="action-icon" title="Watch video">
                        <i data-lucide="video"></i>
                    </a>` : ''}
                </div>
            </footer>
        </article>`;
}

// Create tag indicator chips for agent card
function createTagIndicators(agent) {
    const tags = agent.tags || {};

    // Define which tags to show and their rendering
    const tagConfigs = [
        { type: 'department', show: tags.department },
        { type: 'status', show: tags.status && tags.status !== 'active', useStatusDot: true },
        { type: 'implementationStatus', show: tags.implementationStatus },
        { type: 'priority', show: tags.priority, iconless: true }
    ];

    return tagConfigs
        .filter(config => config.show)
        .map(config => {
            const tagInfo = getAgentTagDisplay(agent, config.type);
            if (!tagInfo) return '';

            const style = `--tag-color: ${tagInfo.color}; --tag-bg: ${tagInfo.color}15; --tag-border: ${tagInfo.color}40;`;
            let iconMarkup = '';
            if (config.useStatusDot) {
                iconMarkup = `<span class="status-dot" style="--dot-color: ${tagInfo.color};"></span>`;
            } else if (!config.iconless) {
                iconMarkup = `<i data-lucide="${tagInfo.icon}"></i>`;
            }

            return `<span class="tag-indicator" style="${style}">${iconMarkup} ${tagInfo.label}</span>`;
        })
        .join('');
}

function createAgentGroup(group, groupIndex) {
    // Use group color if provided, otherwise use palette
    const color = group.color || getSectionColor(groupIndex);
    const icon = group.icon || 'layers';
    const groupId = group.id || group.groupId || `group-${groupIndex}`;
    const groupLabel = group.label || group.groupName || 'Unnamed Group';
    const agents = group.agents || [];
    const agentCount = agents.length;

    const agentsHTML = agents.map((agent, agentIndex) =>
        createAgentCard(agent, groupIndex, agentIndex)
    ).join('');

    const isCollapsed = state.collapsedSections[groupId] || false;
    const collapsedClass = isCollapsed ? 'collapsed' : '';

    // Create agent name pills for collapsed view
    const maxPills = 4;
    const agentPills = agents
        .slice(0, maxPills)
        .filter(agent => agent && agent.name)
        .map((agent, pillIndex) => {
            return `<span class="collapsed-pill stagger-${pillIndex + 1}">${agent.name}</span>`;
        })
        .join('');
    const morePill = agents.length > maxPills
        ? `<span class="collapsed-pill collapsed-pill--more">+${agents.length - maxPills}</span>`
        : '';
    const collapsedPillsHTML = `<div class="collapsed-pills">${agentPills}${morePill}</div>`;

    // Section menu for admin actions
    const sectionMenuTrigger = canManageCanvases() ? renderContextMenuTrigger({
        menuId: `section-menu-${groupIndex}`,
        title: 'Group options',
        stopPropagation: true,
        actions: [
            {
                icon: 'plus',
                label: 'Add Agent',
                dataAttrs: `data-action-type="agent-add" data-group-index="${groupIndex}"`
            }
        ]
    }) : '';

    return `
        <div class="agent-group ${collapsedClass}" data-group-id="${groupId}" data-group-index="${groupIndex}" style="--group-color: ${color};">
            <div class="group-header" data-collapse-target="${groupId}">
                <button class="collapse-toggle" aria-label="Toggle group">
                    <i data-lucide="chevron-down"></i>
                </button>
                <div class="group-icon" style="background: ${color}15; color: ${color};">
                    <i data-lucide="${icon}"></i>
                </div>
                <h3 class="group-title">${groupLabel}</h3>
                <span class="group-count">${agentCount}</span>
                ${collapsedPillsHTML}
                ${sectionMenuTrigger}
            </div>
            <div class="agents-grid-container">
                <div class="agents-grid-inner">${agentsHTML}</div>
            </div>
        </div>`;
}

// ----- Primary render pipeline -----
// Render agent groups (can be called to re-render after edits)
function renderAgentGroups() {
    // Get agents from state (Convex agents or legacy configData)
    let agents = state.agents || [];

    // Fallback to legacy configData if no agents in state
    if (agents.length === 0 && state.configData?.agentGroups) {
        agents = flattenAgentsFromConfig(state.configData);
    }

    // Load collapsed state and grouping preference
    loadCollapsedState();
    loadGroupingPreference();

    // Get current grouping tag type
    const groupingTag = getGroupingTagType();

    // Apply filters and search
    let filteredAgents = filterAgents(agents, state.grouping.filters);
    filteredAgents = searchAgents(filteredAgents, state.grouping.searchQuery);

    // Group agents by selected tag
    const groups = groupAgentsByTag(filteredAgents, groupingTag);
    state.computedGroups = groups;

    // Initialize collapsed state for new groups
    groups.forEach(group => {
        const groupId = group.id || group.groupId;
        if (state.collapsedSections[groupId] === undefined) {
            state.collapsedSections[groupId] = false;
        }
    });

    // Update document/canvas title
    const title = state.currentCanvas?.name || state.configData?.documentTitle || 'AgentCanvas';
    const titleEl = document.getElementById('documentTitle');
    if (titleEl) titleEl.textContent = title;

    // Update agent count in header
    const totalAgents = agents.filter(a => !a.deletedAt).length;
    const agentCountEl = document.getElementById('agent-count');
    if (agentCountEl) {
        agentCountEl.textContent = `${totalAgents} AI Agent${totalAgents !== 1 ? 's' : ''}`;
    }

    // Update grouping control dropdown to match current selection
    const groupingDropdown = document.getElementById('groupingDropdown');
    const groupingValue = document.getElementById('groupingValue');
    if (groupingDropdown) {
        // Update active state on dropdown items
        groupingDropdown.querySelectorAll('.grouping-dropdown__item').forEach(item => {
            item.classList.toggle('is-active', item.dataset.tagType === groupingTag);
            if (item.dataset.tagType === groupingTag && groupingValue) {
                const label = item.querySelector('span')?.textContent || groupingTag;
                const valueSpan = groupingValue.querySelector('span');
                if (valueSpan) valueSpan.textContent = label;
            }
        });
    }

    // Render all agent groups
    const container = document.getElementById('agentGroupsContainer');
    if (!container) return;

    if (groups.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon">
                    <i data-lucide="bot"></i>
                </div>
                <h3 class="empty-state__title">No agents found</h3>
                <p class="empty-state__text">
                    ${state.grouping.searchQuery || Object.keys(state.grouping.filters).length > 0
                        ? 'Try adjusting your filters or search query.'
                        : 'Create your first agent to get started.'}
                </p>
            </div>
        `;
    } else {
        const groupsHTML = groups.map((group, index) =>
            createAgentGroup(group, index)
        ).join('');
        container.innerHTML = groupsHTML;
    }

    // Initialize Lucide icons
    refreshIcons();

    // Setup interactions
    setupTooltips();

    // Update collapse all button state
    updateCollapseAllButton();
}

// ----- Page interactions -----
// Load and render agents
async function loadAgents(docName = state.currentDocumentName) {
    if (!docName) {
        const container = document.getElementById('agentGroupsContainer');
        if (container) {
            container.innerHTML =
                '<p class="empty-state-message">No canvas selected. Create or select a canvas to begin.</p>';
        }
        return;
    }

    try {
        await loadConfig(docName);
        renderAgentGroups();
    } catch (error) {
        console.error('Error loading agents:', error);
    }
}

registerLoadAgents(loadAgents);

// Setup journey tooltips with positioning
function setupTooltips() {
    document.querySelectorAll('.journey-trigger').forEach(trigger => {
        trigger.addEventListener('mouseenter', function() {
            const tooltip = this.querySelector('.journey-tooltip');
            if (!tooltip) return;

            document.body.appendChild(tooltip);
            tooltip.style.display = 'block';
            tooltip.style.visibility = 'hidden';
            tooltip.style.left = '-9999px';

            const rect = this.getBoundingClientRect();
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;

            let top = rect.top - tooltipHeight - 10;
            let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);

            if (left < 10) left = 10;
            if (left + tooltipWidth > window.innerWidth - 10) {
                left = window.innerWidth - tooltipWidth - 10;
            }
            if (top < 10) top = rect.bottom + 10;

            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
            tooltip.style.visibility = 'visible';

            this._activeTooltip = tooltip;
            this._originalParent = this;
        });

        trigger.addEventListener('mouseleave', function() {
            if (this._activeTooltip) {
                this._activeTooltip.style.display = 'none';
                this._originalParent.appendChild(this._activeTooltip);
                this._activeTooltip = null;
            }
        });
    });
}

// ----- Generic Modal Save/Delete -----
function genericSaveModal(type) {
    const def = modalViewConfigs[type];
    const form = document.getElementById(def.formId);
    const idx = parseInt(form.dataset[def.indexKey]);
    const isNew = idx === -1;

    if (!ensureModalStateFromCurrentView(def)) {
        alert('Please resolve form or YAML errors before saving.');
        return;
    }

    // Disable save button and show loading state
    const saveBtn = document.getElementById(type === 'agent' ? 'agentSaveBtn' : 'groupSaveBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader-2"></i> Saving...';
        saveBtn.classList.add('btn-loading');
        refreshIcons();
    }

    // Show loading overlay
    showLoadingOverlay('Saving...');

    const item = deepClone(state[def.stateKey] || {});

    // Handle numbering
    if (type === 'agent') {
        const gi = parseInt(form.dataset.groupIndex);
        const coll = def.getCollection(gi);
        if (!item[def.numberKey]) {
            item[def.numberKey] = isNew ? coll.length + 1 : (coll[idx]?.[def.numberKey] || idx + 1);
        }
        if (isNew) coll.push(item); else coll[idx] = item;
    } else {
        const coll = def.getCollection();
        if (!item[def.numberKey]) {
            item[def.numberKey] = isNew ? coll.length : coll[idx][def.numberKey];
        }
        if (isNew) {
            item.agents = Array.isArray(item.agents) ? item.agents : [];
            coll.push(item);
        } else {
            item.agents = coll[idx].agents;
            coll[idx] = item;
        }
    }

    saveConfig().then(success => {
        // Hide loading overlay
        hideLoadingOverlay();

        // Re-enable button
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="save"></i> Save';
            saveBtn.classList.remove('btn-loading');
            refreshIcons();
        }

        if (success) {
            def.setMode('form');
            state[def.stateKey] = null;
            document.getElementById(def.modalId).classList.remove('show');
            renderAgentGroups();
        }
    });
}

function genericDeleteModal(type, idx1 = null, idx2 = null) {
    const def = modalViewConfigs[type];
    if (idx1 === null) {
        const form = document.getElementById(def.formId);
        idx1 = parseInt(form.dataset[def.indexKey]);
        if (type === 'agent') idx2 = parseInt(form.dataset[def.secondIndexKey]);
    }

    const coll = type === 'agent' ? def.getCollection(idx2) : def.getCollection();
    const item = coll[idx1];
    const confirmMsg = type === 'agent'
        ? `Are you sure you want to delete "${item[def.nameKey]}"?`
        : `Are you sure you want to delete "${item[def.nameKey]}" and all its agents?`;

    if (!confirm(confirmMsg)) return;

    coll.splice(idx1, 1);
    saveConfig().then(success => {
        if (success) {
            def.setMode('form');
            state[def.stateKey] = null;
            document.getElementById(def.modalId).classList.remove('show');
            renderAgentGroups();
        }
    });
}

// ----- Agent modal handlers -----
function openEditAgentModal(groupIndex, agentIndex) {
    const group = state.configData.agentGroups[groupIndex];
    const agent = group.agents[agentIndex];

    showAgentModal(agent, groupIndex, agentIndex);
}

function openAddAgentModal(groupIndex) {
    const newAgent = {
        agentNumber: state.configData.agentGroups[groupIndex].agents.length + 1,
        name: '',
        objective: '',
        description: '',
        tools: [],
        journeySteps: [],
        metrics: getAgentMetrics({})
    };

    showAgentModal(newAgent, groupIndex, -1);
}

function showAgentModal(agent, groupIndex, agentIndex) {
    const isNew = agentIndex === -1;
    const modal = document.getElementById('agentModal');
    const form = document.getElementById('agentForm');

    document.getElementById('modalAgentTitle').textContent = isNew ? 'Add Agent' : 'Edit Agent';
    state.agentModalOriginal = deepClone(agent);
    state.agentModalViewMode = 'form';
    populateAgentFormFields(state.agentModalOriginal);
    setElementText('agentYamlError', '');
    setElementText('agentYamlStatus', '');
    const agentYamlInput = document.getElementById('agentYamlInput');
    if (agentYamlInput) {
        agentYamlInput.value = '';
    }
    updateAgentModalViewUI();

    // Show/hide delete button
    const deleteBtn = document.getElementById('deleteAgentBtn');
    if (deleteBtn) {
        deleteBtn.style.display = isNew ? 'none' : 'inline-flex';
    }

    // Store context for save
    form.dataset.groupIndex = groupIndex;
    form.dataset.agentIndex = agentIndex;

    modal.classList.add('show');
}

function closeModal(type) {
    const def = modalViewConfigs[type];
    def.setMode('form');
    state[def.stateKey] = null;
    document.getElementById(def.modalId).classList.remove('show');
}
function closeAgentModal() { closeModal('agent'); }
function closeGroupModal() { closeModal('group'); }

function saveAgent() { genericSaveModal('agent'); }
function deleteAgent(groupIndex = null, agentIndex = null) { genericDeleteModal('agent', agentIndex, groupIndex); }

// ----- Group modal handlers -----
function openEditGroupModal(groupIndex) {
    const group = state.configData.agentGroups[groupIndex];
    showGroupModal(group, groupIndex);
}

function openAddSectionModal() {
    const newGroup = {
        groupNumber: state.configData.agentGroups.length,
        groupName: '',
        groupId: '',
        agents: []
    };
    showGroupModal(newGroup, -1);
}

function showGroupModal(group, groupIndex) {
    const isNew = groupIndex === -1;
    const modal = document.getElementById('groupModal');
    const form = document.getElementById('groupForm');

    document.getElementById('modalGroupTitle').textContent = isNew ? 'Add Section' : 'Edit Section';
    state.groupModalOriginal = deepClone(group);
    state.groupModalViewMode = 'form';
    if (form) {
        form.dataset.groupIndex = groupIndex;
    }
    populateGroupFormFields(state.groupModalOriginal, { groupIndex });
    setElementText('groupYamlError', '');
    setElementText('groupYamlStatus', '');
    const groupYamlInput = document.getElementById('groupYamlInput');
    if (groupYamlInput) {
        groupYamlInput.value = '';
    }
    updateGroupModalViewUI();

    const deleteBtn = document.getElementById('deleteGroupBtn');
    if (deleteBtn) {
        deleteBtn.style.display = isNew ? 'none' : 'inline-flex';
    }

    modal.classList.add('show');
}

function saveGroup() { genericSaveModal('group'); }
function deleteGroup(groupIndex = null) { genericDeleteModal('group', groupIndex); }

// ----- Title modal handlers -----
function openEditTitleModal() {
    const modal = document.getElementById('titleModal');
    const input = document.getElementById('documentTitleInput');

    // Set current title or default
    const currentTitle = state.configData.documentTitle || 'AgentCanvas';
    input.value = currentTitle;

    modal.classList.add('show');

    refreshIcons();
}

function closeTitleModal() {
    document.getElementById('titleModal').classList.remove('show');
}

function saveTitleEdit() {
    const input = document.getElementById('documentTitleInput');
    const newTitle = input.value.trim();

    if (!newTitle) {
        alert('Title cannot be empty');
        return;
    }

    // Disable save button and show loading state
    const saveBtn = document.getElementById('titleModalSave');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader-2"></i> Saving...';
        saveBtn.classList.add('btn-loading');
        refreshIcons();
    }

    // Show loading overlay
    showLoadingOverlay('Saving title...');

    // Update config
    state.configData.documentTitle = newTitle;

    // Update display
    document.getElementById('documentTitle').textContent = newTitle;

    // Save config
    saveConfig().then(success => {
        // Hide loading overlay
        hideLoadingOverlay();

        // Re-enable button
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="save"></i> Save';
            saveBtn.classList.remove('btn-loading');
            refreshIcons();
        }

        if (success) {
            closeTitleModal();
        }
    });
}

// ----- Full YAML modal -----
function showFullYamlModal() {
    const modal = document.getElementById('fullYamlModal');
    const textarea = document.getElementById('fullYamlInput');

    // Dump entire configData to YAML
    textarea.value = window.jsyaml.dump(state.configData);

    // Clear any previous errors
    setElementText('fullYamlError', '');

    modal.classList.add('show');
    refreshIcons();
}

function closeFullYamlModal() {
    document.getElementById('fullYamlModal').classList.remove('show');
    setElementText('fullYamlError', '');
}

function validateAndNormalizeConfig(parsed) {
    // Validate root structure
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Configuration must be a YAML object');
    }

    // Validate agentGroups exists and is array
    if (!parsed.agentGroups) {
        throw new Error('Missing required field: agentGroups');
    }
    if (!Array.isArray(parsed.agentGroups)) {
        throw new Error('agentGroups must be an array');
    }

    // Ensure sectionDefaults exists with proper defaults
    if (!parsed.sectionDefaults || typeof parsed.sectionDefaults !== 'object') {
        parsed.sectionDefaults = {
            iconType: 'target',
            showInFlow: true,
            isSupport: false
        };
    } else {
        // Fill in missing defaults
        if (parsed.sectionDefaults.iconType === undefined) {
            parsed.sectionDefaults.iconType = 'target';
        }
        if (parsed.sectionDefaults.showInFlow === undefined) {
            parsed.sectionDefaults.showInFlow = true;
        }
        if (parsed.sectionDefaults.isSupport === undefined) {
            parsed.sectionDefaults.isSupport = false;
        }
    }

    // Validate and normalize each group
    parsed.agentGroups.forEach((group, groupIdx) => {
        const groupLabel = `Group ${groupIdx + 1}`;

        // Validate group is an object
        if (!group || typeof group !== 'object' || Array.isArray(group)) {
            throw new Error(`${groupLabel} must be an object`);
        }

        // Validate required: groupName
        if (!group.groupName || typeof group.groupName !== 'string' || !group.groupName.trim()) {
            throw new Error(`${groupLabel} missing required field: groupName (non-empty string)`);
        }
        group.groupName = group.groupName.trim();

        // Auto-generate groupNumber if missing
        if (group.groupNumber === undefined || group.groupNumber === null) {
            group.groupNumber = groupIdx;
        } else if (typeof group.groupNumber !== 'number') {
            throw new Error(`${groupLabel} "${group.groupName}": groupNumber must be a number`);
        }

        // Auto-generate groupId if missing
        ensureGroupHasId(group, groupIdx, parsed);

        // Validate required: agents array
        if (!group.agents) {
            throw new Error(`${groupLabel} "${group.groupName}" missing required field: agents`);
        }
        if (!Array.isArray(group.agents)) {
            throw new Error(`${groupLabel} "${group.groupName}": agents must be an array`);
        }

        // Validate and normalize each agent
        group.agents.forEach((agent, agentIdx) => {
            const agentLabel = `${groupLabel} "${group.groupName}", Agent ${agentIdx + 1}`;

            // Validate agent is an object
            if (!agent || typeof agent !== 'object' || Array.isArray(agent)) {
                throw new Error(`${agentLabel} must be an object`);
            }

            // Validate required: name
            if (!agent.name || typeof agent.name !== 'string' || !agent.name.trim()) {
                throw new Error(`${agentLabel} missing required field: name (non-empty string)`);
            }
            agent.name = agent.name.trim();

            // Auto-generate agentNumber if missing
            if (agent.agentNumber === undefined || agent.agentNumber === null) {
                agent.agentNumber = agentIdx + 1;
            } else if (typeof agent.agentNumber !== 'number') {
                throw new Error(`${agentLabel} "${agent.name}": agentNumber must be a number`);
            }

            // Ensure optional fields have correct types if present
            if (agent.objective !== undefined && typeof agent.objective !== 'string') {
                throw new Error(`${agentLabel} "${agent.name}": objective must be a string`);
            }
            if (agent.description !== undefined && typeof agent.description !== 'string') {
                throw new Error(`${agentLabel} "${agent.name}": description must be a string`);
            }
            if (agent.tools !== undefined && !Array.isArray(agent.tools)) {
                throw new Error(`${agentLabel} "${agent.name}": tools must be an array`);
            }
            if (agent.journeySteps !== undefined && !Array.isArray(agent.journeySteps)) {
                throw new Error(`${agentLabel} "${agent.name}": journeySteps must be an array`);
            }
            if (agent.metrics !== undefined && (typeof agent.metrics !== 'object' || Array.isArray(agent.metrics))) {
                throw new Error(`${agentLabel} "${agent.name}": metrics must be an object`);
            }

            // Set defaults for optional fields
            agent.tools = agent.tools || [];
            agent.journeySteps = agent.journeySteps || [];
            agent.objective = agent.objective || '';
            agent.description = agent.description || '';
        });
    });

    return parsed;
}

function saveFullYaml() {
    const textarea = document.getElementById('fullYamlInput');
    const errorEl = document.getElementById('fullYamlError');
    const saveBtn = document.getElementById('fullYamlSave');

    try {
        // Parse YAML
        let parsed;
        try {
            parsed = window.jsyaml.load(textarea.value);
        } catch (yamlError) {
            throw new Error(`YAML syntax error: ${yamlError.message}`);
        }

        // Validate and normalize configuration
        const normalized = validateAndNormalizeConfig(parsed);

        // Show loading state
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i data-lucide="loader-2"></i> Saving...';
            saveBtn.classList.add('btn-loading');
            refreshIcons();
        }

        // Show loading overlay
        showLoadingOverlay('Saving full configuration...');

        // Apply to state
        state.configData = normalized;

        // Save to backend
        saveConfig().then(success => {
            // Hide loading overlay
            hideLoadingOverlay();

            // Re-enable button
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="save"></i> Save Full Config';
                saveBtn.classList.remove('btn-loading');
                refreshIcons();
            }

            if (success) {
                closeFullYamlModal();
                renderAgentGroups(); // Re-render entire dashboard
            }
        });

    } catch (error) {
        setElementText('fullYamlError', `Error: ${error.message}`);
    }
}

// ----- Context menu handlers -----
// Context menus are dynamically created, so we keep custom handlers but use shared pattern
function toggleContextMenu(event, menuId, triggerEl = null) {
    event?.stopPropagation();

    const menu = document.getElementById(menuId);
    const trigger = triggerEl || event?.currentTarget;

    // Close all other menus first
    closeAllContextMenus(menuId);

    // Toggle current menu
    const isOpen = menu.classList.toggle('open');

    // Toggle active state on trigger
    if (trigger) {
        if (isOpen) {
            trigger.classList.add('active');
        } else {
            trigger.classList.remove('active');
        }
    }

    refreshIcons();
}

function closeAllContextMenus(excludeMenuId = null) {
    document.querySelectorAll('.context-menu.open').forEach(menu => {
        if (!excludeMenuId || menu.id !== excludeMenuId) {
            menu.classList.remove('open');
        }
    });
    document.querySelectorAll('.context-menu-trigger.active').forEach(trigger => {
        trigger.classList.remove('active');
    });
}

// Close menus when clicking outside
document.addEventListener('click', (event) => {
    if (!event.target.closest('.context-menu-trigger') && !event.target.closest('.context-menu')) {
        closeAllContextMenus();
    }
});

// ----- Reusable form helpers -----
// Initialize on page load
async function bootstrapApp() {
    try {
        // Initialize authentication (WorkOS) first
        const { authenticated, user } = await initAuth();

        if (authenticated && user) {
            // Initialize Convex client with auth (fetches config from API if needed)
            try {
                const convexClient = await initConvexClientAsync(getIdToken);
                if (convexClient) {
                    // Sync org memberships to Convex for access control
                    try {
                        await syncOrgMemberships();
                    } catch (err) {
                        console.error('Failed to sync org memberships:', err);
                    }
                } else {
                    setDocumentStatusMessage(
                        'Warning: Backend not configured. Some features may be unavailable.',
                        'error'
                    );
                }
            } catch (err) {
                console.error('Failed to initialize Convex client:', err);
                setDocumentStatusMessage(
                    'Warning: Could not connect to backend. Some features may be unavailable.',
                    'error'
                );
            }

            // Clear redirect loop tracking on successful auth
            sessionStorage.removeItem('auth_redirect_time');

            // Update user menu UI
            const userDisplayName = document.getElementById('userDisplayName');
            const userEmail = document.getElementById('userEmail');
            if (userDisplayName) userDisplayName.textContent = getUserName() || 'User';
            if (userEmail) userEmail.textContent = getUserEmail() || '';

            // Bind user menu events
            bindUserMenuEvents();

            // Initialize groups/orgs
            await initializeGroups();

            // Update role-based UI visibility
            updateRoleBasedUI();

            // Listen for org changes to update UI
            window.addEventListener('orgChanged', updateRoleBasedUI);
        } else {
            // Not authenticated, redirect to login
            // Prevent redirect loops using sessionStorage
            const lastRedirect = sessionStorage.getItem('auth_redirect_time');
            const now = Date.now();
            if (lastRedirect && (now - parseInt(lastRedirect)) < 5000) {
                console.error('Redirect loop detected! Stopping redirect.');
                document.body.innerHTML = '<div style="padding: 40px; text-align: center;"><h2>Authentication Error</h2><p>Unable to verify authentication. Please <a href="/login">try logging in again</a>.</p></div>';
                return;
            }
            sessionStorage.setItem('auth_redirect_time', now.toString());
            console.log('No user found, redirecting to login...');
            window.location.href = '/login';
            return;
        }

        await initializeDocumentControls();
        await loadAgents();
    } catch (error) {
        console.error('Initialization failed:', error);
    }
}

// Bind user menu dropdown events
function bindUserMenuEvents() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenuDropdown = document.getElementById('userMenuDropdown');

    if (userMenuBtn && userMenuDropdown) {
        bindToggleMenu({
            buttonEl: userMenuBtn,
            menuEl: userMenuDropdown,
            onAction: (action) => {
                if (action === 'signout') {
                    handleSignOut();
                }
            }
        });
    }
}

async function handleSignOut() {
    // Clear Convex auth before signing out
    updateConvexAuth(null);
    await signOut();
}

const groupNameInput = document.getElementById('groupName');
if (groupNameInput) {
    groupNameInput.addEventListener('input', event => {
        updateGroupIdPreview({ nameOverride: event.target.value });
    });
}

function bindStaticEventHandlers() {
    const agentGroupsContainer = document.getElementById('agentGroupsContainer');
    const boardMenu = document.getElementById('board-menu');

    const collapseBtn = document.getElementById('collapseAllBtn');
    collapseBtn?.addEventListener('click', toggleCollapseAll);

    const docSelect = document.getElementById('documentSelect');
    docSelect?.addEventListener('change', handleDocumentSelection);

    // Grouping control - custom dropdown for selecting grouping tag type
    const groupingControl = document.getElementById('groupingControl');
    const groupingValue = document.getElementById('groupingValue');
    const groupingDropdown = document.getElementById('groupingDropdown');

    // Toggle dropdown on click
    groupingValue?.addEventListener('click', (e) => {
        e.stopPropagation();
        groupingControl?.classList.toggle('is-open');
    });

    // Handle dropdown item selection
    groupingDropdown?.addEventListener('click', (e) => {
        const item = e.target.closest('.grouping-dropdown__item');
        if (!item) return;

        const tagType = item.dataset.tagType;
        if (!tagType) return;

        // Update active state
        groupingDropdown.querySelectorAll('.grouping-dropdown__item').forEach(i => i.classList.remove('is-active'));
        item.classList.add('is-active');

        // Update displayed value
        const label = item.querySelector('span')?.textContent || tagType;
        const valueSpan = groupingValue?.querySelector('span');
        if (valueSpan) valueSpan.textContent = label;

        // Close dropdown
        groupingControl?.classList.remove('is-open');

        // Update grouping and re-render
        setGroupingTagType(tagType);
        renderAgentGroups();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!groupingControl?.contains(e.target)) {
            groupingControl?.classList.remove('is-open');
        }
    });

    // Search input handler
    const searchInput = document.getElementById('agentSearchInput');
    let searchDebounce;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            state.grouping.searchQuery = e.target.value;
            renderAgentGroups();
        }, 200);
    });

    // Clear search button
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    clearSearchBtn?.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            state.grouping.searchQuery = '';
            renderAgentGroups();
        }
    });

    const boardTrigger = document.querySelector('[data-board-trigger="board-menu"]');
    boardTrigger?.addEventListener('click', event => {
        event.stopPropagation();
        toggleContextMenu(event, 'board-menu', boardTrigger);
    });
    boardMenu?.addEventListener('click', event => {
        const actionBtn = event.target.closest('[data-board-action]');
        if (!actionBtn) return;
        event.preventDefault();
        closeAllContextMenus();
        const type = actionBtn.dataset.boardAction;
        if (type === 'edit-title') {
            openEditTitleModal();
        } else if (type === 'edit-full-yaml') {
            showFullYamlModal();
        } else if (type === 'add-section') {
            openAddSectionModal();
        }
    });

    document.getElementById('agentModalClose')?.addEventListener('click', closeAgentModal);
    document.getElementById('agentFormToggle')?.addEventListener('click', () => setModalView('form', modalViewConfigs.agent));
    document.getElementById('agentYamlToggle')?.addEventListener('click', () => setModalView('yaml', modalViewConfigs.agent));
    document.getElementById('agentCopyYamlBtn')?.addEventListener('click', copyAgentYaml);
    document.getElementById('agentCancelBtn')?.addEventListener('click', closeAgentModal);
    document.getElementById('agentSaveBtn')?.addEventListener('click', saveAgent);
    document.getElementById('deleteAgentBtn')?.addEventListener('click', () => deleteAgent());

    document.getElementById('groupModalClose')?.addEventListener('click', closeGroupModal);
    document.getElementById('groupFormToggle')?.addEventListener('click', () => setModalView('form', modalViewConfigs.group));
    document.getElementById('groupYamlToggle')?.addEventListener('click', () => setModalView('yaml', modalViewConfigs.group));
    document.getElementById('groupCopyYamlBtn')?.addEventListener('click', copyGroupYaml);
    document.getElementById('groupCancelBtn')?.addEventListener('click', closeGroupModal);
    document.getElementById('groupSaveBtn')?.addEventListener('click', saveGroup);
    document.getElementById('deleteGroupBtn')?.addEventListener('click', () => deleteGroup());

    document.getElementById('titleModalClose')?.addEventListener('click', closeTitleModal);
    document.getElementById('titleModalCancel')?.addEventListener('click', closeTitleModal);
    document.getElementById('titleModalSave')?.addEventListener('click', saveTitleEdit);
    document.getElementById('titleForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTitleEdit();
    });

    document.getElementById('fullYamlModalClose')?.addEventListener('click', closeFullYamlModal);
    document.getElementById('fullYamlCancel')?.addEventListener('click', closeFullYamlModal);
    document.getElementById('fullYamlSave')?.addEventListener('click', saveFullYaml);

    agentGroupsContainer?.addEventListener('click', event => {
        const actionBtn = event.target.closest('[data-action-type]');
        if (actionBtn) {
            event.preventDefault();
            closeAllContextMenus();
            const type = actionBtn.dataset.actionType;
            const g = actionBtn.dataset.groupIndex !== undefined
                ? parseInt(actionBtn.dataset.groupIndex, 10)
                : null;
            const a = actionBtn.dataset.agentIndex !== undefined
                ? parseInt(actionBtn.dataset.agentIndex, 10)
                : null;
            switch (type) {
                case 'agent-edit':
                    if (g !== null && a !== null) openEditAgentModal(g, a);
                    break;
                case 'agent-delete':
                    if (g !== null && a !== null) deleteAgent(g, a);
                    break;
                case 'agent-add':
                    if (g !== null) openAddAgentModal(g);
                    break;
                case 'group-edit':
                    if (g !== null) openEditGroupModal(g);
                    break;
                case 'group-delete':
                    if (g !== null) deleteGroup(g);
                    break;
                default:
                    break;
            }
            return;
        }

        const menuTrigger = !event.target.closest('.context-menu') && event.target.closest('[data-menu-trigger]');
        if (menuTrigger) {
            const menuId = menuTrigger.dataset.menuTrigger;
            const stopProp = menuTrigger.dataset.stopProp === 'true';
            if (stopProp) event.stopPropagation();
            toggleContextMenu(event, menuId, menuTrigger);
            return;
        }

        const collapseTarget = event.target.closest('[data-collapse-target]')?.dataset.collapseTarget;
        if (collapseTarget) {
            toggleSectionCollapse(collapseTarget);
        }
    });
}

document.addEventListener('DOMContentLoaded', bindStaticEventHandlers);
document.addEventListener('DOMContentLoaded', bootstrapApp);

// Cleanup subscriptions on page unload to prevent memory leaks
window.addEventListener('beforeunload', unsubscribeAll);
window.addEventListener('pagehide', unsubscribeAll);
