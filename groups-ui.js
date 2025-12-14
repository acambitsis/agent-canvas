/**
 * Group management UI module
 * Handles group switcher, group management modal, invites UI
 */

import { authenticatedFetch, acceptPendingInvites, getUserId } from './auth-client.js';
import { refreshIcons, state } from './state.js';

// Group state
let currentGroupId = null;
let userGroups = [];
let isSuperAdmin = false;

// Export getters
export function getCurrentGroupId() {
  return currentGroupId;
}

export function getUserGroups() {
  return userGroups;
}

export function getIsSuperAdmin() {
  return isSuperAdmin;
}

/**
 * Initialize groups - fetch user's groups and accept pending invites
 */
export async function initializeGroups() {
  try {
    // Accept any pending invites first
    await acceptPendingInvites();

    // Fetch user's groups
    await refreshGroups();

    // Render group UI
    renderGroupSwitcher();

    return userGroups;
  } catch (error) {
    console.error('Failed to initialize groups:', error);
    return [];
  }
}

/**
 * Fetch groups from API
 */
export async function refreshGroups() {
  try {
    const response = await authenticatedFetch('/api/groups');
    if (!response.ok) {
      throw new Error('Failed to fetch groups');
    }

    const data = await response.json();
    userGroups = data.groups || [];
    isSuperAdmin = data.is_super_admin || false;

    // Set current group if not set
    if (!currentGroupId && userGroups.length > 0) {
      currentGroupId = userGroups[0].id;
    }

    return userGroups;
  } catch (error) {
    console.error('Failed to fetch groups:', error);
    userGroups = [];
    return [];
  }
}

/**
 * Set the active group
 */
export function setCurrentGroup(groupId) {
  currentGroupId = groupId;
  const group = userGroups.find(g => g.id === groupId);

  // Update UI
  const switcher = document.getElementById('groupSwitcher');
  if (switcher) {
    switcher.value = groupId;
  }

  // Update group name display
  const groupNameDisplay = document.getElementById('currentGroupName');
  if (groupNameDisplay && group) {
    groupNameDisplay.textContent = group.name;
  }

  // Dispatch event for other modules
  window.dispatchEvent(new CustomEvent('groupChanged', { detail: { groupId, group } }));
}

/**
 * Render group switcher in header
 */
export function renderGroupSwitcher() {
  const container = document.getElementById('groupSwitcherContainer');
  if (!container) return;

  if (userGroups.length === 0) {
    container.innerHTML = `
      <div class="group-switcher-empty">
        <span>No groups available</span>
      </div>
    `;
    return;
  }

  const currentGroup = userGroups.find(g => g.id === currentGroupId) || userGroups[0];
  const role = currentGroup?.role || 'viewer';
  const roleBadge = role === 'super_admin' ? 'Super Admin' :
                    role === 'admin' ? 'Admin' : 'Viewer';
  const roleClass = role === 'super_admin' ? 'role-super-admin' :
                    role === 'admin' ? 'role-admin' : 'role-viewer';

  container.innerHTML = `
    <div class="group-switcher-wrapper">
      <select id="groupSwitcher" class="group-select" title="Switch group">
        ${userGroups.map(g => `
          <option value="${g.id}" ${g.id === currentGroupId ? 'selected' : ''}>
            ${g.name}
          </option>
        `).join('')}
      </select>
      <span class="role-badge ${roleClass}">${roleBadge}</span>
      <button type="button" class="btn btn-icon btn-glass" id="manageGroupBtn" title="Manage group">
        <i data-lucide="settings"></i>
      </button>
      ${isSuperAdmin ? `
        <button type="button" class="btn btn-icon btn-glass" id="createGroupBtn" title="Create new group">
          <i data-lucide="plus"></i>
        </button>
      ` : ''}
    </div>
  `;

  // Bind events
  const switcher = document.getElementById('groupSwitcher');
  switcher?.addEventListener('change', (e) => {
    setCurrentGroup(e.target.value);
  });

  const manageBtn = document.getElementById('manageGroupBtn');
  manageBtn?.addEventListener('click', () => {
    openGroupManagementModal(currentGroupId);
  });

  const createBtn = document.getElementById('createGroupBtn');
  createBtn?.addEventListener('click', openCreateGroupModal);

  refreshIcons();
}

/**
 * Open group management modal
 */
export async function openGroupManagementModal(groupId) {
  const modal = document.getElementById('groupManagementModal');
  if (!modal) {
    console.error('Group management modal not found');
    return;
  }

  const content = document.getElementById('groupManagementContent');
  if (!content) return;

  modal.classList.add('show');
  content.innerHTML = '<p class="help-text">Loading group information...</p>';

  try {
    // Fetch group members
    const membersResponse = await authenticatedFetch(`/api/groups/${groupId}/members`);
    if (!membersResponse.ok) {
      throw new Error('Failed to fetch members');
    }
    const membersData = await membersResponse.json();
    const members = membersData.members || [];
    const userRole = membersData.user_role;

    // Fetch pending invites (if admin)
    let invites = [];
    if (userRole === 'admin' || userRole === 'super_admin') {
      try {
        const invitesResponse = await authenticatedFetch(`/api/groups/${groupId}/invites`);
        if (invitesResponse.ok) {
          const invitesData = await invitesResponse.json();
          invites = invitesData.invites || [];
        }
      } catch (e) {
        console.warn('Could not fetch invites:', e);
      }
    }

    const group = userGroups.find(g => g.id === groupId);
    const canManage = userRole === 'admin' || userRole === 'super_admin';
    const currentUserId = await getUserId();

    // Build UI
    let html = `
      <div class="group-management-header">
        <h3>${group?.name || 'Group'}</h3>
        <span class="member-count">${members.length} member${members.length !== 1 ? 's' : ''}</span>
      </div>
    `;

    // Members list
    html += '<div class="group-section"><h4>Members</h4><ul class="member-list">';
    members.forEach(member => {
      const isCurrentUser = member.user_id === currentUserId;
      const roleLabel = member.role === 'admin' ? 'Admin' : 'Viewer';
      const roleClass = member.role === 'admin' ? 'role-admin' : 'role-viewer';

      html += `
        <li class="member-item">
          <div class="member-info">
            <span class="member-id">${member.user_id}${isCurrentUser ? ' (you)' : ''}</span>
            <span class="role-badge ${roleClass}">${roleLabel}</span>
          </div>
          ${canManage && !isCurrentUser ? `
            <div class="member-actions">
              <select class="role-select" data-user-id="${member.user_id}" data-current-role="${member.role}">
                <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
                <option value="viewer" ${member.role === 'viewer' ? 'selected' : ''}>Viewer</option>
              </select>
              <button type="button" class="btn btn-icon btn-danger" data-remove-member="${member.user_id}" title="Remove member">
                <i data-lucide="user-minus"></i>
              </button>
            </div>
          ` : ''}
        </li>
      `;
    });
    html += '</ul></div>';

    // Pending invites (admin only)
    if (canManage) {
      html += '<div class="group-section"><h4>Pending Invites</h4>';
      if (invites.length === 0) {
        html += '<p class="help-text">No pending invites</p>';
      } else {
        html += '<ul class="invite-list">';
        invites.forEach(invite => {
          html += `
            <li class="invite-item">
              <div class="invite-info">
                <span class="invite-email">${invite.email}</span>
                <span class="role-badge role-${invite.role}">${invite.role === 'admin' ? 'Admin' : 'Viewer'}</span>
              </div>
              <button type="button" class="btn btn-icon" data-cancel-invite="${invite.id}" title="Cancel invite">
                <i data-lucide="x"></i>
              </button>
            </li>
          `;
        });
        html += '</ul>';
      }
      html += '</div>';

      // Invite form
      html += `
        <div class="group-section">
          <h4>Invite User</h4>
          <div class="invite-form">
            <input type="email" id="inviteEmail" placeholder="Email address" class="form-input">
            <select id="inviteRole" class="form-input">
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button type="button" class="btn btn-primary" id="sendInviteBtn">
              <i data-lucide="send"></i> Invite
            </button>
          </div>
        </div>
      `;
    }

    content.innerHTML = html;
    refreshIcons();

    // Bind events
    bindGroupManagementEvents(groupId, canManage);

  } catch (error) {
    console.error('Error loading group management:', error);
    content.innerHTML = `<p class="help-text" style="color: var(--text-error);">Failed to load group: ${error.message}</p>`;
  }
}

/**
 * Bind events for group management modal
 */
function bindGroupManagementEvents(groupId, canManage) {
  if (!canManage) return;

  // Role change
  document.querySelectorAll('.role-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const userId = e.target.dataset.userId;
      const newRole = e.target.value;

      try {
        const response = await authenticatedFetch(`/api/groups/${groupId}/members`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role: newRole }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update role');
        }

        // Refresh modal
        await openGroupManagementModal(groupId);
      } catch (error) {
        alert('Failed to update role: ' + error.message);
        e.target.value = e.target.dataset.currentRole;
      }
    });
  });

  // Remove member
  document.querySelectorAll('[data-remove-member]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.removeMember;
      if (!confirm('Remove this member from the group?')) return;

      try {
        const response = await authenticatedFetch(`/api/groups/${groupId}/members`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to remove member');
        }

        await openGroupManagementModal(groupId);
      } catch (error) {
        alert('Failed to remove member: ' + error.message);
      }
    });
  });

  // Cancel invite
  document.querySelectorAll('[data-cancel-invite]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const inviteId = btn.dataset.cancelInvite;

      try {
        const response = await authenticatedFetch(`/api/groups/${groupId}/invites`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteId }),
        });

        if (!response.ok) {
          throw new Error('Failed to cancel invite');
        }

        await openGroupManagementModal(groupId);
      } catch (error) {
        alert('Failed to cancel invite: ' + error.message);
      }
    });
  });

  // Send invite
  const sendInviteBtn = document.getElementById('sendInviteBtn');
  sendInviteBtn?.addEventListener('click', async () => {
    const emailInput = document.getElementById('inviteEmail');
    const roleSelect = document.getElementById('inviteRole');

    const email = emailInput?.value?.trim();
    const role = roleSelect?.value || 'viewer';

    if (!email) {
      alert('Please enter an email address');
      return;
    }

    try {
      sendInviteBtn.disabled = true;
      sendInviteBtn.innerHTML = '<i data-lucide="loader-2"></i> Sending...';
      refreshIcons();

      const response = await authenticatedFetch(`/api/groups/${groupId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send invite');
      }

      emailInput.value = '';
      await openGroupManagementModal(groupId);
    } catch (error) {
      alert('Failed to send invite: ' + error.message);
    } finally {
      sendInviteBtn.disabled = false;
      sendInviteBtn.innerHTML = '<i data-lucide="send"></i> Invite';
      refreshIcons();
    }
  });
}

/**
 * Open create group modal (super admin only)
 */
export function openCreateGroupModal() {
  const name = prompt('Enter name for the new group:');
  if (!name || !name.trim()) return;

  createGroup(name.trim());
}

/**
 * Create a new group
 */
async function createGroup(name) {
  try {
    const response = await authenticatedFetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create group');
    }

    const data = await response.json();
    await refreshGroups();
    renderGroupSwitcher();
    setCurrentGroup(data.group.id);

    alert(`Group "${name}" created successfully!`);
  } catch (error) {
    alert('Failed to create group: ' + error.message);
  }
}

/**
 * Close group management modal
 */
export function closeGroupManagementModal() {
  const modal = document.getElementById('groupManagementModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

/**
 * Get user's role in current group
 */
export function getCurrentGroupRole() {
  const group = userGroups.find(g => g.id === currentGroupId);
  return group?.role || null;
}

/**
 * Check if user can manage canvases in current group
 */
export function canManageCanvasesInCurrentGroup() {
  const role = getCurrentGroupRole();
  return role === 'super_admin' || role === 'admin';
}

// Initialize modal close handlers
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('groupManagementModal');
  const closeBtn = document.getElementById('groupManagementModalClose');
  const cancelBtn = document.getElementById('groupManagementModalCancel');

  closeBtn?.addEventListener('click', closeGroupManagementModal);
  cancelBtn?.addEventListener('click', closeGroupManagementModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeGroupManagementModal();
    }
  });
});
