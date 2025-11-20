// ----- State and utility helpers -----
let configData = null;
let dynamicStyleElement = null;
let currentDocumentName = null;
let availableDocuments = [];
let documentListLoaded = false;
let agentModalViewMode = 'form';
let groupModalViewMode = 'form';
let agentModalOriginal = null;
let groupModalOriginal = null;
let documentMenuBound = false;
let collapsedSections = {}; // Track which sections are collapsed

const DEFAULT_DOCUMENT_NAME = 'config.yaml';
const DOCUMENT_STORAGE_KEY = 'tps-active-config-doc';
const COLLAPSED_SECTIONS_KEY = 'tps-collapsed-sections';
const BLANK_DOCUMENT_TEMPLATE = [
    '# TPS Agent Ecosystem configuration',
    'sectionDefaults:',
    '  color: "#1a5f73"',
    '  iconType: target',
    '  showInFlow: true',
    '  isSupport: false',
    'toolsConfig: {}',
    'agentGroups: []',
    ''
].join('\n');
const defaultAgentMetrics = {
    usageThisWeek: '0',
    timeSaved: '0',
    roiContribution: 'Medium'
};

function getAgentMetrics(agent = {}) {
    return { ...defaultAgentMetrics, ...(agent.metrics || {}) };
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function getGroupFormatting(group, field) {
    const defaults = configData.sectionDefaults || {
        color: '#1a5f73',
        iconType: 'target',
        phaseTagColor: null,
        showInFlow: true,
        isSupport: false
    };

    return group[field] !== undefined ? group[field] : defaults[field];
}

function getGroupClass(group) {
    // Return explicit groupClass if set, otherwise auto-generate from groupId
    if (group.groupClass) {
        return group.groupClass;
    }
    // Auto-generate from groupId: e.g., "sales" -> "group-sales"
    const groupId = group.groupId || slugifyIdentifier(group.groupName) || 'section';
    return `group-${groupId}`;
}

function deepClone(value) {
    if (value === null || value === undefined) {
        return value;
    }
    try {
        return structuredClone(value);
    } catch {
        return JSON.parse(JSON.stringify(value));
    }
}

function slugifyIdentifier(value) {
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

function refreshIcons() {
    if (typeof lucide === 'undefined') {
        return;
    }
    try {
        lucide.createIcons();
    } catch (error) {
        console.warn('Lucide icon refresh failed:', error);
    }
}

function getExistingGroupIdSet(excludeIndex = -1) {
    if (!Array.isArray(configData?.agentGroups)) {
        return new Set();
    }

    return new Set(
        configData.agentGroups
            .map((group, index) => (index === excludeIndex ? null : (group?.groupId || null)))
            .filter(id => typeof id === 'string' && id.trim() !== '')
            .map(id => id.trim())
    );
}

function generateGroupIdFromName(name, excludeIndex = -1) {
    const fallbackBase = `section-${(configData?.agentGroups?.length || 0) + 1}`;
    const baseId = slugifyIdentifier(name) || fallbackBase;
    const existingIds = getExistingGroupIdSet(excludeIndex);

    let candidate = baseId;
    let suffix = 2;
    while (!candidate || existingIds.has(candidate)) {
        candidate = `${baseId}-${suffix++}`;
    }

    return candidate;
}

function ensureGroupHasId(group, groupIndex = -1) {
    if (!group || typeof group !== 'object') {
        return group;
    }

    if (typeof group.groupId === 'string' && group.groupId.trim()) {
        group.groupId = group.groupId.trim();
        return group;
    }

    const fallbackName = group.groupName || `section-${Date.now()}`;
    group.groupId = generateGroupIdFromName(fallbackName, groupIndex);
    return group;
}

// ----- Document management helpers -----
function getStoredDocumentPreference() {
    try {
        return localStorage.getItem(DOCUMENT_STORAGE_KEY);
    } catch (error) {
        console.warn('Unable to read document preference:', error);
        return null;
    }
}

function persistDocumentPreference(name) {
    try {
        if (name) {
            localStorage.setItem(DOCUMENT_STORAGE_KEY, name);
        } else {
            localStorage.removeItem(DOCUMENT_STORAGE_KEY);
        }
    } catch (error) {
        console.warn('Unable to persist document preference:', error);
    }
}

function loadCollapsedState() {
    try {
        const stored = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
        if (stored) {
            collapsedSections = JSON.parse(stored);
        } else {
            collapsedSections = {};
        }
    } catch (error) {
        console.warn('Unable to read collapsed sections:', error);
        collapsedSections = {};
    }
}

function saveCollapsedState() {
    try {
        localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(collapsedSections));
    } catch (error) {
        console.warn('Unable to save collapsed sections:', error);
    }
}

function toggleSectionCollapse(groupId) {
    collapsedSections[groupId] = !collapsedSections[groupId];
    saveCollapsedState();

    // Apply collapse state to DOM
    const section = document.querySelector(`[data-group-id="${groupId}"]`);
    if (section) {
        if (collapsedSections[groupId]) {
            section.classList.add('collapsed');
        } else {
            section.classList.remove('collapsed');
        }
    }
    updateCollapseAllButton();
}

function collapseAll() {
    if (!configData?.agentGroups) return;

    configData.agentGroups.forEach(group => {
        collapsedSections[group.groupId] = true;
        const section = document.querySelector(`[data-group-id="${group.groupId}"]`);
        if (section) {
            section.classList.add('collapsed');
        }
    });

    saveCollapsedState();
    updateCollapseAllButton();
}

function expandAll() {
    if (!configData?.agentGroups) return;

    configData.agentGroups.forEach(group => {
        collapsedSections[group.groupId] = false;
        const section = document.querySelector(`[data-group-id="${group.groupId}"]`);
        if (section) {
            section.classList.remove('collapsed');
        }
    });

    saveCollapsedState();
    updateCollapseAllButton();
}

function toggleCollapseAll() {
    if (!configData?.agentGroups) return;

    // Check if all sections are collapsed using state variable
    const allCollapsed = configData.agentGroups.every(group => collapsedSections[group.groupId] === true);

    if (allCollapsed) {
        expandAll();
    } else {
        collapseAll();
    }
}

function updateCollapseAllButton() {
    if (!configData?.agentGroups || configData.agentGroups.length === 0) return;

    const btn = document.getElementById('collapseAllBtn');
    const text = document.getElementById('collapseAllText');
    const icon = document.getElementById('collapseAllIcon');

    if (!btn || !text || !icon) return;

    // Use state variable as single source of truth
    const allCollapsed = configData.agentGroups.every(group => collapsedSections[group.groupId] === true);

    if (allCollapsed) {
        text.textContent = 'Expand All';
        icon.setAttribute('data-lucide', 'chevrons-up');
    } else {
        text.textContent = 'Collapse All';
        icon.setAttribute('data-lucide', 'chevrons-down');
    }

    refreshIcons();
}

function setActiveDocumentName(name, options = {}) {
    currentDocumentName = name || null;

    if (!options.skipPersist) {
        persistDocumentPreference(currentDocumentName);
    }

    updateDocumentControlsUI();
}

function getDocumentSelectElement() {
    return document.getElementById('documentSelect');
}

function getDocumentMetaElement() {
    return document.getElementById('documentMeta');
}

function getDocumentStatusElement() {
    return document.getElementById('documentStatusMessage');
}

function getDocumentMenuElement() {
    return document.getElementById('documentMenu');
}

function closeDocumentMenu() {
    const menu = getDocumentMenuElement();
    const button = document.getElementById('documentMenuBtn');
    if (menu) {
        menu.classList.remove('open');
    }
    if (button) {
        button.setAttribute('aria-expanded', 'false');
    }
}

function toggleDocumentMenu(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const menu = getDocumentMenuElement();
    const button = document.getElementById('documentMenuBtn');
    if (!menu || !button) return;
    const willOpen = !menu.classList.contains('open');
    if (willOpen) {
        menu.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
    } else {
        closeDocumentMenu();
    }
}

function bindDocumentMenuEvents() {
    if (documentMenuBound) return;
    const menu = getDocumentMenuElement();
    const button = document.getElementById('documentMenuBtn');
    if (!menu || !button) return;

    button.addEventListener('click', toggleDocumentMenu);
    menu.addEventListener('click', event => {
        const actionButton = event.target.closest('button[data-action]');
        if (!actionButton) return;
        event.preventDefault();
        const action = actionButton.dataset.action;
        closeDocumentMenu();
        handleDocumentMenuAction(action);
    });

    document.addEventListener('click', event => {
        const menuEl = getDocumentMenuElement();
        const toggleBtn = document.getElementById('documentMenuBtn');
        if (!menuEl || !menuEl.classList.contains('open')) return;
        if (menuEl.contains(event.target) || toggleBtn.contains(event.target)) {
            return;
        }
        closeDocumentMenu();
    });

    documentMenuBound = true;
}

function handleDocumentMenuAction(action) {
    switch (action) {
        case 'upload':
            triggerDocumentUpload();
            break;
        case 'blank':
            createBlankDocument();
            break;
        case 'rename':
            renameCurrentDocument();
            break;
        case 'download':
            downloadCurrentDocument();
            break;
        case 'delete':
            deleteCurrentDocument();
            break;
        default:
            break;
    }
}

async function createBlankDocument() {
    const defaultName = `document-${availableDocuments.length + 1}.yaml`;
    const userInput = prompt('Name for the new document (.yaml will be appended if missing):', defaultName);
    if (userInput === null) {
        return;
    }

    let docName;
    try {
        docName = sanitizeDocumentNameForClient(userInput);
    } catch (error) {
        alert(error.message);
        return;
    }

    if (availableDocuments.some(doc => doc.name === docName)) {
        if (!confirm(`"${docName}" already exists. Overwrite it with a blank document?`)) {
            return;
        }
    }

    try {
        setDocumentStatusMessage(`Creating "${docName}"...`);
        console.log('[documents] Creating blank document', { docName });
        await uploadDocumentFromContents(docName, BLANK_DOCUMENT_TEMPLATE);
        setDocumentStatusMessage(`Document "${docName}" created.`, 'success');
    } catch (error) {
        console.error('[documents] Blank document creation failed', { docName, error });
        setDocumentStatusMessage('Failed to create document.', 'error');
    }
}

async function renameCurrentDocument() {
    if (!currentDocumentName) {
        alert('Select a document before renaming.');
        return;
    }

    const userInput = prompt('Enter a new name (.yaml will be appended if missing):', currentDocumentName);
    if (userInput === null) {
        return;
    }

    let newDocName;
    try {
        newDocName = sanitizeDocumentNameForClient(userInput);
    } catch (error) {
        alert(error.message);
        return;
    }

    if (newDocName === currentDocumentName) {
        setDocumentStatusMessage('Document name unchanged.');
        return;
    }

    if (availableDocuments.some(doc => doc.name === newDocName)) {
        alert(`A document named "${newDocName}" already exists. Choose a different name.`);
        return;
    }

    try {
        setDocumentStatusMessage(`Renaming to "${newDocName}"...`);
        const response = await fetch(
            `/api/config?doc=${encodeURIComponent(currentDocumentName)}&newDoc=${encodeURIComponent(newDocName)}`,
            { method: 'PUT' }
        );

        if (!response.ok) {
            throw new Error('Rename failed');
        }

        await refreshDocumentList(newDocName);
        await loadAgents(newDocName);
        setDocumentStatusMessage(`Renamed to "${newDocName}".`, 'success');
    } catch (error) {
        console.error('Rename failed:', error);
        alert('Failed to rename document: ' + (error.message || 'Unknown error'));
        setDocumentStatusMessage('Rename failed.', 'error');
    }
}

function updateDocumentControlsUI() {
    const select = getDocumentSelectElement();
    const meta = getDocumentMetaElement();
    const menu = getDocumentMenuElement();

    if (select) {
        select.innerHTML = '';

        if (!documentListLoaded) {
            const option = document.createElement('option');
            option.textContent = 'Loading...';
            option.value = '';
            select.appendChild(option);
            select.disabled = true;
        } else if (!availableDocuments.length) {
            const option = document.createElement('option');
            option.textContent = 'No documents available';
            option.value = '';
            select.appendChild(option);
            select.disabled = true;
        } else {
            availableDocuments.forEach(doc => {
                const option = document.createElement('option');
                option.textContent = doc.name;
                option.value = doc.name;
                select.appendChild(option);
            });
            select.disabled = false;
            if (currentDocumentName && availableDocuments.some(doc => doc.name === currentDocumentName)) {
                select.value = currentDocumentName;
            } else {
                select.value = availableDocuments[0].name;
            }
        }
    }

    if (meta) {
        if (!documentListLoaded) {
            meta.textContent = 'Loading documents...';
        } else if (!availableDocuments.length) {
            meta.textContent = 'No YAML documents found. Upload one to get started.';
        } else if (currentDocumentName) {
            const doc = availableDocuments.find(d => d.name === currentDocumentName);
            if (doc) {
                const sizeText = typeof doc.size === 'number' ? formatBytes(doc.size) : '';
                const updatedText = doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : '';
                const details = [
                    updatedText && `Last updated ${updatedText}`,
                    sizeText && sizeText
                ].filter(Boolean).join(' • ');
                meta.textContent = details || 'Document details unavailable.';
            } else {
                meta.textContent = 'Document details unavailable.';
            }
        } else {
            meta.textContent = 'Select a document to see details.';
        }
    }

    if (menu) {
        const renameBtn = menu.querySelector('button[data-action="rename"]');
        const downloadMenuBtn = menu.querySelector('button[data-action="download"]');
        const deleteBtn = menu.querySelector('button[data-action="delete"]');
        const divider = menu.querySelector('[data-role="menu-divider"]');
        const hasDocument = Boolean(currentDocumentName);
        const isLastDocument = availableDocuments.length <= 1;

        if (renameBtn) {
            renameBtn.disabled = !hasDocument;
        }
        if (downloadMenuBtn) {
            downloadMenuBtn.disabled = !hasDocument;
        }
        if (deleteBtn) {
            // Disable if no document or if it's the last one
            deleteBtn.disabled = !hasDocument || isLastDocument;
            if (isLastDocument && hasDocument) {
                deleteBtn.title = 'Cannot delete the last document';
            } else {
                deleteBtn.title = 'Delete current document';
            }
        }
        if (divider) {
            divider.style.display = hasDocument ? 'block' : 'none';
        }
    }

    refreshIcons();
}

function formatBytes(bytes = 0) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function setDocumentStatusMessage(message, type = 'info') {
    const statusEl = getDocumentStatusElement();
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.dataset.state = type;
}

function sanitizeDocumentNameForClient(name) {
    if (!name) {
        throw new Error('Document name is required.');
    }
    let normalized = name.trim();
    if (!normalized.endsWith('.yaml')) {
        normalized += '.yaml';
    }
    const isValid = /^[A-Za-z0-9._-]+\.yaml$/.test(normalized);
    if (!isValid) {
        throw new Error('Invalid document name. Use letters, numbers, dots, dashes, or underscores.');
    }
    return normalized;
}

async function refreshDocumentList(preferredDocName) {
    try {
        setDocumentStatusMessage('Loading documents...');
        const response = await fetch('/api/config?list=1', {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch document list');
        }

        const data = await response.json();
        availableDocuments = Array.isArray(data.documents) ? data.documents : [];
        documentListLoaded = true;

        const docNames = availableDocuments.map(doc => doc.name);
        let nextDoc = preferredDocName || currentDocumentName || getStoredDocumentPreference();

        if (!nextDoc && docNames.length) {
            nextDoc = docNames.includes(DEFAULT_DOCUMENT_NAME) ? DEFAULT_DOCUMENT_NAME : docNames[0];
        }

        if (nextDoc && !docNames.includes(nextDoc) && docNames.length) {
            nextDoc = docNames[0];
        }

        setActiveDocumentName(nextDoc, { skipPersist: false });
        setDocumentStatusMessage('');
    } catch (error) {
        console.error('Error listing documents:', error);
        availableDocuments = [];
        documentListLoaded = true;
        setActiveDocumentName(null, { skipPersist: true });
        setDocumentStatusMessage('Unable to load documents. Upload a YAML file to create one.', 'error');
    } finally {
        updateDocumentControlsUI();
    }
}

async function initializeDocumentControls() {
    const fileInput = document.getElementById('documentFileInput');
    if (fileInput && !fileInput.dataset.bound) {
        fileInput.addEventListener('change', handleDocumentFileSelected);
        fileInput.dataset.bound = 'true';
    }

    bindDocumentMenuEvents();
    await refreshDocumentList();
}

async function handleDocumentSelection(event) {
    const selectedDoc = event.target.value;
    if (!selectedDoc || selectedDoc === currentDocumentName) {
        return;
    }

    setActiveDocumentName(selectedDoc);
    setDocumentStatusMessage(`Loaded document "${selectedDoc}".`, 'success');
    await loadAgents(selectedDoc);
}

function triggerDocumentUpload() {
    const input = document.getElementById('documentFileInput');
    if (input) {
        input.click();
    }
}

async function handleDocumentFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
        return;
    }

    let suggestedName = file.name || DEFAULT_DOCUMENT_NAME;
    try {
        suggestedName = sanitizeDocumentNameForClient(suggestedName);
    } catch {
        suggestedName = DEFAULT_DOCUMENT_NAME;
    }

    const userInput = prompt('Enter a name for this YAML document (.yaml will be appended if missing):', suggestedName);
    if (userInput === null) {
        return; // user cancelled
    }

    let docName;
    try {
        docName = sanitizeDocumentNameForClient(userInput);
    } catch (error) {
        alert(error.message);
        return;
    }

    try {
        const contents = await file.text();
        await uploadDocumentFromContents(docName, contents);
    } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload document: ' + (error.message || 'Unknown error'));
    }
}

async function uploadDocumentFromContents(docName, yamlText) {
    const payloadSize = typeof yamlText === 'string' ? yamlText.length : 0;
    console.log(`[documents] Upload requested for ${docName} (${payloadSize} bytes)`);
    if (!payloadSize) {
        console.warn('[documents] Warning: upload payload is empty string');
    }
    setDocumentStatusMessage(`Uploading "${docName}"...`);

    const response = await fetch(`/api/config?doc=${encodeURIComponent(docName)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/yaml',
            'X-Config-Name': docName
        },
        body: yamlText
    });

    if (!response.ok) {
        let errorDetail = '';
        try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await response.json();
                errorDetail = data?.error || JSON.stringify(data);
            } else {
                errorDetail = await response.text();
            }
        } catch (parseError) {
            errorDetail = `Unable to parse error body: ${parseError.message}`;
        }

        console.error('[documents] Upload failed', {
            docName,
            status: response.status,
            statusText: response.statusText,
            errorDetail
        });

        throw new Error(errorDetail || `Upload failed with status ${response.status}`);
    }

    await refreshDocumentList(docName);
    setActiveDocumentName(docName);
    await loadAgents(docName);

    setDocumentStatusMessage(`Document "${docName}" uploaded and loaded.`, 'success');
}

async function downloadCurrentDocument() {
    if (!currentDocumentName) {
        alert('No document selected to download.');
        return;
    }

    try {
        const response = await fetch(`/api/config?doc=${encodeURIComponent(currentDocumentName)}`);
        if (!response.ok) {
            throw new Error('Download failed');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = currentDocumentName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download document: ' + (error.message || 'Unknown error'));
    }
}

async function deleteCurrentDocument() {
    if (!currentDocumentName) {
        alert('No document selected to delete.');
        return;
    }

    // Prevent deleting the last document
    if (availableDocuments.length <= 1) {
        alert('Cannot delete the last document. At least one document must remain.');
        return;
    }

    // Confirm deletion
    const confirmed = confirm(
        `Are you sure you want to permanently delete "${currentDocumentName}"?\n\n` +
        `This action cannot be undone.`
    );

    if (!confirmed) {
        return;
    }

    try {
        setDocumentStatusMessage(`Deleting "${currentDocumentName}"...`);
        const response = await fetch(
            `/api/config?doc=${encodeURIComponent(currentDocumentName)}`,
            { method: 'DELETE' }
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Delete failed');
        }

        // Find a new document to load (first one that's not the deleted one)
        const remainingDocs = availableDocuments.filter(doc => doc.name !== currentDocumentName);
        const nextDoc = remainingDocs.length > 0 ? remainingDocs[0].name : null;

        // Refresh list and load next document
        await refreshDocumentList(nextDoc);
        if (nextDoc) {
            await loadAgents(nextDoc);
            setDocumentStatusMessage(`Document "${currentDocumentName}" deleted successfully.`, 'success');
        } else {
            setDocumentStatusMessage('Document deleted. No documents remaining.', 'success');
        }

    } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete document: ' + (error.message || 'Unknown error'));
        setDocumentStatusMessage('Delete failed.', 'error');
    }
}

// ----- Modal YAML view helpers -----
function setElementText(elementId, text = '') {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = text;
    }
}

async function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        return false;
    }
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.warn('Clipboard copy failed:', error);
        return false;
    }
}

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
        Object.keys(configData?.toolsConfig || {}).forEach(toolName => {
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
    const groupSource = options.group || groupModalOriginal || {};
    const configGroup = isExistingGroup && Array.isArray(configData?.agentGroups)
        ? configData.agentGroups[groupIndex]
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
    const baseAgent = deepClone(agentModalOriginal || {});
    const group = configData?.agentGroups?.[groupIndex];

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
    const baseGroup = deepClone(groupModalOriginal || {});

    const draft = { ...baseGroup };
    draft.groupNumber = isNew
        ? configData?.agentGroups?.length || 0
        : (baseGroup.groupNumber ?? configData.agentGroups[groupIndex].groupNumber);
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
        draft.agents = configData.agentGroups[groupIndex].agents;
    }

    return draft;
}

function syncAgentStateFromForm() {
    const draft = buildAgentDraftFromForm();
    if (!draft) return false;
    agentModalOriginal = draft;
    return true;
}

function syncGroupStateFromForm() {
    const draft = buildGroupDraftFromForm();
    if (!draft) return false;
    groupModalOriginal = draft;
    return true;
}

function updateAgentYamlEditor() {
    const textarea = document.getElementById('agentYamlInput');
    if (!textarea) return;
    textarea.value = window.jsyaml.dump(agentModalOriginal || {});
    setElementText('agentYamlError', '');
    setElementText('agentYamlStatus', '');
}

function updateGroupYamlEditor() {
    const textarea = document.getElementById('groupYamlInput');
    if (!textarea) return;
    textarea.value = window.jsyaml.dump(groupModalOriginal || {});
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
        agentModalOriginal = parsed;
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
        groupModalOriginal = ensureGroupHasId(parsed, groupIndex);
        populateGroupFormFields(groupModalOriginal, { groupIndex });
        setElementText('groupYamlError', '');
        return true;
    } catch (error) {
        setElementText('groupYamlError', error.message);
        return false;
    }
}

const modalViewConfigs = {
    agent: {
        getMode: () => agentModalViewMode,
        setMode: mode => {
            agentModalViewMode = mode;
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
        getMode: () => groupModalViewMode,
        setMode: mode => {
            groupModalViewMode = mode;
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
async function loadConfig(docName = currentDocumentName || DEFAULT_DOCUMENT_NAME) {
    try {
        const url = `/api/config?doc=${encodeURIComponent(docName)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Config request failed: ${response.status}`);
        }
        const yamlText = await response.text();
        configData = window.jsyaml.load(yamlText);
        const resolvedDoc = response.headers.get('X-Config-Document');
        if (resolvedDoc) {
            setActiveDocumentName(resolvedDoc);
        }
        return configData;
    } catch (error) {
        console.error('Error loading config:', error);
        document.getElementById('agentGroupsContainer').innerHTML =
            '<p style="color: white; text-align: center;">Error loading configuration file</p>';
        throw error;
    }
}

async function saveConfig() {
    try {
        const yamlText = window.jsyaml.dump(configData);
        const docName = currentDocumentName || DEFAULT_DOCUMENT_NAME;
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
    if (!dynamicStyleElement) {
        dynamicStyleElement = document.createElement('style');
        dynamicStyleElement.id = 'dynamic-config-styles';
        document.head.appendChild(dynamicStyleElement);
    }

    let css = '';

    // Generate CSS for each group
    config.agentGroups.forEach(group => {
        const color = getGroupFormatting(group, 'color');
        const groupClass = getGroupClass(group);
        css += `
            .${groupClass} .group-header { border-color: ${color}; }
            .${groupClass} .group-icon { background: ${color}; }
        `;
    });

    // Generate CSS for tool chips
    Object.entries(config.toolsConfig).forEach(([toolName, toolConfig]) => {
        css += `
            .${toolConfig.class} { background: ${toolConfig.color}; }
        `;
    });

    dynamicStyleElement.textContent = css;
}

// Template Functions
function createToolChip(toolName, config) {
    const toolConfig = config.toolsConfig[toolName];
    if (!toolConfig) {
        console.warn(`Unknown tool "${toolName}" referenced in config. Available tools:`, Object.keys(config.toolsConfig));
        return `<span class="tool-chip" style="background: #999;" title="Unknown tool: ${toolName}"><i data-lucide="alert-circle"></i> ${toolName}</span>`;
    }
    return `<span class="tool-chip ${toolConfig.class}"><i data-lucide="${toolConfig.icon}"></i> ${toolName}</span>`;
}

function createJourneyTooltip(steps) {
    const stepsList = toArray(steps);
    if (stepsList.length === 0) {
        return '<div class="journey-tooltip"><strong>User Journey:</strong><br>No steps defined</div>';
    }
    const stepsHTML = stepsList.map(step => `→ ${step}`).join('<br>');
    return `<div class="journey-tooltip"><strong>User Journey:</strong><br>${stepsHTML}</div>`;
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

    return `
        <div class="metrics-tooltip">
            <div class="metrics-tooltip-header">
                <h4><i data-lucide="trending-up" style="display: inline-block; width: 18px; height: 18px; vertical-align: middle; margin-right: 6px;"></i>${agent.name}</h4>
            </div>
            <div class="metrics-tooltip-content">
                <div class="metric-row">
                    <div class="metric-label">
                        <span>Usage This Week</span>
                        <span class="metric-value">${metrics.usageThisWeek}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill usage" style="width: ${usagePercent}%;"></div>
                    </div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">
                        <span>Time Saved</span>
                        <span class="metric-value">${metrics.timeSaved}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill time-saved" style="width: ${timeSavedNum}%;"></div>
                    </div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">
                        <span>ROI Contribution</span>
                        <span class="metric-value">${metrics.roiContribution}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill roi-contribution" style="width: ${roiValue}%;"></div>
                    </div>
                </div>
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
    const handoverBadge = agent.badge ? `<span class="handover-badge">${agent.badge}</span>` : '';

    return `
        <div class="agent-card">
            <div class="agent-number">${agent.agentNumber}</div>
            <h3 style="display: flex; align-items: center; gap: 8px;">
                <span>${agent.name}${handoverBadge}</span>
                <div class="context-menu-trigger" onclick="toggleContextMenu(event, 'agent-menu-${groupIndex}-${agentIndex}')" title="Agent options">
                    <i data-lucide="more-vertical"></i>
                    <div class="context-menu" id="agent-menu-${groupIndex}-${agentIndex}">
                        <button type="button" class="context-menu-item" onclick="openEditAgentModal(${groupIndex}, ${agentIndex}); closeAllContextMenus();">
                            <i data-lucide="edit-3"></i>
                            Edit Agent
                        </button>
                        <div class="context-menu-divider"></div>
                        <button type="button" class="context-menu-item danger" onclick="deleteAgent(${groupIndex}, ${agentIndex}); closeAllContextMenus();">
                            <i data-lucide="trash-2"></i>
                            Delete Agent
                        </button>
                    </div>
                </div>
            </h3>
            <div class="agent-objective">Objective: ${agent.objective}</div>
            <div class="agent-description">${agent.description}</div>
            <div class="tools-container">${toolsHTML}</div>
            <div class="icon-panel">
                <div class="icon-panel-item journey-icon">
                    <i data-lucide="map"></i>
                    ${journeyHTML}
                </div>
                <a href="${linkUrl}" ${linkTarget} class="icon-panel-item agent-link-icon" title="${linkTitle}">
                    <i data-lucide="external-link"></i>
                </a>
                <a href="${agent.videoLink || '#'}" class="icon-panel-item video-icon" title="Watch video overview">
                    <i data-lucide="video"></i>
                </a>
                <div class="icon-panel-item metrics-icon">
                    <i data-lucide="trending-up"></i>
                    ${metricsHTML}
                </div>
            </div>
        </div>`;
}

function createAgentGroup(group, config, groupIndex) {
    const color = getGroupFormatting(group, 'color');
    const phaseTagColor = getGroupFormatting(group, 'phaseTagColor');
    const iconType = getGroupFormatting(group, 'iconType');
    const groupClass = getGroupClass(group);

    const agentsHTML = group.agents.map((agent, agentIndex) =>
        createAgentCard(agent, config, groupIndex, agentIndex)
    ).join('');
    const phaseStyle = phaseTagColor ? `style="background: ${phaseTagColor};"` : `style="background: ${color};"`;
    const phaseTagHTML = group.phaseTag ? `<div class="phase-tag-wrapper"><span class="phase-tag" ${phaseStyle}>${group.phaseTag}</span></div>` : '';

    const isCollapsed = collapsedSections[group.groupId] || false;
    const collapsedClass = isCollapsed ? 'collapsed' : '';

    // Create agent name pills for collapsed view
    const maxPills = 5;
    const agentPills = group.agents
        .slice(0, maxPills)
        .filter(agent => agent && agent.name)
        .map(agent => `<span class="agent-name-pill">${agent.name}</span>`)
        .join('');
    const morePill = group.agents.length > maxPills
        ? `<span class="agent-name-pill more-pill">+${group.agents.length - maxPills} more</span>`
        : '';
    const agentPillsHTML = `<div class="agent-pills-container">${agentPills}${morePill}</div>`;

    return `
        <div class="agent-group ${groupClass} ${collapsedClass}" data-group-id="${group.groupId}" data-group-index="${groupIndex}">
            <div class="group-header" onclick="toggleSectionCollapse('${group.groupId}')">
                <div class="group-header-edit">
                    <div style="display: flex; align-items: center; width: 100%;">
                        <div class="section-collapse-toggle">
                            <i data-lucide="chevron-down"></i>
                        </div>
                        <div class="group-icon">
                            <i data-lucide="${iconType}"></i>
                        </div>
                        <div class="group-title" style="display: flex; align-items: center; flex: 1; flex-wrap: wrap; gap: 12px;">
                            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                                <h2 style="display: inline-block; margin: 0;">${group.groupName}</h2>
                                <div class="context-menu-trigger" onclick="event.stopPropagation(); toggleContextMenu(event, 'section-menu-${groupIndex}')" title="Section options">
                                    <i data-lucide="more-vertical"></i>
                                    <div class="context-menu" id="section-menu-${groupIndex}">
                                        <button type="button" class="context-menu-item" onclick="openEditGroupModal(${groupIndex}); closeAllContextMenus();">
                                            <i data-lucide="edit-3"></i>
                                            Edit Section
                                        </button>
                                        <button type="button" class="context-menu-item" onclick="openAddAgentModal(${groupIndex}); closeAllContextMenus();">
                                            <i data-lucide="plus"></i>
                                            Add Agent
                                        </button>
                                        <div class="context-menu-divider"></div>
                                        <button type="button" class="context-menu-item danger" onclick="deleteGroup(${groupIndex}); closeAllContextMenus();">
                                            <i data-lucide="trash-2"></i>
                                            Delete Section
                                        </button>
                                    </div>
                                </div>
                                ${phaseTagHTML}
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
    if (!configData) return;

    // Load collapsed state from localStorage
    loadCollapsedState();

    // Initialize all groups in collapsedSections if not present
    if (configData.agentGroups) {
        configData.agentGroups.forEach(group => {
            if (collapsedSections[group.groupId] === undefined) {
                collapsedSections[group.groupId] = false;
            }
        });
    }

    // Update document title
    const title = configData.documentTitle || 'TPS Operating System';
    document.getElementById('documentTitle').textContent = title;

    // Update agent count
    const totalAgents = configData.agentGroups.reduce((sum, group) => sum + group.agents.length, 0);
    document.getElementById('agent-count').textContent =
        `${totalAgents} AI Agents`;

    // Render all agent groups
    const container = document.getElementById('agentGroupsContainer');
    const groupsHTML = configData.agentGroups.map((group, index) =>
        createAgentGroup(group, configData, index)
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
async function loadAgents(docName = currentDocumentName) {
    if (!docName) {
        const container = document.getElementById('agentGroupsContainer');
        if (container) {
            container.innerHTML =
                '<p style="color: white; text-align: center;">No YAML document selected. Upload or select a document to begin.</p>';
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
    const group = configData.agentGroups[groupIndex];
    const agent = group.agents[agentIndex];

    showAgentModal(agent, groupIndex, agentIndex);
}

function openAddAgentModal(groupIndex) {
    const newAgent = {
        agentNumber: configData.agentGroups[groupIndex].agents.length + 1,
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
    agentModalOriginal = deepClone(agent);
    agentModalViewMode = 'form';
    populateAgentFormFields(agentModalOriginal);
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
    agentModalViewMode = 'form';
    agentModalOriginal = null;
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

    const agent = deepClone(agentModalOriginal || {});
    if (!agent.agentNumber) {
        agent.agentNumber = isNew
            ? configData.agentGroups[groupIndex].agents.length + 1
            : (configData.agentGroups[groupIndex].agents[agentIndex]?.agentNumber || agentIndex + 1);
    }

    if (isNew) {
        configData.agentGroups[groupIndex].agents.push(agent);
    } else {
        configData.agentGroups[groupIndex].agents[agentIndex] = agent;
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

    const agent = configData.agentGroups[groupIndex].agents[agentIndex];
    if (!confirm(`Are you sure you want to delete "${agent.name}"?`)) {
        return;
    }

    configData.agentGroups[groupIndex].agents.splice(agentIndex, 1);

    saveConfig().then(success => {
        if (success) {
            closeAgentModal();
            renderAgentGroups();
        }
    });
}

// ----- Group modal handlers -----
function openEditGroupModal(groupIndex) {
    const group = configData.agentGroups[groupIndex];
    showGroupModal(group, groupIndex);
}

function openAddSectionModal() {
    const newGroup = {
        groupNumber: configData.agentGroups.length,
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
    groupModalOriginal = deepClone(group);
    groupModalViewMode = 'form';
    if (form) {
        form.dataset.groupIndex = groupIndex;
    }
    populateGroupFormFields(groupModalOriginal, { groupIndex });
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
    groupModalViewMode = 'form';
    groupModalOriginal = null;
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

    const group = deepClone(groupModalOriginal || {});
    if (group.groupNumber === undefined || group.groupNumber === null) {
        group.groupNumber = isNew ? configData.agentGroups.length : configData.agentGroups[groupIndex].groupNumber;
    }

    if (isNew) {
        group.agents = Array.isArray(group.agents) ? group.agents : [];
    } else {
        group.agents = configData.agentGroups[groupIndex].agents;
    }

    if (isNew) {
        configData.agentGroups.push(group);
    } else {
        configData.agentGroups[groupIndex] = group;
    }

    saveConfig().then(success => {
        if (success) {
            closeGroupModal();
            renderAgentGroups();
            generateDynamicCSS(configData);
        }
    });
}

function deleteGroup(groupIndex = null) {
    // If called from modal, get index from form
    if (groupIndex === null) {
        const form = document.getElementById('groupForm');
        groupIndex = parseInt(form.dataset.groupIndex);
    }

    const group = configData.agentGroups[groupIndex];
    if (!confirm(`Are you sure you want to delete "${group.groupName}" and all its agents?`)) {
        return;
    }

    configData.agentGroups.splice(groupIndex, 1);

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
    const currentTitle = configData.documentTitle || 'TPS Operating System';
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
    configData.documentTitle = newTitle;

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

document.addEventListener('DOMContentLoaded', bootstrapApp);
