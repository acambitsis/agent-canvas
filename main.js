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

const DEFAULT_DOCUMENT_NAME = 'config.yaml';
const DOCUMENT_STORAGE_KEY = 'tps-active-config-doc';
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
        phaseImage: null,
        showInFlow: true,
        isSupport: false
    };

    return group[field] !== undefined ? group[field] : defaults[field];
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
        await uploadDocumentFromContents(docName, BLANK_DOCUMENT_TEMPLATE);
        setDocumentStatusMessage(`Document "${docName}" created.`, 'success');
    } catch (error) {
        console.error('Blank document creation failed:', error);
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
        const divider = menu.querySelector('[data-role="menu-divider"]');
        const hasDocument = Boolean(currentDocumentName);

        if (renameBtn) {
            renameBtn.disabled = !hasDocument;
        }
        if (downloadMenuBtn) {
            downloadMenuBtn.disabled = !hasDocument;
        }
        if (divider) {
            divider.style.display = hasDocument ? 'block' : 'none';
        }
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
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
        throw new Error('Upload failed');
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
    const formContent = document.getElementById('agentFormContent');
    const yamlContent = document.getElementById('agentYamlContent');
    const formToggle = document.getElementById('agentFormToggle');
    const yamlToggle = document.getElementById('agentYamlToggle');

    if (formContent) {
        formContent.style.display = agentModalViewMode === 'form' ? 'block' : 'none';
    }
    if (yamlContent) {
        yamlContent.style.display = agentModalViewMode === 'yaml' ? 'block' : 'none';
    }
    if (formToggle) {
        formToggle.classList.toggle('active', agentModalViewMode === 'form');
    }
    if (yamlToggle) {
        yamlToggle.classList.toggle('active', agentModalViewMode === 'yaml');
    }
}

function updateGroupModalViewUI() {
    const formContent = document.getElementById('groupFormContent');
    const yamlContent = document.getElementById('groupYamlContent');
    const formToggle = document.getElementById('groupFormToggle');
    const yamlToggle = document.getElementById('groupYamlToggle');

    if (formContent) {
        formContent.style.display = groupModalViewMode === 'form' ? 'block' : 'none';
    }
    if (yamlContent) {
        yamlContent.style.display = groupModalViewMode === 'yaml' ? 'block' : 'none';
    }
    if (formToggle) {
        formToggle.classList.toggle('active', groupModalViewMode === 'form');
    }
    if (yamlToggle) {
        yamlToggle.classList.toggle('active', groupModalViewMode === 'yaml');
    }
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

    renderArrayInput('journeySteps', toArray(agent.journeySteps));

    const metrics = getAgentMetrics(agent);
    document.getElementById('metricsUsage').value = metrics.usageThisWeek || '';
    document.getElementById('metricsTimeSaved').value = metrics.timeSaved || '';

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function populateGroupFormFields(group = {}) {
    document.getElementById('groupName').value = group.groupName || '';
    document.getElementById('groupId').value = group.groupId || '';
    document.getElementById('groupClass').value = group.groupClass || '';
    document.getElementById('groupPhaseTag').value = group.phaseTag || '';
    document.getElementById('groupFlowDisplayName').value = group.flowDisplayName || '';
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
    draft.journeySteps = getArrayInputValues('journeySteps');

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
    draft.groupId = document.getElementById('groupId').value;
    draft.groupClass = document.getElementById('groupClass').value;
    draft.phaseTag = document.getElementById('groupPhaseTag').value;
    draft.flowDisplayName = document.getElementById('groupFlowDisplayName').value;

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
    textarea.value = jsyaml.dump(agentModalOriginal || {});
    setElementText('agentYamlError', '');
    setElementText('agentYamlStatus', '');
}

function updateGroupYamlEditor() {
    const textarea = document.getElementById('groupYamlInput');
    if (!textarea) return;
    textarea.value = jsyaml.dump(groupModalOriginal || {});
    setElementText('groupYamlError', '');
    setElementText('groupYamlStatus', '');
}

function applyAgentYamlToForm() {
    const textarea = document.getElementById('agentYamlInput');
    if (!textarea) return false;
    try {
        const parsed = jsyaml.load(textarea.value) || {};
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
        const parsed = jsyaml.load(textarea.value) || {};
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Section YAML must describe an object.');
        }
        groupModalOriginal = parsed;
        populateGroupFormFields(parsed);
        setElementText('groupYamlError', '');
        return true;
    } catch (error) {
        setElementText('groupYamlError', error.message);
        return false;
    }
}

function setAgentModalView(mode) {
    if (mode === agentModalViewMode) {
        return;
    }

    if (mode === 'yaml') {
        if (!syncAgentStateFromForm()) {
            alert('Unable to read agent form data.');
            return;
        }
        updateAgentYamlEditor();
    } else {
        if (!applyAgentYamlToForm()) {
            alert('Please fix YAML errors before returning to form view.');
            return;
        }
    }

    agentModalViewMode = mode;
    updateAgentModalViewUI();
}

function setGroupModalView(mode) {
    if (mode === groupModalViewMode) {
        return;
    }

    if (mode === 'yaml') {
        if (!syncGroupStateFromForm()) {
            alert('Unable to read section form data.');
            return;
        }
        updateGroupYamlEditor();
    } else {
        if (!applyGroupYamlToForm()) {
            alert('Please fix YAML errors before returning to form view.');
            return;
        }
    }

    groupModalViewMode = mode;
    updateGroupModalViewUI();
}

function ensureAgentStateFromCurrentView() {
    if (agentModalViewMode === 'yaml') {
        return applyAgentYamlToForm();
    }
    return syncAgentStateFromForm();
}

function ensureGroupStateFromCurrentView() {
    if (groupModalViewMode === 'yaml') {
        return applyGroupYamlToForm();
    }
    return syncGroupStateFromForm();
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
        configData = jsyaml.load(yamlText);
        const resolvedDoc = response.headers.get('X-Config-Document');
        if (resolvedDoc) {
            setActiveDocumentName(resolvedDoc);
        }
        const configSource = response.headers.get('X-Config-Source') || 'unknown';
        console.log('Config loaded from:', configSource, configData);
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
        const yamlText = jsyaml.dump(configData);
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
        css += `
            .${group.groupClass} .group-header { border-color: ${color}; }
            .${group.groupClass} .group-icon { background: ${color}; }
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

// Generate flow diagram dynamically
function generateFlowDiagram(config) {
    const flowDiagram = document.getElementById('flowDiagram');

    // Get groups to show in flow (exclude support or mark it separately)
    const flowGroups = config.agentGroups.filter(g => getGroupFormatting(g, 'showInFlow') && !getGroupFormatting(g, 'isSupport'));
    const supportGroups = config.agentGroups.filter(g => getGroupFormatting(g, 'showInFlow') && getGroupFormatting(g, 'isSupport'));

    let flowHTML = '<div class="flow-content">';

    // Generate main flow boxes
    flowGroups.forEach((group, index) => {
        const phaseImage = getGroupFormatting(group, 'phaseImage');
        const imageOverlay = phaseImage ? `
            <div class="phase-image-overlay">
                <img src="${phaseImage}" alt="${group.groupName}">
            </div>
        ` : '';

        const color = getGroupFormatting(group, 'color');
        const iconType = getGroupFormatting(group, 'iconType');

        flowHTML += `
            <div class="flow-box" style="background: ${color};" data-group="${group.groupId}" data-group-index="${group.groupNumber}">
                <i data-lucide="${iconType}" style="margin-bottom: 4px;"></i><br>${group.flowDisplayName}
                ${imageOverlay}
            </div>
        `;

        // Add arrow if not last item
        if (index < flowGroups.length - 1) {
            flowHTML += '<div class="flow-arrow">→</div>';
        }
    });

    flowHTML += '</div>';

    // Add support section if exists
    if (supportGroups.length > 0) {
        flowHTML += '<div class="flow-support">';
        supportGroups.forEach(group => {
            const color = getGroupFormatting(group, 'color');
            const iconType = getGroupFormatting(group, 'iconType');
            flowHTML += `
                <div class="flow-support-box" style="background: ${color};" data-group="${group.groupId}" data-group-index="${group.groupNumber}">
                    <i data-lucide="${iconType}"></i> ${group.flowDisplayName}
                </div>
            `;
        });
        flowHTML += '</div>';
    }

    flowDiagram.innerHTML = flowHTML;
    lucide.createIcons();
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

function createAgentCard(agent, phaseImage, config, groupIndex, agentIndex) {
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

    const imageOverlayHTML = phaseImage ? `
        <div class="icon-image-overlay">
            <img src="${phaseImage}" alt="Phase Diagram">
        </div>
    ` : '';

    return `
        <div class="agent-card">
            <div class="agent-number">${agent.agentNumber}</div>
            <h3 style="display: flex; align-items: center; gap: 8px;">
                <span>${agent.name}${handoverBadge}</span>
                <div class="card-edit-icon" onclick="openEditAgentModal(${groupIndex}, ${agentIndex})" title="Edit agent">
                    <i data-lucide="edit-3"></i>
                </div>
            </h3>
            <div class="agent-objective">Objective: ${agent.objective}</div>
            <div class="agent-description">${agent.description}</div>
            <div class="tools-container">${toolsHTML}</div>
            <div class="icon-panel">
                <div class="icon-panel-item journey-icon">
                    <i data-lucide="map"></i>
                    ${journeyHTML}
                    ${imageOverlayHTML}
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
    const phaseImage = getGroupFormatting(group, 'phaseImage');
    const color = getGroupFormatting(group, 'color');
    const phaseTagColor = getGroupFormatting(group, 'phaseTagColor');
    const iconType = getGroupFormatting(group, 'iconType');

    const agentsHTML = group.agents.map((agent, agentIndex) =>
        createAgentCard(agent, phaseImage, config, groupIndex, agentIndex)
    ).join('');
    const phaseStyle = phaseTagColor ? `style="background: ${phaseTagColor};"` : `style="background: ${color};"`;

    const groupIconOverlay = phaseImage ? `
        <div class="group-icon-overlay">
            <img src="${phaseImage}" alt="${group.groupName} Diagram">
        </div>
    ` : '';

    return `
        <div class="agent-group ${group.groupClass}" data-group-id="${group.groupId}" data-group-index="${groupIndex}">
            <div class="group-header">
                <div class="group-header-edit">
                    <div style="display: flex; align-items: center;">
                        <div class="group-icon">
                            <i data-lucide="${iconType}"></i>
                            ${groupIconOverlay}
                        </div>
                        <div class="group-title" style="display: flex; align-items: center;">
                            <div>
                                <h2 style="display: inline-block; margin: 0;">${group.groupName}</h2>
                                <div class="section-edit-icon" onclick="openEditGroupModal(${groupIndex})" title="Edit section">
                                    <i data-lucide="edit-3"></i>
                                </div>
                                <div><span class="phase-tag" ${phaseStyle}>${group.phaseTag}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="agents-grid">${agentsHTML}</div>
            <button class="add-agent-btn" onclick="openAddAgentModal(${groupIndex})">
                <i data-lucide="plus"></i> Add Agent to ${group.groupName}
            </button>
        </div>`;
}

// ----- Primary render pipeline -----
// Render agent groups (can be called to re-render after edits)
function renderAgentGroups() {
    if (!configData) return;

    // Update agent count
    const totalAgents = configData.agentGroups.reduce((sum, group) => sum + group.agents.length, 0);
    document.getElementById('agent-count').textContent =
        `${totalAgents} AI Agents Supporting The Proudfoot System`;

    // Render all agent groups
    const container = document.getElementById('agentGroupsContainer');
    const groupsHTML = configData.agentGroups.map((group, index) =>
        createAgentGroup(group, configData, index)
    ).join('');

    const addSectionButton = `
        <button class="add-agent-btn add-section-btn" onclick="openAddSectionModal()">
            <i data-lucide="plus"></i> Add New Section
        </button>
    `;

    container.innerHTML = groupsHTML + addSectionButton;

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Setup interactions
    setupTooltips();
    setupFlowBoxes();
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

        // Generate flow diagram
        generateFlowDiagram(config);

        // Render agent groups
        renderAgentGroups();

        // Show edit mode button (since user is authenticated)
        showEditModeButton();

    } catch (error) {
        console.error('Error loading agents:', error);
    }
}

// Toggle Flow Diagram
function toggleFlowDiagram(event) {
    const diagram = document.getElementById('flowDiagram');
    const button = event.target.closest('button');
    const icon = button.querySelector('.toggle-icon');
    const text = document.getElementById('toggleText');

    if (diagram.style.display === 'none') {
        diagram.style.display = 'block';
        icon.setAttribute('data-lucide', 'chevron-up');
        if (text) text.textContent = 'Hide Flow Diagram';
    } else {
        diagram.style.display = 'none';
        icon.setAttribute('data-lucide', 'chevron-down');
        if (text) text.textContent = 'Show Flow Diagram';
    }
    lucide.createIcons();
}

// Toggle Focus Mode
function toggleFocusMode() {
    const agentGroups = document.querySelector('.agent-groups');
    const btn = document.getElementById('focusModeBtn');
    const icon = document.getElementById('focusIcon');
    const text = document.getElementById('focusModeText');

    if (agentGroups.classList.contains('focus-mode')) {
        agentGroups.classList.remove('focus-mode');
        icon.setAttribute('data-lucide', 'eye');
        if (text) text.textContent = 'Focus Mode';
    } else {
        agentGroups.classList.add('focus-mode');
        icon.setAttribute('data-lucide', 'eye-off');
        if (text) text.textContent = 'Exit Focus Mode';
    }
    lucide.createIcons();
}

// Tooltip + flow interactions
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
        lucide.createIcons();
    });
}

// Setup Flow Box Highlighting - now fully dynamic
function setupFlowBoxes() {
    const flowBoxes = document.querySelectorAll('.flow-box, .flow-support-box');
    const agentGroups = document.querySelectorAll('.agent-group');

    flowBoxes.forEach(box => {
        box.addEventListener('click', function() {
            const targetGroupIndex = parseInt(this.dataset.groupIndex);

            flowBoxes.forEach(b => b.classList.remove('highlighted'));
            agentGroups.forEach(g => g.style.border = 'none');

            this.classList.add('highlighted');

            // Find the matching group by index
            const targetGroup = Array.from(agentGroups).find(g =>
                parseInt(g.dataset.groupIndex) === targetGroupIndex
            );

            if (targetGroup) {
                targetGroup.style.border = '4px solid #17a2b8';
                targetGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });

                setTimeout(() => {
                    this.classList.remove('highlighted');
                    targetGroup.style.border = 'none';
                }, 3000);
            }
        });
    });
}

// ----- Edit mode functionality -----
let editModeActive = false;

// Toggle edit mode
function toggleEditMode() {
    editModeActive = !editModeActive;
    const btn = document.getElementById('editModeBtn');
    const text = document.getElementById('editModeText');
    const icon = document.getElementById('editIcon');

    if (editModeActive) {
        btn.classList.add('active');
        text.textContent = 'Exit Edit Mode';
        document.body.classList.add('edit-mode-active');
    } else {
        btn.classList.remove('active');
        text.textContent = 'Enable Edit Mode';
        document.body.classList.remove('edit-mode-active');
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Show edit mode button after page loads (when authenticated)
function showEditModeButton() {
    const btn = document.getElementById('editModeBtn');
    if (btn) {
        btn.style.display = 'block';
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
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
            generateFlowDiagram(configData);
        }
    });
}

function deleteAgent() {
    if (!confirm('Are you sure you want to delete this agent?')) {
        return;
    }

    const form = document.getElementById('agentForm');
    const groupIndex = parseInt(form.dataset.groupIndex);
    const agentIndex = parseInt(form.dataset.agentIndex);

    configData.agentGroups[groupIndex].agents.splice(agentIndex, 1);

    saveConfig().then(success => {
        if (success) {
            closeAgentModal();
            renderAgentGroups();
            generateFlowDiagram(configData);
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
        groupClass: '',
        color: '#17a2b8',
        phaseImage: null,
        showInFlow: true,
        isSupport: false,
        flowDisplayName: '',
        agents: []
    };

    showGroupModal(newGroup, -1);
}

function showGroupModal(group, groupIndex) {
    const isNew = groupIndex === -1;
    const modal = document.getElementById('groupModal');
    const form = document.getElementById('groupForm');

    document.getElementById('modalGroupTitle').textContent = isNew ? 'Add Section' : 'Edit Section';
    groupModalOriginal = deepClone(group);
    groupModalViewMode = 'form';
    populateGroupFormFields(groupModalOriginal);
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

    form.dataset.groupIndex = groupIndex;

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
            generateFlowDiagram(configData);
            generateDynamicCSS(configData);
        }
    });
}

function deleteGroup() {
    if (!confirm('Are you sure you want to delete this entire section and all its agents?')) {
        return;
    }

    const form = document.getElementById('groupForm');
    const groupIndex = parseInt(form.dataset.groupIndex);

    configData.agentGroups.splice(groupIndex, 1);

    saveConfig().then(success => {
        if (success) {
            closeGroupModal();
            renderAgentGroups();
            generateFlowDiagram(configData);
        }
    });
}

// ----- Reusable form helpers -----
function renderArrayInput(fieldName, values) {
    const container = document.getElementById(fieldName + 'Container');
    container.innerHTML = '';

    values.forEach((value, index) => {
        addArrayInputField(fieldName, value);
    });

    // Always have at least one empty field
    if (values.length === 0) {
        addArrayInputField(fieldName, '');
    }
}

function addArrayInputField(fieldName, value = '') {
    const container = document.getElementById(fieldName + 'Container');
    const index = container.children.length;

    const div = document.createElement('div');
    div.className = 'array-input-item';
    div.innerHTML = `
        <input type="text" value="${value}" data-field="${fieldName}" data-index="${index}">
        <button type="button" class="btn btn-danger" onclick="removeArrayInputField(this)">
            <i data-lucide="x"></i>
        </button>
    `;

    container.appendChild(div);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function removeArrayInputField(button) {
    button.parentElement.remove();
}

function getArrayInputValues(fieldName) {
    return Array.from(document.querySelectorAll(`input[data-field="${fieldName}"]`))
        .map(input => input.value)
        .filter(val => val.trim() !== '');
}

// Initialize on page load
async function bootstrapApp() {
    try {
        await initializeDocumentControls();
        await loadAgents();
    } catch (error) {
        console.error('Initialization failed:', error);
    }
}

document.addEventListener('DOMContentLoaded', bootstrapApp);
