import { state, DEFAULT_DOCUMENT_NAME, BLANK_DOCUMENT_TEMPLATE, DOCUMENT_STORAGE_KEY, refreshIcons } from './state.js';

let loadAgentsCallback = async () => {};

export function registerLoadAgents(fn) {
    loadAgentsCallback = typeof fn === 'function' ? fn : loadAgentsCallback;
}

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

export function setActiveDocumentName(name, options = {}) {
    state.currentDocumentName = name || null;

    if (!options.skipPersist) {
        persistDocumentPreference(state.currentDocumentName);
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

export function closeDocumentMenu() {
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

function bindDocumentMenuEvents() {
    if (state.documentMenuBound) return;
    const menu = getDocumentMenuElement();
    const button = document.getElementById('documentMenuBtn');
    if (!menu || !button) return;

    button.addEventListener('click', toggleDocumentMenu);
    menu.addEventListener('click', event => {
        const actionButton = event.target.closest('button[data-action]');
        if (actionButton) {
            event.preventDefault();
            const action = actionButton.dataset.action;
            closeDocumentMenu();
            handleDocumentMenuAction(action);
            return;
        }
        
        const menuLink = event.target.closest('a.menu-link');
        if (menuLink) {
            closeDocumentMenu();
            // Allow default navigation behavior (opens in new tab)
        }
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

    state.documentMenuBound = true;
}

export async function createBlankDocument() {
    const defaultName = `document-${state.availableDocuments.length + 1}.yaml`;
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

    if (state.availableDocuments.some(doc => doc.name === docName)) {
        if (!confirm(`"${docName}" already exists. Overwrite it with a blank document?`)) {
            return;
        }
    }

    try {
        setDocumentStatusMessage(`Creating "${docName}"...`);
        await uploadDocumentFromContents(docName, BLANK_DOCUMENT_TEMPLATE);
        setDocumentStatusMessage(`Document "${docName}" created.`, 'success');
    } catch (error) {
        console.error('[documents] Blank document creation failed', { docName, error });
        setDocumentStatusMessage('Failed to create document.', 'error');
    }
}

export async function renameCurrentDocument() {
    if (!state.currentDocumentName) {
        alert('Select a document before renaming.');
        return;
    }

    const userInput = prompt('Enter a new name (.yaml will be appended if missing):', state.currentDocumentName);
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

    if (newDocName === state.currentDocumentName) {
        setDocumentStatusMessage('Document name unchanged.');
        return;
    }

    if (state.availableDocuments.some(doc => doc.name === newDocName)) {
        alert(`A document named "${newDocName}" already exists. Choose a different name.`);
        return;
    }

    try {
        setDocumentStatusMessage(`Renaming to "${newDocName}"...`);
        const response = await fetch(
            `/api/config?doc=${encodeURIComponent(state.currentDocumentName)}&newDoc=${encodeURIComponent(newDocName)}`,
            { method: 'PUT' }
        );

        if (!response.ok) {
            throw new Error('Rename failed');
        }

        await refreshDocumentList(newDocName);
        await loadAgentsCallback(newDocName);
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

        if (!state.documentListLoaded) {
            const option = document.createElement('option');
            option.textContent = 'Loading...';
            option.value = '';
            select.appendChild(option);
            select.disabled = true;
        } else if (!state.availableDocuments.length) {
            const option = document.createElement('option');
            option.textContent = 'No documents available';
            option.value = '';
            select.appendChild(option);
            select.disabled = true;
        } else {
            state.availableDocuments.forEach(doc => {
                const option = document.createElement('option');
                option.textContent = doc.name;
                option.value = doc.name;
                select.appendChild(option);
            });
            select.disabled = false;
            if (state.currentDocumentName && state.availableDocuments.some(doc => doc.name === state.currentDocumentName)) {
                select.value = state.currentDocumentName;
            } else {
                select.value = state.availableDocuments[0].name;
            }
        }
    }

    if (meta) {
        if (!state.documentListLoaded) {
            meta.textContent = 'Loading documents...';
        } else if (!state.availableDocuments.length) {
            meta.textContent = 'No YAML documents found. Upload one to get started.';
        } else if (state.currentDocumentName) {
            const doc = state.availableDocuments.find(d => d.name === state.currentDocumentName);
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
        const hasDocument = Boolean(state.currentDocumentName);
        const isLastDocument = state.availableDocuments.length <= 1;

        if (renameBtn) {
            renameBtn.disabled = !hasDocument;
        }
        if (downloadMenuBtn) {
            downloadMenuBtn.disabled = !hasDocument;
        }
        if (deleteBtn) {
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

export function setDocumentStatusMessage(message, type = 'info') {
    const statusEl = getDocumentStatusElement();
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.dataset.state = type;
}

export function sanitizeDocumentNameForClient(name) {
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

export async function refreshDocumentList(preferredDocName) {
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
        state.availableDocuments = Array.isArray(data.documents) ? data.documents : [];
        state.documentListLoaded = true;

        const docNames = state.availableDocuments.map(doc => doc.name);
        let nextDoc = preferredDocName || state.currentDocumentName || getStoredDocumentPreference();

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
        state.availableDocuments = [];
        state.documentListLoaded = true;
        setActiveDocumentName(null, { skipPersist: true });
        setDocumentStatusMessage('Unable to load documents. Upload a YAML file to create one.', 'error');
    } finally {
        updateDocumentControlsUI();
    }
}

export async function initializeDocumentControls() {
    const fileInput = document.getElementById('documentFileInput');
    if (fileInput && !fileInput.dataset.bound) {
        fileInput.addEventListener('change', handleDocumentFileSelected);
        fileInput.dataset.bound = 'true';
    }

    bindDocumentMenuEvents();
    await refreshDocumentList();
}

export async function handleDocumentSelection(event) {
    const selectedDoc = event.target.value;
    if (!selectedDoc || selectedDoc === state.currentDocumentName) {
        return;
    }

    // Show prominent loading overlay
    const docSelect = event.target;
    docSelect.disabled = true;

    // Show loading overlay
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    if (overlay) {
        if (messageEl) messageEl.textContent = `Loading "${selectedDoc}"...`;
        overlay.classList.add('show');
        // Refresh icons after DOM update
        setTimeout(() => {
            if (window.lucide) window.lucide.createIcons();
        }, 50);
    }

    // Store previous document name to revert on error
    const previousDocName = state.currentDocumentName;
    
    try {
        // Update UI state without persisting yet
        setActiveDocumentName(selectedDoc, { skipPersist: true });
        await loadAgentsCallback(selectedDoc);
        // Only persist after successful load
        setActiveDocumentName(selectedDoc, { skipPersist: false });
        setDocumentStatusMessage(`Loaded "${selectedDoc}".`, 'success');
    } catch (error) {
        console.error('Error loading document:', error);
        // Revert to previous document name on error
        setActiveDocumentName(previousDocName, { skipPersist: false });
        setDocumentStatusMessage(`Failed to load "${selectedDoc}".`, 'error');
    } finally {
        docSelect.disabled = false;
        if (overlay) {
            overlay.classList.remove('show');
        }
    }
}

export function triggerDocumentUpload() {
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
        return;
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

export async function uploadDocumentFromContents(docName, yamlText) {
    const payloadSize = typeof yamlText === 'string' ? yamlText.length : 0;
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
    await loadAgentsCallback(docName);

    setDocumentStatusMessage(`Document "${docName}" uploaded and loaded.`, 'success');
}

export async function downloadCurrentDocument() {
    if (!state.currentDocumentName) {
        alert('No document selected to download.');
        return;
    }

    try {
        const response = await fetch(`/api/config?doc=${encodeURIComponent(state.currentDocumentName)}`);
        if (!response.ok) {
            throw new Error('Download failed');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = state.currentDocumentName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download document: ' + (error.message || 'Unknown error'));
    }
}

export async function deleteCurrentDocument() {
    if (!state.currentDocumentName) {
        alert('No document selected to delete.');
        return;
    }

    if (state.availableDocuments.length <= 1) {
        alert('Cannot delete the last document. At least one document must remain.');
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to permanently delete "${state.currentDocumentName}"?\n\n` +
        `This action cannot be undone.`
    );

    if (!confirmed) {
        return;
    }

    try {
        setDocumentStatusMessage(`Deleting "${state.currentDocumentName}"...`);
        const response = await fetch(
            `/api/config?doc=${encodeURIComponent(state.currentDocumentName)}`,
            { method: 'DELETE' }
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Delete failed');
        }

        // Store deleted document name before refreshDocumentList changes state.currentDocumentName
        const deletedDocName = state.currentDocumentName;
        const remainingDocs = state.availableDocuments.filter(doc => doc.name !== deletedDocName);
        const nextDoc = remainingDocs.length > 0 ? remainingDocs[0].name : null;

        await refreshDocumentList(nextDoc);
        if (nextDoc) {
            await loadAgentsCallback(nextDoc);
            setDocumentStatusMessage(`Document "${deletedDocName}" deleted successfully.`, 'success');
        } else {
            setDocumentStatusMessage('Document deleted. No documents remaining.', 'success');
        }

    } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete document: ' + (error.message || 'Unknown error'));
        setDocumentStatusMessage('Delete failed.', 'error');
    }
}
