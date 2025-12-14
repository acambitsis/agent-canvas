import { BLANK_DOCUMENT_TEMPLATE, DEFAULT_DOCUMENT_NAME, DOCUMENT_STORAGE_KEY, refreshIcons, state } from './state.js';
import { authenticatedFetch } from './auth-client.js';
import { getCurrentGroupId, getUserGroups, canManageCanvasesInCurrentGroup } from './groups-ui.js';

let loadAgentsCallback = async () => {};

export function registerLoadAgents(fn) {
    loadAgentsCallback = typeof fn === 'function' ? fn : loadAgentsCallback;
}

function handleAuthError(response) {
    if (response.status === 401) {
        window.location.href = '/login';
        return true;
    }
    return false;
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
        case 'share':
            openShareModal();
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
    // Check if user can create canvases
    if (!canManageCanvasesInCurrentGroup()) {
        alert('You do not have permission to create canvases. Only group admins can create new canvases.');
        return;
    }

    // Get current group or prompt for selection
    let groupId = getCurrentGroupId();
    const groups = getUserGroups();

    if (!groupId && groups.length === 0) {
        alert('No groups available. You must be a member of a group to create canvases.');
        return;
    }

    // If multiple groups and user is admin in multiple, let them choose
    const adminGroups = groups.filter(g => g.role === 'admin' || g.role === 'super_admin');
    if (adminGroups.length > 1) {
        const groupOptions = adminGroups.map((g, i) => `${i + 1}. ${g.name}`).join('\n');
        const selection = prompt(`Select a group for the new canvas:\n${groupOptions}\n\nEnter number (1-${adminGroups.length}):`);
        if (selection === null) return;

        const idx = parseInt(selection, 10) - 1;
        if (idx >= 0 && idx < adminGroups.length) {
            groupId = adminGroups[idx].id;
        } else {
            alert('Invalid selection');
            return;
        }
    } else if (adminGroups.length === 1) {
        groupId = adminGroups[0].id;
    }

    if (!groupId) {
        alert('No group selected or you do not have admin access to any groups.');
        return;
    }

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

    // Check for existing document in same group
    const existingInGroup = state.availableDocuments.some(
        doc => doc.name === docName && doc.group_id === groupId
    );
    if (existingInGroup) {
        if (!confirm(`"${docName}" already exists in this group. Overwrite it?`)) {
            return;
        }
    }

    try {
        setDocumentStatusMessage(`Creating "${docName}"...`);
        await uploadDocumentFromContents(docName, BLANK_DOCUMENT_TEMPLATE, groupId);
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

    // Find current document to get its group_id
    const currentDoc = state.availableDocuments.find(
        doc => (doc.name || doc.slug || doc.id) === state.currentDocumentName
    );
    const currentGroupId = currentDoc?.group_id;

    // Only check for duplicates within the same group
    if (state.availableDocuments.some(doc =>
        doc.name === newDocName && doc.group_id === currentGroupId
    )) {
        alert(`A document named "${newDocName}" already exists in this group. Choose a different name.`);
        return;
    }

    try {
        setDocumentStatusMessage(`Renaming to "${newDocName}"...`);
        const response = await authenticatedFetch(
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
            // Group documents by group_name
            const groupedDocs = {};
            state.availableDocuments.forEach(doc => {
                const groupName = doc.group_name || 'Ungrouped';
                if (!groupedDocs[groupName]) {
                    groupedDocs[groupName] = [];
                }
                groupedDocs[groupName].push(doc);
            });

            // If only one group, show flat list
            const groupNames = Object.keys(groupedDocs);
            if (groupNames.length <= 1) {
                state.availableDocuments.forEach(doc => {
                    const option = document.createElement('option');
                    const docId = doc.id || doc.slug || doc.name;
                    const docTitle = doc.title || doc.name || doc.slug || doc.id;
                    option.textContent = docTitle;
                    option.value = docId;
                    select.appendChild(option);
                });
            } else {
                // Show grouped list with optgroups
                groupNames.sort().forEach(groupName => {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = groupName;
                    groupedDocs[groupName].forEach(doc => {
                        const option = document.createElement('option');
                        const docId = doc.id || doc.slug || doc.name;
                        const docTitle = doc.title || doc.name || doc.slug || doc.id;
                        option.textContent = docTitle;
                        option.value = docId;
                        optgroup.appendChild(option);
                    });
                    select.appendChild(optgroup);
                });
            }

            select.disabled = false;
            const currentDocId = state.currentDocumentName;
            if (currentDocId && state.availableDocuments.some(doc => (doc.id || doc.slug || doc.name) === currentDocId)) {
                select.value = currentDocId;
            } else if (state.availableDocuments.length > 0) {
                select.value = state.availableDocuments[0].id || state.availableDocuments[0].slug || state.availableDocuments[0].name;
            }
        }
    }

    if (meta) {
        if (!state.documentListLoaded) {
            meta.textContent = 'Loading documents...';
        } else if (!state.availableDocuments.length) {
            meta.textContent = 'No YAML documents found. Upload one to get started.';
        } else if (state.currentDocumentName) {
            const doc = state.availableDocuments.find(d => (d.id || d.slug || d.name) === state.currentDocumentName);
            if (doc) {
                const sizeText = typeof doc.size === 'number' ? formatBytes(doc.size) : '';
                const updatedText = doc.updated_at || doc.updatedAt ? new Date(doc.updated_at || doc.updatedAt).toLocaleString() : '';
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
        const uploadBtn = menu.querySelector('button[data-action="upload"]');
        const blankBtn = menu.querySelector('button[data-action="blank"]');
        const renameBtn = menu.querySelector('button[data-action="rename"]');
        const downloadMenuBtn = menu.querySelector('button[data-action="download"]');
        const deleteBtn = menu.querySelector('button[data-action="delete"]');
        const divider = menu.querySelector('[data-role="menu-divider"]');
        const hasDocument = Boolean(state.currentDocumentName);
        const isLastDocument = state.availableDocuments.length <= 1;
        const canManage = canManageCanvasesInCurrentGroup();

        // Upload and blank require admin
        if (uploadBtn) {
            uploadBtn.disabled = !canManage;
            uploadBtn.title = canManage ? 'Upload YAML file' : 'Only admins can upload files';
        }
        if (blankBtn) {
            blankBtn.disabled = !canManage;
            blankBtn.title = canManage ? 'Create new blank document' : 'Only admins can create documents';
        }

        // Rename requires admin
        if (renameBtn) {
            renameBtn.disabled = !hasDocument || !canManage;
            renameBtn.title = !canManage ? 'Only admins can rename documents' : 'Rename current document';
        }
        if (downloadMenuBtn) {
            downloadMenuBtn.disabled = !hasDocument;
        }
        // Delete requires admin
        if (deleteBtn) {
            deleteBtn.disabled = !hasDocument || isLastDocument || !canManage;
            if (!canManage) {
                deleteBtn.title = 'Only admins can delete documents';
            } else if (isLastDocument && hasDocument) {
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
        const response = await authenticatedFetch('/api/config?list=1', {
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

        const docNames = state.availableDocuments.map(doc => doc.name || doc.slug || doc.id);
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

export async function uploadDocumentFromContents(docName, yamlText, groupId = null) {
    const payloadSize = typeof yamlText === 'string' ? yamlText.length : 0;
    setDocumentStatusMessage(`Uploading "${docName}"...`);

    // Use provided groupId or current group
    const targetGroupId = groupId || getCurrentGroupId();
    let url = `/api/config?doc=${encodeURIComponent(docName)}`;
    if (targetGroupId) {
        url += `&group_id=${encodeURIComponent(targetGroupId)}`;
    }

    const response = await authenticatedFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/yaml',
            'X-Config-Name': docName,
            ...(targetGroupId ? { 'X-Group-Id': targetGroupId } : {})
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
        const response = await authenticatedFetch(`/api/config?doc=${encodeURIComponent(state.currentDocumentName)}`);
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
        const response = await authenticatedFetch(
            `/api/config?doc=${encodeURIComponent(state.currentDocumentName)}`,
            { method: 'DELETE' }
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Delete failed');
        }

        // Store deleted document name before refreshDocumentList changes state.currentDocumentName
        const deletedDocName = state.currentDocumentName;
        const remainingDocs = state.availableDocuments.filter(doc => (doc.name || doc.slug || doc.id) !== deletedDocName);
        const nextDoc = remainingDocs.length > 0 ? (remainingDocs[0].name || remainingDocs[0].slug || remainingDocs[0].id) : null;

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

export async function openShareModal() {
    if (!state.currentDocumentName) {
        alert('Select a canvas before sharing.');
        return;
    }

    const modal = document.getElementById('shareModal');
    const content = document.getElementById('shareModalContent');
    if (!modal || !content) return;

    modal.classList.add('show');
    content.innerHTML = '<p class="help-text">Loading...</p>';

    try {
        // Get canvas ID (could be slug or ID)
        const canvasId = state.currentDocumentName.replace(/\.yaml$/, '');
        
        // Fetch current shares
        const sharesResponse = await authenticatedFetch(`/api/canvases/${encodeURIComponent(canvasId)}/shares`);
        if (!sharesResponse.ok) {
            throw new Error('Failed to load shares');
        }
        const sharesData = await sharesResponse.json();
        const shares = sharesData.shares || [];

        // Fetch groups if in org context
        let groups = [];
        try {
            const groupsResponse = await authenticatedFetch('/api/groups');
            if (groupsResponse.ok) {
                const groupsData = await groupsResponse.json();
                groups = groupsData.groups || [];
            }
        } catch (e) {
            // Not in org context or groups not available
        }

        // Build UI
        let html = '<div class="share-section">';
        html += '<h3>Current Shares</h3>';
        
        if (shares.length === 0) {
            html += '<p class="help-text">No shares yet. Add users or groups below.</p>';
        } else {
            html += '<ul class="share-list">';
            shares.forEach(share => {
                const typeLabel = share.principal_type === 'user' ? 'User' : 'Group';
                html += `<li class="share-item">
                    <span>${typeLabel}: ${share.principal_id}</span>
                    <button type="button" class="btn btn-icon btn-danger" data-remove-share="${share.principal_type}:${share.principal_id}" title="Remove share">
                        <i data-lucide="x"></i>
                    </button>
                </li>`;
            });
            html += '</ul>';
        }

        html += '</div>';
        html += '<div class="share-section" style="margin-top: 20px;">';
        html += '<h3>Add Share</h3>';
        html += '<div class="form-group">';
        html += '<label>Share Type</label>';
        html += '<select id="sharePrincipalType" class="form-input">';
        html += '<option value="user">User</option>';
        if (groups.length > 0) {
            html += '<option value="group">Group</option>';
        }
        html += '</select>';
        html += '</div>';
        
        html += '<div class="form-group" id="shareUserGroup">';
        html += '<label id="sharePrincipalLabel">User ID</label>';
        html += '<input type="text" id="sharePrincipalId" class="form-input" placeholder="Enter Clerk User ID">';
        html += '</div>';

        if (groups.length > 0) {
            html += '<div class="form-group" id="shareGroupSelect" style="display: none;">';
            html += '<label>Group</label>';
            html += '<select id="shareGroupId" class="form-input">';
            groups.forEach(group => {
                html += `<option value="${group.id}">${group.name}</option>`;
            });
            html += '</select>';
            html += '</div>';
        }

        html += '<button type="button" class="btn btn-primary" id="addShareBtn" style="margin-top: 10px;">Add Share</button>';
        html += '</div>';

        content.innerHTML = html;
        
        // Refresh icons
        if (window.lucide) window.lucide.createIcons();

        // Bind events
        const principalTypeSelect = document.getElementById('sharePrincipalType');
        const userGroupDiv = document.getElementById('shareUserGroup');
        const groupSelectDiv = document.getElementById('shareGroupSelect');
        const principalLabel = document.getElementById('sharePrincipalLabel');

        if (principalTypeSelect) {
            principalTypeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'group' && groupSelectDiv) {
                    userGroupDiv.style.display = 'none';
                    groupSelectDiv.style.display = 'block';
                } else {
                    userGroupDiv.style.display = 'block';
                    groupSelectDiv.style.display = 'none';
                    if (principalLabel) principalLabel.textContent = 'User ID';
                }
            });
        }

        const addShareBtn = document.getElementById('addShareBtn');
        if (addShareBtn) {
            addShareBtn.addEventListener('click', async () => {
                const principalType = principalTypeSelect?.value || 'user';
                let principalId;
                
                if (principalType === 'group' && groupSelectDiv) {
                    const groupSelect = document.getElementById('shareGroupId');
                    principalId = groupSelect?.value;
                } else {
                    const principalInput = document.getElementById('sharePrincipalId');
                    principalId = principalInput?.value?.trim();
                }

                if (!principalId) {
                    alert('Please enter a user ID or select a group');
                    return;
                }

                try {
                    addShareBtn.disabled = true;
                    addShareBtn.textContent = 'Adding...';

                    const response = await authenticatedFetch(`/api/canvases/${encodeURIComponent(canvasId)}/shares`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ principalType, principalId }),
                    });

                    if (!response.ok) {
                        const error = await response.json().catch(() => ({ error: 'Failed to add share' }));
                        throw new Error(error.error || 'Failed to add share');
                    }

                    // Reload modal
                    await openShareModal();
                } catch (error) {
                    alert('Failed to add share: ' + error.message);
                } finally {
                    addShareBtn.disabled = false;
                    addShareBtn.textContent = 'Add Share';
                }
            });
        }

        // Bind remove share buttons
        content.querySelectorAll('[data-remove-share]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const shareKey = btn.dataset.removeShare;
                const [principalType, principalId] = shareKey.split(':');

                if (!confirm(`Remove share for ${principalType} "${principalId}"?`)) {
                    return;
                }

                try {
                    btn.disabled = true;

                    const response = await authenticatedFetch(`/api/canvases/${encodeURIComponent(canvasId)}/shares`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ principalType, principalId }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to remove share');
                    }

                    // Reload modal
                    await openShareModal();
                } catch (error) {
                    alert('Failed to remove share: ' + error.message);
                    btn.disabled = false;
                }
            });
        });

    } catch (error) {
        console.error('Error loading shares:', error);
        content.innerHTML = `<p class="help-text" style="color: var(--text-error);">Failed to load sharing information: ${error.message}</p>`;
    }
}

// Bind share modal close handlers
document.addEventListener('DOMContentLoaded', () => {
    const shareModal = document.getElementById('shareModal');
    const shareModalClose = document.getElementById('shareModalClose');
    const shareModalCancel = document.getElementById('shareModalCancel');

    const closeShareModal = () => {
        if (shareModal) shareModal.classList.remove('show');
    };

    if (shareModalClose) shareModalClose.addEventListener('click', closeShareModal);
    if (shareModalCancel) shareModalCancel.addEventListener('click', closeShareModal);

    // Close on backdrop click
    if (shareModal) {
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) {
                closeShareModal();
            }
        });
    }
});
