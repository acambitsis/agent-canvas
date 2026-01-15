import { getCurrentOrg, canManageCanvases, getCurrentOrgId, getUserOrgs } from './state.js';
import { createCanvas, deleteCanvas, listDocuments, updateCanvas } from './convex-client.js';
import { refreshIcons, slugifyIdentifier, state, loadCanvasPreference, saveCanvasPreference } from './state.js';
import { bindToggleMenu, closeMenu } from './menu-utils.js';
import { importLegacyYamlToNative } from './legacy-yaml-import.js';

let loadAgentsCallback = async () => {};
let documentMenuCleanup = null;

export function registerLoadAgents(fn) {
    loadAgentsCallback = typeof fn === 'function' ? fn : loadAgentsCallback;
}

export function setActiveCanvasId(canvasId, options = {}) {
    state.currentCanvasId = canvasId || null;

    if (!options.skipPersist) {
        saveCanvasPreference(state.currentCanvasId);
    }

    updateDocumentControlsUI();
}

// Backward-compatible export (call sites still use "document" naming)
export function setActiveDocumentName(name, options = {}) {
    return setActiveCanvasId(name, options);
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
        onAction: handleDocumentMenuAction,
        actionSelector: '[data-action]'
    });

    state.documentMenuBound = true;
}

export async function createBlankDocument() {
    // Check if user can create canvases
    if (!canManageCanvases()) {
        alert('You do not have permission to create canvases. Only org admins can create new canvases.');
        return;
    }

    // Get current org or prompt for selection
    let groupId = getCurrentOrgId();
    const groups = getUserOrgs();

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

    try {
        const defaultTitle = `Canvas ${state.availableDocuments.length + 1}`;
        const userInput = prompt('Title for the new canvas:', defaultTitle);
        if (userInput === null) return;

        const title = sanitizeCanvasTitle(userInput);
        const existingSlugs = new Set(
            state.availableDocuments
                .filter(doc => doc.group_id === groupId)
                .map(doc => doc.slug)
                .filter(Boolean)
        );
        const slug = generateUniqueCanvasSlug(title, existingSlugs);

        setDocumentStatusMessage(`Creating "${title}"...`);
        const canvasId = await createCanvas({ workosOrgId: groupId, title, slug });
        await refreshDocumentList(canvasId);
        setActiveCanvasId(canvasId);
        await loadAgentsCallback(canvasId);
        setDocumentStatusMessage(`Canvas "${title}" created.`, 'success');
    } catch (error) {
        console.error('[documents] Blank canvas creation failed', { error });
        setDocumentStatusMessage('Failed to create canvas.', 'error');
    }
}

export async function renameCurrentDocument() {
    if (!state.currentCanvasId) {
        alert('Select a canvas before renaming.');
        return;
    }

    const currentDoc = state.availableDocuments.find(d => d.id === state.currentCanvasId);
    const currentTitle = currentDoc?.title || currentDoc?.name || currentDoc?.slug || 'Untitled canvas';

    const userInput = prompt('Enter a new canvas title:', currentTitle);
    if (userInput === null) {
        return;
    }

    let newTitle;
    try {
        newTitle = sanitizeCanvasTitle(userInput);
    } catch (error) {
        alert(error.message);
        return;
    }

    if (newTitle === currentTitle) {
        setDocumentStatusMessage('Canvas title unchanged.');
        return;
    }

    const currentOrg = getCurrentOrg();
    if (!currentOrg) {
        alert('No organization selected');
        return;
    }

    try {
        setDocumentStatusMessage(`Renaming to "${newTitle}"...`);
        await updateCanvas(state.currentCanvasId, { title: newTitle });

        await refreshDocumentList(state.currentCanvasId);
        await loadAgentsCallback(state.currentCanvasId);
        setDocumentStatusMessage(`Renamed to "${newTitle}".`, 'success');
    } catch (error) {
        console.error('Rename failed:', error);
        alert('Failed to rename canvas: ' + (error.message || 'Unknown error'));
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
            const currentCanvasId = state.currentCanvasId;
            if (currentCanvasId && state.availableDocuments.some(doc => (doc.id || doc.slug || doc.name) === currentCanvasId)) {
                select.value = currentCanvasId;
            } else if (state.availableDocuments.length > 0) {
                select.value = state.availableDocuments[0].id || state.availableDocuments[0].slug || state.availableDocuments[0].name;
            }
        }
    }

    if (meta) {
        if (!state.documentListLoaded) {
            meta.textContent = 'Loading documents...';
        } else if (!state.availableDocuments.length) {
            meta.textContent = 'No canvases found. Create one to get started.';
        } else if (state.currentCanvasId) {
            const doc = state.availableDocuments.find(d => (d.id || d.slug || d.name) === state.currentCanvasId);
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
        const uploadBtn = menu.querySelector('[data-action="upload"]');
        const blankBtn = menu.querySelector('[data-action="blank"]');
        const renameBtn = menu.querySelector('[data-action="rename"]');
        const downloadMenuBtn = menu.querySelector('[data-action="download"]');
        const deleteBtn = menu.querySelector('[data-action="delete"]');
        const divider = menu.querySelector('[data-role="menu-divider"]');
        const hasDocument = Boolean(state.currentCanvasId);
        const isLastDocument = state.availableDocuments.length <= 1;
        const canManage = canManageCanvases();

        // Upload and blank require admin
        if (uploadBtn) {
            uploadBtn.disabled = !canManage;
            uploadBtn.title = canManage ? 'Import canvas from file' : 'Only admins can import';
        }
        if (blankBtn) {
            blankBtn.disabled = !canManage;
            blankBtn.title = canManage ? 'Create new canvas' : 'Only admins can create canvases';
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

function sanitizeCanvasTitle(title) {
    const normalized = (title || '').trim();
    if (!normalized) {
        throw new Error('Canvas title is required.');
    }
    return normalized;
}

function generateUniqueCanvasSlug(title, existingSlugs) {
    const base = slugifyIdentifier(title) || 'canvas';
    let candidate = base;
    let suffix = 2;
    while (existingSlugs.has(candidate)) {
        candidate = `${base}-${suffix++}`;
    }
    return candidate;
}

export async function refreshDocumentList(preferredCanvasRef) {
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

        const canvasIds = state.availableDocuments.map(doc => doc.id);
        let nextCanvas = preferredCanvasRef || state.currentCanvasId || loadCanvasPreference();

        if (!nextCanvas && canvasIds.length) {
            nextCanvas = canvasIds[0];
        }

        if (nextCanvas && !canvasIds.includes(nextCanvas) && canvasIds.length) {
            nextCanvas = canvasIds[0];
        }

        setActiveCanvasId(nextCanvas, { skipPersist: false });
        setDocumentStatusMessage('');
    } catch (error) {
        console.error('Error listing documents:', error);
        state.availableDocuments = [];
        state.documentListLoaded = true;
        setActiveCanvasId(null, { skipPersist: true });
        setDocumentStatusMessage('Unable to load canvases. Create a new canvas to get started.', 'error');
    } finally {
        updateDocumentControlsUI();
        // Notify main.js to update the sidebar canvas list
        window.dispatchEvent(new CustomEvent('documentsChanged'));
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
    if (!selectedDoc || selectedDoc === state.currentCanvasId) {
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
    const previousCanvasId = state.currentCanvasId;
    
    try {
        const selectedMeta = state.availableDocuments.find(d => (d.id || d.slug || d.name) === selectedDoc);
        const displayName = selectedMeta?.title || selectedMeta?.name || selectedMeta?.slug || selectedDoc;

        // Update UI state without persisting yet
        setActiveCanvasId(selectedDoc, { skipPersist: true });
        await loadAgentsCallback(selectedDoc);
        // Only persist after successful load
        setActiveCanvasId(selectedDoc, { skipPersist: false });
        setDocumentStatusMessage(`Loaded "${displayName}".`, 'success');
    } catch (error) {
        console.error('Error loading document:', error);
        // Revert to previous canvas on error
        setActiveCanvasId(previousCanvasId, { skipPersist: false });
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

    try {
        const contents = await file.text();

        // Try to suggest a title from YAML contents, falling back to filename.
        const filenameBase = (file.name || 'import.yaml')
            .replace(/\.ya?ml$/i, '')
            .trim();
        let suggestedTitle = filenameBase || 'Imported Canvas';
        
        // Extract title from YAML using importer helper
        const { extractTitleFromYaml } = await import('./legacy-yaml-import.js');
        const yamlTitle = await extractTitleFromYaml(contents);
        if (yamlTitle) {
            suggestedTitle = yamlTitle;
        }

        const userTitle = prompt('Title for imported canvas:', suggestedTitle);
        if (userTitle === null) return;

        await uploadDocumentFromContents(userTitle, contents);
    } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload document: ' + (error.message || 'Unknown error'));
    }
}

export async function uploadDocumentFromContents(titleInput, yamlText, groupId = null) {
    setDocumentStatusMessage('Importing legacy YAML...');

    // Use provided groupId or current org
    const currentOrg = getCurrentOrg();
    const targetOrgId = groupId || currentOrg?.id;
    if (!targetOrgId) {
        throw new Error('No organization selected');
    }

    const existingSlugs = new Set(
        state.availableDocuments
            .filter(doc => doc.group_id === targetOrgId)
            .map(doc => doc.slug)
            .filter(Boolean)
    );

    const result = await importLegacyYamlToNative({
        workosOrgId: targetOrgId,
        yamlText,
        overrideTitle: titleInput,
        existingSlugs
    });

    await refreshDocumentList(result.canvasId);
    setActiveCanvasId(result.canvasId);
    await loadAgentsCallback(result.canvasId);

    setDocumentStatusMessage(`Imported "${result.title}" (${result.agentCount} agents).`, 'success');
}

export async function deleteCurrentDocument() {
    if (!state.currentCanvasId) {
        alert('No canvas selected to delete.');
        return;
    }

    if (state.availableDocuments.length <= 1) {
        alert('Cannot delete the last document. At least one document must remain.');
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to permanently delete this canvas?\n\n` +
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
        setDocumentStatusMessage('Deleting canvas...');
        await deleteCanvas(state.currentCanvasId);

        // Store deleted document name before refreshDocumentList changes state.currentDocumentName
        const deletedCanvasId = state.currentCanvasId;
        const remainingDocs = state.availableDocuments.filter(doc => (doc.id || doc.slug || doc.name) !== deletedCanvasId);
        const nextCanvasId = remainingDocs.length > 0 ? (remainingDocs[0].id || remainingDocs[0].slug || remainingDocs[0].name) : null;

        await refreshDocumentList(nextCanvasId);
        if (nextCanvasId) {
            await loadAgentsCallback(nextCanvasId);
            setDocumentStatusMessage('Canvas deleted successfully.', 'success');
        } else {
            setDocumentStatusMessage('Canvas deleted. No canvases remaining.', 'success');
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
