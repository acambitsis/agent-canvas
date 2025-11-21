import {
    state,
    DEFAULT_DOCUMENT_NAME,
    getAgentMetrics,
    toArray,
    getGroupFormatting,
    getGroupClass,
    deepClone,
    getCollapsedPillClass,
    refreshIcons,
    generateGroupIdFromName,
    ensureGroupHasId,
    loadCollapsedState,
    saveCollapsedState
} from './state.js';
import {
    setElementText,
    copyTextToClipboard
} from './modal-utils.js';
import {
    setActiveDocumentName,
    refreshDocumentList,
    initializeDocumentControls,
    handleDocumentSelection,
    registerLoadAgents
} from './documents.js';

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
async function updateAgentModalViewUI() {
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
        Object.keys(state.configData?.toolsConfig || {}).forEach(toolName => {
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

function updateAgentYamlEditor() {
    const textarea = document.getElementById('agentYamlInput');
    if (!textarea) return;
    textarea.value = window.jsyaml.dump(state.agentModalOriginal || {});
    setElementText('agentYamlError', '');
    setElementText('agentYamlStatus', '');
}

function updateGroupYamlEditor() {
    const textarea = document.getElementById('groupYamlInput');
    if (!textarea) return;
    textarea.value = window.jsyaml.dump(state.groupModalOriginal || {});
    setElementText('groupYamlError', '');
    setElementText('groupYamlStatus', '');
}

function applyAgentYamlToForm() {
    const textarea = document.getElementById('agentYamlInput');
    if (!textarea) return false;
    try {
        const parsed = window.jsyaml.load(textarea.value) || {};
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Agent YAML must describe an object.');
        }
        state.agentModalOriginal = parsed;
        populateAgentFormFields(parsed);
        setElementText('agentYamlError', '');
        return true;
    } catch (error) {
        setElementText('agentYamlError', error.message);
        return false;
    }
}

function applyGroupYamlToForm() {
    const textarea = document.getElementById('groupYamlInput');
    if (!textarea) return false;
    try {
        const parsed = window.jsyaml.load(textarea.value) || {};
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Section YAML must describe an object.');
        }
        const form = document.getElementById('groupForm');
        const datasetIndex = form ? parseInt(form.dataset.groupIndex ?? '-1', 10) : -1;
        const groupIndex = Number.isNaN(datasetIndex) ? -1 : datasetIndex;
        state.groupModalOriginal = ensureGroupHasId(parsed, groupIndex);
        populateGroupFormFields(state.groupModalOriginal, { groupIndex });
        setElementText('groupYamlError', '');
        return true;
    } catch (error) {
        setElementText('groupYamlError', error.message);
        return false;
    }
}

const modalViewConfigs = {
    agent: {
        getMode: () => state.agentModalViewMode,
        setMode: mode => {
            state.agentModalViewMode = mode;
        },
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
        yamlValidationError: 'Please fix YAML errors before returning to form view.'
    },
    group: {
        getMode: () => state.groupModalViewMode,
        setMode: mode => {
            state.groupModalViewMode = mode;
        },
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
        yamlValidationError: 'Please fix YAML errors before returning to form view.'
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

function setAgentModalView(mode) {
    setModalView(mode, modalViewConfigs.agent);
}

function setGroupModalView(mode) {
    setModalView(mode, modalViewConfigs.group);
}

function ensureAgentStateFromCurrentView() {
    return ensureModalStateFromCurrentView(modalViewConfigs.agent);
}

function ensureGroupStateFromCurrentView() {
    return ensureModalStateFromCurrentView(modalViewConfigs.group);
}

async function copyAgentYaml() {
    const textarea = document.getElementById('agentYamlInput');
    if (!textarea) return;
    const success = await copyTextToClipboard(textarea.value);
    setElementText('agentYamlStatus', success ? 'Copied to clipboard' : 'Clipboard unavailable');
    if (success) {
        setTimeout(() => setElementText('agentYamlStatus', ''), 2000);
    }
}

async function copyGroupYaml() {
    const textarea = document.getElementById('groupYamlInput');
    if (!textarea) return;
    const success = await copyTextToClipboard(textarea.value);
    setElementText('groupYamlStatus', success ? 'Copied to clipboard' : 'Clipboard unavailable');
    if (success) {
        setTimeout(() => setElementText('groupYamlStatus', ''), 2000);
    }
}

// ----- Config load/save -----
async function loadConfig(docName = state.currentDocumentName || DEFAULT_DOCUMENT_NAME) {
    try {
        const url = `/api/config?doc=${encodeURIComponent(docName)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Config request failed: ${response.status}`);
        }
        const yamlText = await response.text();
        state.configData = window.jsyaml.load(yamlText);
        const resolvedDoc = response.headers.get('X-Config-Document');
        if (resolvedDoc) {
            setActiveDocumentName(resolvedDoc);
        }
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
        const yamlText = window.jsyaml.dump(state.configData);
        const docName = state.currentDocumentName || DEFAULT_DOCUMENT_NAME;
        const response = await fetch(`/api/config?doc=${encodeURIComponent(docName)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/yaml',
                'X-Config-Name': docName
            },
            body: yamlText
        });

        if (!response.ok) {
            throw new Error('Failed to save configuration');
        }

        const result = await response.json();
        console.log('Config saved:', result);
        await refreshDocumentList(docName);
        return true;
    } catch (error) {
        console.error('Error saving config:', error);
        alert('Failed to save configuration: ' + error.message);
        return false;
    }
}

// ----- Rendering helpers -----
// Generate dynamic CSS for group colors
function generateDynamicCSS(config) {
    // Reuse existing style element or create new one
    if (!state.dynamicStyleElement) {
        state.dynamicStyleElement = document.createElement('style');
        state.dynamicStyleElement.id = 'dynamic-config-styles';
        document.head.appendChild(state.dynamicStyleElement);
    }

    const groupCss = (config.agentGroups || [])
        .map(group => {
            const color = getGroupFormatting(group, 'color');
            const groupClass = getGroupClass(group);
            return `
                .${groupClass} {
                    --group-accent: ${color};
                }
            `;
        })
        .join('');

    const toolCss = Object.values(config.toolsConfig || {})
        .map(toolConfig => {
            if (!toolConfig?.class) {
                return '';
            }
            const chipColor = toolConfig.color || 'var(--tool-chip-bg-fallback)';
            return `
                .${toolConfig.class} {
                    --tool-chip-bg: ${chipColor};
                }
            `;
        })
        .join('');

    state.dynamicStyleElement.textContent = groupCss + toolCss;
}

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
function createToolChip(toolName, config) {
    const toolConfig = config.toolsConfig[toolName];
    if (!toolConfig) {
        console.warn(`Unknown tool "${toolName}" referenced in config. Available tools:`, Object.keys(config.toolsConfig));
        return `<span class="chip tool-chip tool-chip-unknown" title="Unknown tool: ${toolName}"><i data-lucide="alert-circle"></i> ${toolName}</span>`;
    }
    return `<span class="chip tool-chip ${toolConfig.class}"><i data-lucide="${toolConfig.icon}"></i> ${toolName}</span>`;
}

function createJourneyTooltip(steps) {
    const stepsList = toArray(steps);
    if (stepsList.length === 0) {
        return '<div class="journey-tooltip"><strong>User Journey:</strong><br>No steps defined</div>';
    }
    const stepsHTML = stepsList.map(step => `→ ${step}`).join('<br>');
    return `<div class="journey-tooltip"><strong>User Journey:</strong><br>${stepsHTML}</div>`;
}

function renderMetricRow({ label, value, fillClass, width }) {
    return `
        <div class="metric-row">
            <div class="metric-label">
                <span>${label}</span>
                <span class="metric-value">${value}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill ${fillClass}" style="width: ${width}%;"></div>
            </div>
        </div>`;
}

function createMetricsTooltip(agent) {
    const metrics = getAgentMetrics(agent);
    const usageNum = parseInt(metrics.usageThisWeek, 10) || 0;
    const usageMax = 100;
    const usagePercent = Math.min((usageNum / usageMax) * 100, 100);

    const timeSavedNum = parseInt(metrics.timeSaved, 10) || 0;
    const roiValue = metrics.roiContribution === 'Very High' ? 95 :
                    metrics.roiContribution === 'High' ? 85 :
                    metrics.roiContribution === 'Medium' ? 60 : 30;

    const metricRows = [
        {
            label: 'Usage This Week',
            value: metrics.usageThisWeek,
            fillClass: 'usage',
            width: usagePercent
        },
        {
            label: 'Time Saved',
            value: metrics.timeSaved,
            fillClass: 'time-saved',
            width: timeSavedNum
        },
        {
            label: 'ROI Contribution',
            value: metrics.roiContribution,
            fillClass: 'roi-contribution',
            width: roiValue
        }
    ].map(renderMetricRow).join('');

    return `
        <div class="metrics-tooltip">
            <div class="metrics-tooltip-header">
                <h4><i data-lucide="trending-up"></i>${agent.name}</h4>
            </div>
            <div class="metrics-tooltip-content">
                ${metricRows}
            </div>
        </div>`;
}

function renderAgentIconPanel({ journeyHTML, linkUrl, linkTarget, linkTitle, videoLink, metricsHTML }) {
    const safeVideoLink = videoLink || '#';
    const videoTitle = videoLink ? 'Watch video overview' : 'Video not available';
    return `
        <div class="icon-panel">
            <div class="icon-panel-item journey-icon">
                <i data-lucide="map"></i>
                ${journeyHTML}
            </div>
            <a href="${linkUrl}" ${linkTarget} class="icon-panel-item agent-link-icon" title="${linkTitle}">
                <i data-lucide="external-link"></i>
            </a>
            <a href="${safeVideoLink}" class="icon-panel-item video-icon" title="${videoTitle}">
                <i data-lucide="video"></i>
            </a>
            <div class="icon-panel-item metrics-icon">
                <i data-lucide="trending-up"></i>
                ${metricsHTML}
            </div>
        </div>`;
}

function createAgentCard(agent, config, groupIndex, agentIndex) {
    const tools = toArray(agent.tools);
    const journeySteps = toArray(agent.journeySteps);
    const metrics = getAgentMetrics(agent);
    const toolsHTML = tools.map(tool => createToolChip(tool, config)).join('');
    const journeyHTML = createJourneyTooltip(journeySteps);
    const metricsHTML = createMetricsTooltip({ ...agent, metrics });
    const linkUrl = agent.demoLink || '#';
    const linkTarget = agent.demoLink ? 'target="_blank"' : '';
    const linkTitle = agent.demoLink ? 'Try Demo' : 'Go to agent';
    const handoverBadge = agent.badge ? `<span class="badge handover-badge">${agent.badge}</span>` : '';
    const agentMenuTrigger = renderContextMenuTrigger({
        menuId: `agent-menu-${groupIndex}-${agentIndex}`,
        title: 'Agent options',
        actions: [
            {
                icon: 'edit-3',
                label: 'Edit Agent',
                dataAttrs: `data-action-type="agent-edit" data-group-index="${groupIndex}" data-agent-index="${agentIndex}"`
            },
            { type: 'divider' },
            {
                icon: 'trash-2',
                label: 'Delete Agent',
                danger: true,
                dataAttrs: `data-action-type="agent-delete" data-group-index="${groupIndex}" data-agent-index="${agentIndex}"`
            }
        ]
    });

    const iconPanelHTML = renderAgentIconPanel({
        journeyHTML,
        linkUrl,
        linkTarget,
        linkTitle,
        videoLink: agent.videoLink,
        metricsHTML
    });

    return `
        <div class="surface-panel agent-card">
            <div class="agent-number">${agent.agentNumber}</div>
            <h3 class="agent-title u-flex u-align-center u-gap-sm">
                <span>${agent.name}${handoverBadge}</span>
                ${agentMenuTrigger}
            </h3>
            <div class="agent-objective">Objective: ${agent.objective}</div>
            <div class="agent-description">${agent.description}</div>
            <div class="tools-container">${toolsHTML}</div>
            ${iconPanelHTML}
        </div>`;
}

function createAgentGroup(group, config, groupIndex) {
    const color = getGroupFormatting(group, 'color');
    const iconType = getGroupFormatting(group, 'iconType');
    const groupClass = getGroupClass(group);

    const agentsHTML = group.agents.map((agent, agentIndex) =>
        createAgentCard(agent, config, groupIndex, agentIndex)
    ).join('');

    const isCollapsed = state.collapsedSections[group.groupId] || false;
    const collapsedClass = isCollapsed ? 'collapsed' : '';

    // Create agent name pills for collapsed view
    const maxPills = 5;
    const agentPills = group.agents
        .slice(0, maxPills)
        .filter(agent => agent && agent.name)
        .map((agent, pillIndex) => {
            const pillClass = getCollapsedPillClass(pillIndex);
            return `<span class="chip agent-name-pill ${pillClass}">${agent.name}</span>`;
        })
        .join('');
    const morePill = group.agents.length > maxPills
        ? `<span class="chip agent-name-pill more-pill">+${group.agents.length - maxPills} more</span>`
        : '';
    const agentPillsHTML = `<div class="agent-pills-container">${agentPills}${morePill}</div>`;
    const sectionMenuTrigger = renderContextMenuTrigger({
        menuId: `section-menu-${groupIndex}`,
        title: 'Section options',
        stopPropagation: true,
        actions: [
            {
                icon: 'edit-3',
                label: 'Edit Section',
                dataAttrs: `data-action-type="group-edit" data-group-index="${groupIndex}"`
            },
            {
                icon: 'plus',
                label: 'Add Agent',
                dataAttrs: `data-action-type="agent-add" data-group-index="${groupIndex}"`
            },
            { type: 'divider' },
            {
                icon: 'trash-2',
                label: 'Delete Section',
                danger: true,
                dataAttrs: `data-action-type="group-delete" data-group-index="${groupIndex}"`
            }
        ]
    });

    return `
        <div class="surface-card agent-group ${groupClass} ${collapsedClass}" data-group-id="${group.groupId}" data-group-index="${groupIndex}">
            <div class="group-header" data-collapse-target="${group.groupId}">
                <div class="group-header-edit">
                    <div class="u-flex u-align-center u-full-width">
                        <div class="section-collapse-toggle">
                            <i data-lucide="chevron-down"></i>
                        </div>
                        <div class="group-icon">
                            <i data-lucide="${iconType}"></i>
                        </div>
                        <div class="group-title u-flex u-align-center u-wrap u-gap-md u-flex-1">
                            <div class="u-flex u-align-center u-wrap u-gap-sm">
                                <h2>${group.groupName}</h2>
                                ${sectionMenuTrigger}
                            </div>
                            ${agentPillsHTML}
                        </div>
                    </div>
                </div>
            </div>
            <div class="agents-grid-container">
                <div class="agents-grid">${agentsHTML}</div>
            </div>
        </div>`;
}

// ----- Primary render pipeline -----
// Render agent groups (can be called to re-render after edits)
function renderAgentGroups() {
    if (!state.configData) return;

    // Load collapsed state from localStorage
    loadCollapsedState();

    // Initialize all groups in state.collapsedSections if not present
    if (state.configData.agentGroups) {
        state.configData.agentGroups.forEach(group => {
            if (state.collapsedSections[group.groupId] === undefined) {
                state.collapsedSections[group.groupId] = false;
            }
        });
    }

    // Update document title
    const title = state.configData.documentTitle || 'TPS Operating System';
    document.getElementById('documentTitle').textContent = title;

    // Update agent count
    const totalAgents = state.configData.agentGroups.reduce((sum, group) => sum + group.agents.length, 0);
    document.getElementById('agent-count').textContent =
        `${totalAgents} AI Agents`;

    // Render all agent groups
    const container = document.getElementById('agentGroupsContainer');
    const groupsHTML = state.configData.agentGroups.map((group, index) =>
        createAgentGroup(group, state.configData, index)
    ).join('');

    container.innerHTML = groupsHTML;

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
                '<p class="empty-state-message">No YAML document selected. Upload or select a document to begin.</p>';
        }
        return;
    }

    try {
        const config = await loadConfig(docName);

        // Generate dynamic CSS
        generateDynamicCSS(config);

        // Render agent groups
        renderAgentGroups();

    } catch (error) {
        console.error('Error loading agents:', error);
    }
}

registerLoadAgents(loadAgents);

// Tooltip interactions
// Helper function to attach tooltip handlers
function attachTooltipHandlers(selector, tooltipClass, extraInit) {
    const icons = document.querySelectorAll(selector);

    icons.forEach(icon => {
        icon.addEventListener('mouseenter', function(e) {
            const tooltip = this.querySelector(tooltipClass);
            if (tooltip) {
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

                tooltip.style.top = top + 'px';
                tooltip.style.left = left + 'px';
                tooltip.style.visibility = 'visible';

                // Run extra initialization if provided
                if (extraInit) extraInit(tooltip);

                icon._activeTooltip = tooltip;
                icon._originalParent = this;
            }
        });

        icon.addEventListener('mouseleave', function(e) {
            if (this._activeTooltip) {
                this._activeTooltip.style.display = 'none';
                this._originalParent.appendChild(this._activeTooltip);
                this._activeTooltip = null;
            }
        });
    });
}

// Setup Tooltips
function setupTooltips() {
    // Journey tooltips
    attachTooltipHandlers('.journey-icon', '.journey-tooltip');

    // Metrics tooltips (re-initialize Lucide icons)
    attachTooltipHandlers('.metrics-icon', '.metrics-tooltip', () => {
        refreshIcons();
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

function closeAgentModal() {
    state.agentModalViewMode = 'form';
    state.agentModalOriginal = null;
    document.getElementById('agentModal').classList.remove('show');
}

function saveAgent() {
    const form = document.getElementById('agentForm');
    const groupIndex = parseInt(form.dataset.groupIndex);
    const agentIndex = parseInt(form.dataset.agentIndex);
    const isNew = agentIndex === -1;

    if (!ensureAgentStateFromCurrentView()) {
        alert('Please resolve form or YAML errors before saving.');
        return;
    }

    const agent = deepClone(state.agentModalOriginal || {});
    if (!agent.agentNumber) {
        agent.agentNumber = isNew
            ? state.configData.agentGroups[groupIndex].agents.length + 1
            : (state.configData.agentGroups[groupIndex].agents[agentIndex]?.agentNumber || agentIndex + 1);
    }

    if (isNew) {
        state.configData.agentGroups[groupIndex].agents.push(agent);
    } else {
        state.configData.agentGroups[groupIndex].agents[agentIndex] = agent;
    }

    saveConfig().then(success => {
        if (success) {
            closeAgentModal();
            // Re-render the page with updated data
            renderAgentGroups();
        }
    });
}

function deleteAgent(groupIndex = null, agentIndex = null) {
    // If called from modal, get indices from form
    if (groupIndex === null || agentIndex === null) {
        const form = document.getElementById('agentForm');
        groupIndex = parseInt(form.dataset.groupIndex);
        agentIndex = parseInt(form.dataset.agentIndex);
    }

    const agent = state.configData.agentGroups[groupIndex].agents[agentIndex];
    if (!confirm(`Are you sure you want to delete "${agent.name}"?`)) {
        return;
    }

    state.configData.agentGroups[groupIndex].agents.splice(agentIndex, 1);

    saveConfig().then(success => {
        if (success) {
            closeAgentModal();
            renderAgentGroups();
        }
    });
}

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
    // All formatting fields (color, showInFlow, isSupport, groupClass)
    // inherit from sectionDefaults unless explicitly overridden in YAML

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

    // Show/hide delete button
    const deleteBtn = document.getElementById('deleteGroupBtn');
    if (deleteBtn) {
        deleteBtn.style.display = isNew ? 'none' : 'inline-flex';
    }

    modal.classList.add('show');
}

function closeGroupModal() {
    state.groupModalViewMode = 'form';
    state.groupModalOriginal = null;
    document.getElementById('groupModal').classList.remove('show');
}

function saveGroup() {
    const form = document.getElementById('groupForm');
    const groupIndex = parseInt(form.dataset.groupIndex);
    const isNew = groupIndex === -1;

    if (!ensureGroupStateFromCurrentView()) {
        alert('Please resolve form or YAML errors before saving.');
        return;
    }

    const group = deepClone(state.groupModalOriginal || {});
    if (group.groupNumber === undefined || group.groupNumber === null) {
        group.groupNumber = isNew ? state.configData.agentGroups.length : state.configData.agentGroups[groupIndex].groupNumber;
    }

    if (isNew) {
        group.agents = Array.isArray(group.agents) ? group.agents : [];
    } else {
        group.agents = state.configData.agentGroups[groupIndex].agents;
    }

    if (isNew) {
        state.configData.agentGroups.push(group);
    } else {
        state.configData.agentGroups[groupIndex] = group;
    }

    saveConfig().then(success => {
        if (success) {
            closeGroupModal();
            renderAgentGroups();
            generateDynamicCSS(state.configData);
        }
    });
}

function deleteGroup(groupIndex = null) {
    // If called from modal, get index from form
    if (groupIndex === null) {
        const form = document.getElementById('groupForm');
        groupIndex = parseInt(form.dataset.groupIndex);
    }

    const group = state.configData.agentGroups[groupIndex];
    if (!confirm(`Are you sure you want to delete "${group.groupName}" and all its agents?`)) {
        return;
    }

    state.configData.agentGroups.splice(groupIndex, 1);

    saveConfig().then(success => {
        if (success) {
            closeGroupModal();
            renderAgentGroups();
        }
    });
}

// ----- Title modal handlers -----
function openEditTitleModal() {
    const modal = document.getElementById('titleModal');
    const input = document.getElementById('documentTitleInput');

    // Set current title or default
    const currentTitle = state.configData.documentTitle || 'TPS Operating System';
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

    // Update config
    state.configData.documentTitle = newTitle;

    // Update display
    document.getElementById('documentTitle').textContent = newTitle;

    // Save config
    saveConfig().then(success => {
        if (success) {
            closeTitleModal();
        }
    });
}

// ----- Context menu handlers -----
function toggleContextMenu(event, menuId) {
    event.stopPropagation();

    const menu = document.getElementById(menuId);
    const trigger = event.currentTarget;

    // Close all other menus first
    document.querySelectorAll('.context-menu.open').forEach(m => {
        if (m.id !== menuId) {
            m.classList.remove('open');
            // Remove active state from all triggers
            document.querySelectorAll('.context-menu-trigger.active').forEach(t => {
                t.classList.remove('active');
            });
        }
    });

    // Toggle current menu
    const isOpen = menu.classList.toggle('open');

    // Toggle active state on trigger
    if (isOpen) {
        trigger.classList.add('active');
    } else {
        trigger.classList.remove('active');
    }

    refreshIcons();
}

function closeAllContextMenus() {
    document.querySelectorAll('.context-menu.open').forEach(menu => {
        menu.classList.remove('open');
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
        await initializeDocumentControls();
        await loadAgents();
    } catch (error) {
        console.error('Initialization failed:', error);
    }
}

const groupNameInput = document.getElementById('groupName');
if (groupNameInput) {
    groupNameInput.addEventListener('input', event => {
        updateGroupIdPreview({ nameOverride: event.target.value });
    });
}

function bindStaticEventHandlers() {
    const agentGroupsContainer = document.getElementById('agentGroupsContainer');

    const collapseBtn = document.getElementById('collapseAllBtn');
    collapseBtn?.addEventListener('click', toggleCollapseAll);

    const docSelect = document.getElementById('documentSelect');
    docSelect?.addEventListener('change', handleDocumentSelection);

    const boardTrigger = document.querySelector('[data-board-trigger="board-menu"]');
    boardTrigger?.addEventListener('click', event => {
        event.stopPropagation();
        toggleContextMenu(event, 'board-menu');
    });

    document.getElementById('agentModalClose')?.addEventListener('click', closeAgentModal);
    document.getElementById('agentFormToggle')?.addEventListener('click', () => setAgentModalView('form'));
    document.getElementById('agentYamlToggle')?.addEventListener('click', () => setAgentModalView('yaml'));
    document.getElementById('agentCopyYamlBtn')?.addEventListener('click', copyAgentYaml);
    document.getElementById('agentCancelBtn')?.addEventListener('click', closeAgentModal);
    document.getElementById('agentSaveBtn')?.addEventListener('click', saveAgent);
    document.getElementById('deleteAgentBtn')?.addEventListener('click', () => deleteAgent());

    document.getElementById('groupModalClose')?.addEventListener('click', closeGroupModal);
    document.getElementById('groupFormToggle')?.addEventListener('click', () => setGroupModalView('form'));
    document.getElementById('groupYamlToggle')?.addEventListener('click', () => setGroupModalView('yaml'));
    document.getElementById('groupCopyYamlBtn')?.addEventListener('click', copyGroupYaml);
    document.getElementById('groupCancelBtn')?.addEventListener('click', closeGroupModal);
    document.getElementById('groupSaveBtn')?.addEventListener('click', saveGroup);
    document.getElementById('deleteGroupBtn')?.addEventListener('click', () => deleteGroup());

    document.getElementById('titleModalClose')?.addEventListener('click', closeTitleModal);
    document.getElementById('titleModalCancel')?.addEventListener('click', closeTitleModal);
    document.getElementById('titleModalSave')?.addEventListener('click', saveTitleEdit);

    agentGroupsContainer?.addEventListener('click', event => {
        const menuTrigger = event.target.closest('[data-menu-trigger]');
        if (menuTrigger) {
            const menuId = menuTrigger.dataset.menuTrigger;
            const stopProp = menuTrigger.dataset.stopProp === 'true';
            if (stopProp) event.stopPropagation();
            toggleContextMenu(event, menuId);
            return;
        }

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

        const collapseTarget = event.target.closest('[data-collapse-target]')?.dataset.collapseTarget;
        if (collapseTarget) {
            toggleSectionCollapse(collapseTarget);
        }
    });

    document.addEventListener('click', event => {
        const action = event.target.closest('[data-board-action]')?.dataset.boardAction;
        if (!action) return;
        event.preventDefault();
        closeAllContextMenus();
        if (action === 'edit-title') {
            openEditTitleModal();
        } else if (action === 'add-section') {
            openAddSectionModal();
        }
    });

    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-menu-trigger]');
        if (!trigger) return;
        const menuId = trigger.dataset.menuTrigger;
        const stopProp = trigger.dataset.stopProp === 'true';
        if (stopProp) event.stopPropagation();
        toggleContextMenu(event, menuId);
    });
}

document.addEventListener('DOMContentLoaded', bindStaticEventHandlers);
document.addEventListener('DOMContentLoaded', bootstrapApp);

// No global window exports; all handlers are bound below.
