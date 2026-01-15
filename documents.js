import { getCurrentOrg } from './state.js';
import { deleteDocument, getConvexClient, getDocument, listDocuments, renameDocument, saveDocument } from './convex-client.js';
import { canManageCanvasesInCurrentGroup, getCurrentGroupId, getUserGroups } from './main.js';
import { BLANK_DOCUMENT_TEMPLATE, DEFAULT_DOCUMENT_NAME, DOCUMENT_STORAGE_KEY, refreshIcons, state, loadDocumentPreference, saveDocumentPreference } from './state.js';
import { convexToYaml } from './yaml-converter.js';
import { bindToggleMenu, closeMenu } from './menu-utils.js';

let loadAgentsCallback = async () => {};
let documentMenuCleanup = null;

export function registerLoadAgents(fn) {
    loadAgentsCallback = typeof fn === 'function' ? fn : loadAgentsCallback;
}

export function setActiveDocumentName(name, options = {}) {
    state.currentDocumentName = name || null;

    if (!options.skipPersist) {
        saveDocumentPreference(state.currentDocumentName);
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
    if (menu && button) {
        closeMenu(menu, button);
    }
}

function handleDocumentMenuAction(action) {
    const actions = {
        upload: triggerDocumentUpload,
        blank: createBlankDocument,
        share: () => alert('Canvas access is controlled by organization membership. Invite users to your organization via WorkOS dashboard.'),
        rename: renameCurrentDocument,
        download: downloadCurrentDocument,
        delete: deleteCurrentDocument
    };

    const handler = actions[action];
    if (handler) handler();
}

function bindDocumentMenuEvents() {
    if (state.documentMenuBound) return;
    const menu = getDocumentMenuElement();
    const button = document.getElementById('documentMenuBtn');
    if (!menu || !button) return;

    documentMenuCleanup = bindToggleMenu({
        buttonEl: button,
        menuEl: menu,
        onAction: handleDocumentMenuAction
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

    const currentOrg = getCurrentOrg();
    if (!currentOrg) {
        alert('No organization selected');
        return;
    }

    // Check for duplicates within the same org
    if (state.availableDocuments.some(doc =>
        (doc.name === newDocName || doc.slug === newDocName) && doc.group_id === currentOrg.id
    )) {
        alert(`A document named "${newDocName}" already exists in this organization. Choose a different name.`);
        return;
    }

    try {
        setDocumentStatusMessage(`Renaming to "${newDocName}"...`);
        await renameDocument(currentOrg.id, state.currentDocumentName, newDocName);

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
        
        const currentOrg = getCurrentOrg();
        if (!currentOrg) {
            throw new Error('No organization selected');
        }

        const canvases = await listDocuments(currentOrg.id);
        
        // Transform canvas objects to document format expected by UI
        state.availableDocuments = canvases.map(canvas => ({
            id: canvas._id,
            slug: canvas.slug,
            name: canvas.slug, // Use slug as name
            title: canvas.title,
            updated_at: canvas.updatedAt,
            updatedAt: canvas.updatedAt,
            createdAt: canvas.createdAt,
            group_id: canvas.workosOrgId,
            group_name: currentOrg.name || currentOrg.id,
        }));
        
        state.documentListLoaded = true;

        const docNames = state.availableDocuments.map(doc => doc.name || doc.slug || doc.id);
        let nextDoc = preferredDocName || state.currentDocumentName || loadDocumentPreference();

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
    setDocumentStatusMessage(`Uploading "${docName}"...`);

    // Use provided groupId or current org
    const currentOrg = getCurrentOrg();
    const targetOrgId = groupId || currentOrg?.id;
    if (!targetOrgId) {
        throw new Error('No organization selected');
    }

    // Parse YAML to get title
    let title = docName;
    try {
        const parsed = window.jsyaml.load(yamlText);
        if (parsed && parsed.documentTitle) {
            title = parsed.documentTitle;
        }
    } catch (e) {
        // Use docName as title if parsing fails
    }

    await saveDocument(targetOrgId, docName, title, yamlText);

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
        const currentOrg = getCurrentOrg();
        if (!currentOrg) {
            throw new Error('No organization selected');
        }

        const canvas = await getDocument(currentOrg.id, state.currentDocumentName);
        if (!canvas) {
            throw new Error('Document not found');
        }

        // Use sourceYaml if available, otherwise regenerate from agents
        let yamlText = canvas.sourceYaml;
        
        if (!yamlText) {
            // Regenerate YAML from agents and org settings
            const agents = await getConvexClient().query("agents:list", { canvasId: canvas._id });
            const orgSettings = await getConvexClient().query("orgSettings:get", { workosOrgId: currentOrg.id }).catch(() => null);
            
            const yamlDoc = convexToYaml(canvas, agents, orgSettings);
            yamlText = window.jsyaml.dump(yamlDoc);
        }
        
        if (!yamlText || yamlText.trim() === '') {
            throw new Error('Document has no content to download');
        }
        
        const blob = new Blob([yamlText], { type: 'text/yaml' });
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

    const currentOrg = getCurrentOrg();
    if (!currentOrg) {
        alert('No organization selected');
        return;
    }

    try {
        setDocumentStatusMessage(`Deleting "${state.currentDocumentName}"...`);
        await deleteDocument(currentOrg.id, state.currentDocumentName);

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

// Note: Canvas sharing is now handled by WorkOS organization membership.
// Users see canvases for the organizations they belong to.
// To share a canvas with someone, invite them to your organization via WorkOS dashboard.
