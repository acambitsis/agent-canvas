import { getIdToken, getUserEmail, getUserName, initAuth, signOut } from './auth-client-workos.js';
import {
    TAG_TYPES, getAgentTagDisplay,
    getAvailableTools,
    getSectionColor,
    getToolDisplay
} from './config.js';
import { createAgent as createAgentMutation, deleteAgent as deleteAgentMutation, getConvexClient, initConvexClientAsync, syncOrgMemberships, unsubscribeAll, updateAgent as updateAgentMutation, updateConvexAuth } from './convex-client.js';
import {
    handleCanvasSelection,
    initializeCanvasControls,
    refreshCanvasList,
    registerLoadAgents,
    setCanvasStatusMessage,
    handleDocumentSelection,
    initializeDocumentControls,
    refreshDocumentList,
    registerLoadAgents,
    setDocumentStatusMessage
} from './canvases.js';
import { filterAgents, groupAgentsByTag, searchAgents } from './grouping.js';
import { bindToggleMenu } from './menu-utils.js';
import {
    canManageCanvases,
    deepClone,
    getAgentMetrics,
    getCurrentOrg,
    getCurrentOrgId,
    getCurrentOrgRole,
    getGroupingTagType,
    getUserOrgs as getUserOrgsFromState,
    loadCollapsedState,
    loadGroupingPreference,
    refreshIcons,
    saveCollapsedState,
    setCurrentOrgId,
    setGroupingTagType,
    state,
    toArray
} from './state.js';

// Tag type to DOM container ID mapping (only department and status remain)
const TAG_SELECTOR_IDS = {
    department: 'agentDepartmentTags',
    status: 'agentStatusTags'
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


async function initializeGroups() {
    const orgs = getUserOrgsFromState();

    // Render group switcher (simplified - legacy)
    renderGroupSwitcher();

    // Update sidebar org switcher
    updateOrgSwitcherUI();
    populateOrgDropdown();

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
    const canManage = canManageCanvases();
    const role = getCurrentOrgRole();

    // Update board menu - hide admin-only actions for viewers
    const boardMenu = document.getElementById('board-menu');
    if (boardMenu) {
        const adminActions = ['edit-title', 'add-section'];
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
    if (!Array.isArray(state.computedGroups) || state.computedGroups.length === 0) return;
    state.computedGroups.forEach(group => {
        const groupId = group.id || group.groupId;
        state.collapsedSections[groupId] = true;
        const section = document.querySelector(`[data-group-id="${groupId}"]`);
        section?.classList.add('collapsed');
    });
    saveCollapsedState();
    updateCollapseAllButton();
}

function expandAll() {
    if (!Array.isArray(state.computedGroups) || state.computedGroups.length === 0) return;
    state.computedGroups.forEach(group => {
        const groupId = group.id || group.groupId;
        state.collapsedSections[groupId] = false;
        const section = document.querySelector(`[data-group-id="${groupId}"]`);
        section?.classList.remove('collapsed');
    });
    saveCollapsedState();
    updateCollapseAllButton();
}

function toggleCollapseAll() {
    if (!Array.isArray(state.computedGroups) || state.computedGroups.length === 0) return;
    const allCollapsed = state.computedGroups.every(group => {
        const groupId = group.id || group.groupId;
        return state.collapsedSections[groupId] === true;
    });
    if (allCollapsed) {
        expandAll();
    } else {
        collapseAll();
    }
}

function updateCollapseAllButton() {
    if (!Array.isArray(state.computedGroups) || state.computedGroups.length === 0) return;

    const btn = document.getElementById('collapseAllBtn');
    const text = document.getElementById('collapseAllText');
    const icon = document.getElementById('collapseAllIcon');

    if (!btn || !text || !icon) return;

    const allCollapsed = state.computedGroups.every(group => {
        const groupId = group.id || group.groupId;
        return state.collapsedSections[groupId] === true;
    });
    text.textContent = allCollapsed ? 'Expand All' : 'Collapse All';
    icon.setAttribute('data-lucide', allCollapsed ? 'chevrons-up' : 'chevrons-down');
    refreshIcons();
}

// ----- Agent modal helpers -----

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

    // Populate tag selectors with clickable options (department and status only)
    populateTagSelector('agentDepartmentTags', 'department', agent.department);
    populateTagSelector('agentStatusTags', 'status', agent.status);

    // Populate phase input if present
    const phaseInput = document.getElementById('agentPhase');
    if (phaseInput) phaseInput.value = agent.phase || '';

    refreshIcons();
}

function buildAgentDraftFromForm() {
    const form = document.getElementById('agentForm');
    if (!form) return null;

    const baseAgent = deepClone(state.agentModalOriginal || {});

    const draft = { ...baseAgent };
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

    // UI metrics are strings; Convex metrics are numeric { adoption, satisfaction }
    const usageThisWeek = document.getElementById('metricsUsage').value;
    const timeSaved = document.getElementById('metricsTimeSaved').value;
    draft.metrics = {
        adoption: parseFloat(usageThisWeek) || 0,
        satisfaction: parseFloat(timeSaved) || 0
    };

    // ROI contribution is now a first-class field
    draft.roiContribution = baseAgent.roiContribution || 'Medium';

    // Collect department and status from tag selectors
    const departmentValue = getSelectedTagValue('agentDepartmentTags');
    draft.department = departmentValue || undefined;
    
    const statusValue = getSelectedTagValue('agentStatusTags');
    draft.status = statusValue || undefined;

    // Phase (for grouping)
    const phaseInput = document.getElementById('agentPhase');
    const defaultPhase = form.dataset.defaultPhase || '';
    const nextPhase = (phaseInput?.value || defaultPhase || baseAgent.phase || '').trim();
    if (nextPhase) draft.phase = nextPhase;

    return draft;
}

// ----- Config load/save -----
async function loadConfig(canvasRef = state.currentCanvasId) {
    try {
        const currentOrg = getCurrentOrg();
        if (!currentOrg) {
            throw new Error('No organization selected');
        }
        if (!canvasRef) {
            throw new Error('No canvas selected');
        }

        // Get canvas from Convex (canvasId only - no slug fallback)
        const canvas = await getConvexClient().query("canvases:get", { canvasId: canvasRef });
        if (!canvas) {
            throw new Error(`Canvas not found`);
        }

        // Get agents for this canvas
        const agents = await getConvexClient().query("agents:list", { canvasId: canvas._id });
        
        // Get org settings for toolsConfig and sectionDefaults
        const orgSettings = await getConvexClient()
            .query("orgSettings:get", { workosOrgId: canvas.workosOrgId })
            .catch(() => null);
        state.orgSettings = orgSettings;
        
        // Store canvas + agents as the canonical frontend state
        state.currentCanvas = canvas;
        state.agents = agents;

        // Store canvas ID for future operations / persistence
        state.currentCanvasId = canvas._id;
        
        return { canvas, agents, orgSettings };
    } catch (error) {
        console.error('Error loading config:', error);
        document.getElementById('agentGroupsContainer').innerHTML =
            '<p class="empty-state-message">Error loading canvas</p>';
        throw error;
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

    // Status color based on status field
    const statusTag = agent.status || 'active';
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
        <article class="agent-card ${staggerClass}" data-agent-id="${agent._id}" data-group-index="${groupIndex}" data-agent-index="${agentIndex}">
            <div class="agent-card__status-strip" style="--status-color: ${statusColor};"></div>

            <header class="agent-card__header">
                <span class="agent-card__number">${String((agent.agentOrder ?? agentIndex) + 1).padStart(2, '0')}</span>
                <div class="agent-card__title">
                    <h3 class="agent-card__name">${agent.name || 'Untitled Agent'}</h3>
                </div>
                <button type="button" class="agent-card__menu" data-menu-trigger="${agentMenuId}" title="Agent options">
                    <i data-lucide="more-horizontal"></i>
                </button>
                <div class="context-menu" id="${agentMenuId}">
                    <div class="context-menu__item" data-action-type="agent-edit" data-agent-id="${agent._id}">
                        <i data-lucide="edit-3"></i>
                        <span>Edit Agent</span>
                    </div>
                    <div class="context-menu__divider"></div>
                    <div class="context-menu__item context-menu__item--danger" data-action-type="agent-delete" data-agent-id="${agent._id}">
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
    // Define which tags to show and their rendering (only department and status remain)
    const tagConfigs = [
        { type: 'department', show: agent.department },
        { type: 'status', show: agent.status && agent.status !== 'active', useStatusDot: true }
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
    const groupingTag = getGroupingTagType();
    const sectionMenuActions = [
        {
            icon: 'plus',
            label: 'Add Agent',
            dataAttrs: `data-action-type="agent-add" data-group-index="${groupIndex}"`
        }
    ];
    if (groupingTag === 'phase') {
        sectionMenuActions.push(
            { type: 'divider' },
            {
                icon: 'edit-3',
                label: 'Rename Section',
                dataAttrs: `data-action-type="phase-rename" data-group-index="${groupIndex}"`
            }
        );
    }
    const sectionMenuTrigger = canManageCanvases() ? renderContextMenuTrigger({
        menuId: `section-menu-${groupIndex}`,
        title: 'Group options',
        stopPropagation: true,
        actions: sectionMenuActions
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
    // Get agents from canonical Convex-native state
    const agents = state.agents || [];

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
    const title = state.currentCanvas?.title || 'AgentCanvas';
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

// ----- Agent modal handlers -----
function openEditAgentModal(agentId) {
    const agent = (state.agents || []).find(a => a._id === agentId);
    if (!agent) {
        alert('Agent not found.');
        return;
    }
    showAgentModal(agent, { agentId });
}

function openAddAgentModal(groupIndex) {
    const groupingTag = getGroupingTagType();
    const group = Number.isFinite(groupIndex) ? state.computedGroups?.[groupIndex] : null;
    const defaultPhase = groupingTag === 'phase' && group?.id ? String(group.id) : '';

    const newAgent = {
        name: '',
        objective: '',
        description: '',
        tools: [],
        journeySteps: [],
        department: undefined,
        status: undefined,
        phase: defaultPhase,
        metrics: undefined,
        roiContribution: 'Medium'
    };

    showAgentModal(newAgent, { agentId: null, defaultPhase });
}

function showAgentModal(agent, { agentId = null, defaultPhase = '' } = {}) {
    const isNew = !agentId;
    const modal = document.getElementById('agentModal');
    const form = document.getElementById('agentForm');

    document.getElementById('modalAgentTitle').textContent = isNew ? 'Add Agent' : 'Edit Agent';
    state.agentModalOriginal = deepClone(agent);
    populateAgentFormFields(state.agentModalOriginal);

    // Show/hide delete button
    const deleteBtn = document.getElementById('deleteAgentBtn');
    if (deleteBtn) {
        deleteBtn.style.display = isNew ? 'none' : 'inline-flex';
    }

    // Store context for save
    form.dataset.agentId = agentId || '';
    form.dataset.originalPhase = (agent?.phase || '').trim();
    form.dataset.defaultPhase = (defaultPhase || '').trim();

    modal.classList.add('show');
}

function closeAgentModal() {
    state.agentModalOriginal = null;
    const form = document.getElementById('agentForm');
    if (form) {
        delete form.dataset.agentId;
        delete form.dataset.originalPhase;
        delete form.dataset.defaultPhase;
    }
    document.getElementById('agentModal')?.classList.remove('show');
}

function getNextAgentOrderForPhase(phase) {
    const orders = (state.agents || [])
        .filter(a => !a.deletedAt && (a.phase || 'Uncategorized') === phase)
        .map(a => a.agentOrder ?? 0);
    const maxOrder = orders.length ? Math.max(...orders) : -1;
    return maxOrder + 1;
}

function getPhaseOrderForPhase(phase) {
    const samePhase = (state.agents || []).find(a => !a.deletedAt && (a.phase || 'Uncategorized') === phase);
    if (samePhase && Number.isFinite(samePhase.phaseOrder)) return samePhase.phaseOrder;
    const phaseOrders = (state.agents || [])
        .filter(a => !a.deletedAt)
        .map(a => a.phaseOrder ?? 0);
    const max = phaseOrders.length ? Math.max(...phaseOrders) : -1;
    return max + 1;
}

async function saveAgent() {
    const form = document.getElementById('agentForm');
    if (!form) return;

    const agentId = (form.dataset.agentId || '').trim();
    const isNew = !agentId;

    const originalPhase = (form.dataset.originalPhase || '').trim();
    const draft = buildAgentDraftFromForm();
    if (!draft) return;

    const phase = (draft.phase || originalPhase || 'Uncategorized').trim() || 'Uncategorized';

    // Disable save button and show loading state
    const saveBtn = document.getElementById('agentSaveBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader-2"></i> Saving...';
        saveBtn.classList.add('btn-loading');
        refreshIcons();
    }
    showLoadingOverlay('Saving...');

    try {
        if (isNew) {
            const phaseOrder = getPhaseOrderForPhase(phase);
            const agentOrder = getNextAgentOrderForPhase(phase);
            await createAgentMutation({
                canvasId: state.currentCanvasId,
                phase,
                phaseOrder,
                agentOrder,
                name: draft.name,
                objective: draft.objective || undefined,
                description: draft.description || undefined,
                tools: draft.tools || [],
                journeySteps: draft.journeySteps || [],
                metrics: draft.metrics,
                roiContribution: draft.roiContribution,
                department: draft.department,
                status: draft.status,
            });
        } else {
            const phaseChanged = phase !== (originalPhase || '');
            const updates = {
                phase,
                name: draft.name,
                objective: draft.objective || undefined,
                description: draft.description || undefined,
                tools: draft.tools || [],
                journeySteps: draft.journeySteps || [],
                metrics: draft.metrics,
                roiContribution: draft.roiContribution,
                department: draft.department,
                status: draft.status,
            };

            if (phaseChanged) {
                updates.phaseOrder = getPhaseOrderForPhase(phase);
                updates.agentOrder = getNextAgentOrderForPhase(phase);
            }

            await updateAgentMutation(agentId, updates);
        }

        await loadConfig(state.currentCanvasId);
        renderAgentGroups();
        closeAgentModal();
    } catch (error) {
        console.error('Agent save failed:', error);
        alert('Failed to save agent: ' + (error.message || 'Unknown error'));
    } finally {
        hideLoadingOverlay();
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="save"></i> Save';
            saveBtn.classList.remove('btn-loading');
            refreshIcons();
        }
    }
}

async function deleteAgent(agentId = null) {
    const id = (agentId || '').trim();
    if (!id) return;
    const agent = (state.agents || []).find(a => a._id === id);
    const label = agent?.name ? `"${agent.name}"` : 'this agent';
    if (!confirm(`Are you sure you want to delete ${label}?`)) return;

    try {
        showLoadingOverlay('Deleting...');
        await deleteAgentMutation(id);
        await loadConfig(state.currentCanvasId);
        renderAgentGroups();
        closeAgentModal();
    } catch (error) {
        console.error('Agent delete failed:', error);
        alert('Failed to delete agent: ' + (error.message || 'Unknown error'));
    } finally {
        hideLoadingOverlay();
    }
}

// ----- Phase/section handlers -----
function openAddSectionModal() {
    const userInput = prompt('Section name:', '');
    if (userInput === null) return;

    const phaseName = userInput.trim();
    if (!phaseName) {
        alert('Section name is required.');
        return;
    }

    const newAgent = {
        name: '',
        objective: '',
        description: '',
        tools: [],
        journeySteps: [],
        department: undefined,
        status: undefined,
        phase: phaseName,
        metrics: undefined,
        roiContribution: 'Medium'
    };

    showAgentModal(newAgent, { agentId: null, defaultPhase: phaseName });
}

async function renamePhaseFromGroup(groupIndex) {
    const group = state.computedGroups?.[groupIndex];
    const fromPhase = (group?.id || '').toString().trim();
    if (!fromPhase) return;

    const userInput = prompt('Rename section:', fromPhase);
    if (userInput === null) return;

    const toPhase = userInput.trim();
    if (!toPhase) {
        alert('Section name is required.');
        return;
    }

    if (toPhase === fromPhase) return;

    try {
        showLoadingOverlay('Renaming section...');
        await getConvexClient().mutation("agents:renamePhase", {
            canvasId: state.currentCanvasId,
            fromPhase,
            toPhase
        });
        await loadConfig(state.currentCanvasId);
        renderAgentGroups();
    } catch (error) {
        console.error('Phase rename failed:', error);
        alert('Failed to rename section: ' + (error.message || 'Unknown error'));
    } finally {
        hideLoadingOverlay();
    }
}

// ----- Title modal handlers -----
function openEditTitleModal() {
    const modal = document.getElementById('titleModal');
    const input = document.getElementById('documentTitleInput');

    // Set current title or default
    const currentTitle = state.currentCanvas?.title || 'AgentCanvas';
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

    getConvexClient()
        .mutation("canvases:update", { canvasId: state.currentCanvasId, title: newTitle })
        .then(() => {
            if (state.currentCanvas) state.currentCanvas.title = newTitle;
            document.getElementById('documentTitle').textContent = newTitle;
            closeTitleModal();
        })
        .catch((error) => {
            console.error('Title update failed:', error);
            alert('Failed to update title: ' + (error.message || 'Unknown error'));
        })
        .finally(() => {
            hideLoadingOverlay();
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="save"></i> Save';
                saveBtn.classList.remove('btn-loading');
                refreshIcons();
            }
        });
}

// Full YAML editor removed (Convex-native storage is canonical)

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
            const userAvatar = document.getElementById('userAvatar');
            const userName = getUserName() || 'User';
            if (userDisplayName) userDisplayName.textContent = userName;
            if (userEmail) userEmail.textContent = getUserEmail() || '';
            if (userAvatar) userAvatar.textContent = userName.charAt(0).toUpperCase();

            // Bind user menu events
            bindUserMenuEvents();

            // Bind sidebar events
            bindSidebarEvents();

            // Initialize groups/orgs
            await initializeGroups();

            // Update role-based UI visibility
            updateRoleBasedUI();

            // Listen for org changes to update UI
            window.addEventListener('orgChanged', updateRoleBasedUI);

            // Listen for document list changes to update sidebar
            window.addEventListener('canvasesChanged', renderCanvasList);
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
            actionSelector: '[data-action]',
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

// ----- Sidebar events -----
function bindSidebarEvents() {
    // Import createBlankCanvas and triggerCanvasUpload from canvases.js
    import('./canvases.js').then(({ createBlankDocument, triggerDocumentUpload }) => {
        // New Canvas button in sidebar
        const newCanvasBtn = document.getElementById('newCanvasBtn');
        newCanvasBtn?.addEventListener('click', createBlankDocument);

        // Import Canvas button in sidebar
        const importCanvasBtn = document.getElementById('importCanvasBtn');
        importCanvasBtn?.addEventListener('click', triggerDocumentUpload);

        // Empty state create button
        const emptyStateNewBtn = document.getElementById('emptyStateNewBtn');
        emptyStateNewBtn?.addEventListener('click', createBlankDocument);
    });

    // Org switcher in sidebar
    const orgTrigger = document.getElementById('orgSwitcherTrigger');
    const orgDropdown = document.getElementById('orgDropdown');
    if (orgTrigger && orgDropdown) {
        bindToggleMenu({
            buttonEl: orgTrigger,
            menuEl: orgDropdown,
            actionSelector: '[data-org-id]',
            onAction: async (action) => {
                // action is the org ID
                setCurrentOrgId(action);
                await refreshDocumentList();
                await loadAgents();
                renderCanvasList();
                updateOrgSwitcherUI();
            }
        });
    }

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    sidebarToggle?.addEventListener('click', () => {
        sidebar?.classList.toggle('is-collapsed');
    });

    // Board menu (canvas title dropdown)
    const boardTrigger = document.getElementById('boardMenuTrigger');
    const boardMenu = document.getElementById('board-menu');
    if (boardTrigger && boardMenu) {
        bindToggleMenu({
            buttonEl: boardTrigger,
            menuEl: boardMenu,
            actionSelector: '[data-board-action]',
            onAction: (action) => {
                if (action === 'edit-title') {
                    openEditTitleModal();
                } else if (action === 'add-section') {
                    openAddSectionModal();
                }
            }
        });
    }

    // Document menu (more options)
    const docMenuBtn = document.getElementById('documentMenuBtn');
    const docMenu = document.getElementById('documentMenu');
    if (docMenuBtn && docMenu) {
        import('./canvases.js').then(({ renameCurrentDocument, deleteCurrentDocument }) => {
            bindToggleMenu({
                buttonEl: docMenuBtn,
                menuEl: docMenu,
                actionSelector: '[data-action]',
                onAction: (action) => {
                    if (action === 'rename') renameCurrentDocument();
                    else if (action === 'delete') deleteCurrentDocument();
                }
            });
        });
    }

    // Grouping control dropdown
    const groupingControl = document.getElementById('groupingControl');
    const groupingBtn = document.getElementById('groupingValue');
    const groupingDropdown = document.getElementById('groupingDropdown');
    if (groupingBtn && groupingDropdown) {
        bindToggleMenu({
            buttonEl: groupingBtn,
            menuEl: groupingDropdown,
            actionSelector: '[data-tag-type]',
            onAction: (tagType) => {
                // Update active state
                groupingDropdown.querySelectorAll('[data-tag-type]').forEach(i => i.classList.remove('is-active'));
                const item = groupingDropdown.querySelector(`[data-tag-type="${tagType}"]`);
                item?.classList.add('is-active');

                // Update displayed value
                const label = item?.querySelector('span')?.textContent || tagType;
                const valueSpan = groupingBtn?.querySelector('span');
                if (valueSpan) valueSpan.textContent = label;

                // Update grouping and re-render
                setGroupingTagType(tagType);
                renderAgentGroups();
            }
        });
    }
}

// Update toolbar UI based on canvas selection state
function updateToolbarUI() {
    const titleGroup = document.querySelector('.toolbar__title-group');
    const titleEl = document.getElementById('documentTitle');
    const agentCountBadge = document.getElementById('agent-count');
    const groupingControl = document.getElementById('groupingControl');
    const collapseBtn = document.getElementById('collapseAllBtn');
    const docMenuBtn = document.getElementById('documentMenuBtn');

    const docs = state.availableDocuments || [];
    const currentDocName = state.currentDocumentName;
    const hasCanvas = currentDocName && docs.length > 0;

    // Find current canvas to get its title
    const currentCanvas = docs.find(d => (d.id || d.slug || d.name) === currentDocName);
    const canvasTitle = currentCanvas?.title || currentCanvas?.name || currentDocName;

    if (hasCanvas && canvasTitle) {
        // Show toolbar elements when canvas is selected
        if (titleGroup) titleGroup.style.display = '';
        if (titleEl) titleEl.textContent = canvasTitle;
        if (agentCountBadge) agentCountBadge.style.display = '';
        if (groupingControl) groupingControl.style.display = '';
        if (collapseBtn) collapseBtn.style.display = '';
        if (docMenuBtn) docMenuBtn.style.display = '';
    } else {
        // Hide toolbar elements when no canvas selected
        if (titleGroup) titleGroup.style.display = 'none';
        if (agentCountBadge) agentCountBadge.style.display = 'none';
        if (groupingControl) groupingControl.style.display = 'none';
        if (collapseBtn) collapseBtn.style.display = 'none';
        if (docMenuBtn) docMenuBtn.style.display = 'none';
    }
}

// Render the canvas list in the sidebar
export function renderCanvasList() {
    const container = document.getElementById('canvasList');
    const emptyState = document.getElementById('emptyState');
    const agentGroupsContainer = document.getElementById('agentGroupsContainer');

    if (!container) return;

    const docs = state.availableDocuments || [];
    const currentDocName = state.currentDocumentName;

    // Update toolbar based on selection state
    updateToolbarUI();

    if (docs.length === 0) {
        container.innerHTML = `
            <div class="sidebar__empty-message" style="padding: var(--space-3); color: var(--text-muted); font-size: var(--text-sm);">
                No canvases yet
            </div>
        `;
        // Show empty state, hide agent groups
        if (emptyState) emptyState.style.display = '';
        if (agentGroupsContainer) agentGroupsContainer.style.display = 'none';
        return;
    }

    // Hide empty state when we have canvases and one is selected
    const hasSelection = currentDocName && docs.some(d => (d.id || d.slug || d.name) === currentDocName);
    if (emptyState) emptyState.style.display = hasSelection ? 'none' : '';
    if (agentGroupsContainer) agentGroupsContainer.style.display = hasSelection ? '' : 'none';

    container.innerHTML = docs.map(doc => {
        const docId = doc.id || doc.slug || doc.name;
        const docTitle = doc.title || doc.name || doc.slug || doc.id;
        const isActive = docId === currentDocName;
        return `
            <button type="button" class="sidebar__canvas-item ${isActive ? 'is-active' : ''}" data-canvas-id="${docId}">
                <i data-lucide="layout-grid"></i>
                <span>${docTitle}</span>
            </button>
        `;
    }).join('');

    // Bind click handlers
    container.querySelectorAll('.sidebar__canvas-item').forEach(btn => {
        btn.addEventListener('click', async () => {
            const canvasId = btn.dataset.canvasId;
            if (canvasId && canvasId !== state.currentDocumentName) {
                showLoadingOverlay(`Loading "${canvasId}"...`);
                try {
                    const { setActiveDocumentName } = await import('./canvases.js');
                    setActiveDocumentName(canvasId);
                    await loadAgents(canvasId);
                    renderCanvasList(); // Update active state
                } catch (err) {
                    console.error('Failed to load canvas:', err);
                } finally {
                    hideLoadingOverlay();
                }
            }
        });
    });

    refreshIcons();
}

// Update the org switcher UI
function updateOrgSwitcherUI() {
    const orgNameEl = document.getElementById('currentOrgName');
    const currentOrg = getCurrentOrg();
    if (orgNameEl && currentOrg) {
        orgNameEl.textContent = currentOrg.name || currentOrg.id || 'Organization';
    }
}

// Populate org dropdown
function populateOrgDropdown() {
    const dropdown = document.getElementById('orgDropdown');
    const orgs = getUserOrgsFromState();
    const currentOrgId = getCurrentOrgId();

    if (!dropdown || orgs.length === 0) return;

    dropdown.innerHTML = orgs.map(org => `
        <div class="sidebar__dropdown-item ${org.id === currentOrgId ? 'is-active' : ''}" data-org-id="${org.id}">
            <i data-lucide="building-2"></i>
            <span>${org.name || org.id}</span>
        </div>
    `).join('');

    refreshIcons();
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
        } else if (type === 'add-section') {
            openAddSectionModal();
        }
    });

    document.getElementById('agentModalClose')?.addEventListener('click', closeAgentModal);
    document.getElementById('agentCancelBtn')?.addEventListener('click', closeAgentModal);
    document.getElementById('agentSaveBtn')?.addEventListener('click', saveAgent);
    document.getElementById('deleteAgentBtn')?.addEventListener('click', () => {
        const form = document.getElementById('agentForm');
        const agentId = (form?.dataset.agentId || '').trim();
        if (agentId) deleteAgent(agentId);
    });

    document.getElementById('titleModalClose')?.addEventListener('click', closeTitleModal);
    document.getElementById('titleModalCancel')?.addEventListener('click', closeTitleModal);
    document.getElementById('titleModalSave')?.addEventListener('click', saveTitleEdit);
    document.getElementById('titleForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTitleEdit();
    });

    agentGroupsContainer?.addEventListener('click', event => {
        const actionBtn = event.target.closest('[data-action-type]');
        if (actionBtn) {
            event.preventDefault();
            closeAllContextMenus();
            const type = actionBtn.dataset.actionType;
            const agentId = actionBtn.dataset.agentId || null;
            const g = actionBtn.dataset.groupIndex !== undefined
                ? parseInt(actionBtn.dataset.groupIndex, 10)
                : null;
            switch (type) {
                case 'agent-edit':
                    if (agentId) openEditAgentModal(agentId);
                    break;
                case 'agent-delete':
                    if (agentId) deleteAgent(agentId);
                    break;
                case 'agent-add':
                    if (g !== null) openAddAgentModal(g);
                    break;
                case 'phase-rename':
                    if (g !== null) renamePhaseFromGroup(g);
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
