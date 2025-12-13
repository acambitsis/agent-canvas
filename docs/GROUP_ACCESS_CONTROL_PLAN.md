# Group-Based Access Control Implementation Plan

## Overview

This plan transforms AgentCanvas from a personal/org-based model to a **group-based access control** system. Canvases belong to groups, users belong to groups with specific roles, and access is managed through group membership.

**Key Principles:**
- No Clerk orgs (staying on free tier)
- Clerk used only for authentication (login, user identity, email)
- All group/permission logic lives in our Postgres database
- Simple role model: Super Admin → Group Admin → Viewer

---

## Data Model

### Roles

| Role | Scope | Capabilities |
|------|-------|--------------|
| **Super Admin** | Global | Create groups, manage any group, full access to everything |
| **Group Admin** | Per-group | Create/delete canvases, add/remove users, promote/demote users |
| **Viewer** | Per-group | View canvases, invite new users (as viewers) |

### Database Schema Changes

```sql
-- Remove org_id dependency from groups table
-- Groups are now standalone entities

-- Updated groups table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,  -- Globally unique, no org scoping
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_user_id TEXT NOT NULL
);

-- Updated group_members table with role
CREATE TABLE group_members (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')) DEFAULT 'viewer',
    invited_by_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (group_id, user_id)
);

-- Pending invites (for users not yet in system)
CREATE TABLE group_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')) DEFAULT 'viewer',
    invited_by_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),

    UNIQUE (group_id, email)
);

-- Updated canvases table - belongs to group, no personal/org distinction
CREATE TABLE canvases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    yaml_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_user_id TEXT NOT NULL,
    updated_by_user_id TEXT NOT NULL,

    -- Unique slug within group
    CONSTRAINT unique_group_slug UNIQUE (group_id, slug)
);

-- canvas_acl table is NO LONGER NEEDED (access is via group membership)
-- DROP TABLE IF EXISTS canvas_acl;
```

### Environment Variables

```bash
# Comma-separated list of super admin emails
SUPER_ADMIN_EMAILS=admin@example.com,owner@example.com
```

---

## Implementation Phases

### Phase 1: Database Migration

**File: `db/schema-v2.sql`**

Create new schema file that:
1. Drops old tables (with data migration if needed)
2. Creates new tables with updated structure
3. Adds indexes for performance

**Migration Script: `db/migrate-to-groups.sql`**

If existing data needs migration:
1. Create new tables alongside old ones
2. Migrate canvases to a default group
3. Migrate users to that group as admins
4. Drop old tables

**Tasks:**
- [ ] Create `db/schema-v2.sql` with new table definitions
- [ ] Create `db/migrate-to-groups.sql` for data migration (if needed)
- [ ] Document manual steps to run migration on Neon

---

### Phase 2: Backend API Updates

#### 2.1 Super Admin Helper

**File: `api/lib/super-admin.js`**

```javascript
export function isSuperAdmin(email) {
  const superAdmins = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return superAdmins.includes(email?.toLowerCase());
}
```

**Tasks:**
- [ ] Create `api/lib/super-admin.js`
- [ ] Add `SUPER_ADMIN_EMAILS` to Vercel environment variables

#### 2.2 Permissions Rewrite

**File: `api/lib/permissions.js`**

Replace current org-based logic with group-based:

```javascript
/**
 * Get user's role in a group
 * @returns {Promise<'super_admin' | 'admin' | 'viewer' | null>}
 */
export async function getGroupRole(userId, email, groupId) {
  if (isSuperAdmin(email)) return 'super_admin';

  const membership = await queryOne(
    `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );

  return membership?.role || null;
}

/**
 * Check if user can view canvases in a group
 */
export async function canViewGroup(userId, email, groupId) {
  const role = await getGroupRole(userId, email, groupId);
  return role !== null; // Any role can view
}

/**
 * Check if user can create/delete canvases in a group
 */
export async function canManageCanvases(userId, email, groupId) {
  const role = await getGroupRole(userId, email, groupId);
  return role === 'super_admin' || role === 'admin';
}

/**
 * Check if user can manage group members
 */
export async function canManageMembers(userId, email, groupId) {
  const role = await getGroupRole(userId, email, groupId);
  return role === 'super_admin' || role === 'admin';
}

/**
 * Check if user can invite others (any member can invite as viewer)
 */
export async function canInviteToGroup(userId, email, groupId) {
  const role = await getGroupRole(userId, email, groupId);
  return role !== null; // Any member can invite
}

/**
 * Check if user can create new groups
 */
export async function canCreateGroup(email) {
  return isSuperAdmin(email);
}

/**
 * Get all groups user has access to
 */
export async function getUserGroups(userId, email) {
  // Super admins see all groups
  if (isSuperAdmin(email)) {
    return await queryAll(`SELECT * FROM groups ORDER BY name`);
  }

  return await queryAll(
    `SELECT g.*, gm.role
     FROM groups g
     INNER JOIN group_members gm ON g.id = gm.group_id
     WHERE gm.user_id = $1
     ORDER BY g.name`,
    [userId]
  );
}

/**
 * Get all canvases user can access
 */
export async function getAccessibleCanvases(userId, email) {
  const groups = await getUserGroups(userId, email);
  const groupIds = groups.map(g => g.id);

  if (groupIds.length === 0) return [];

  return await queryAll(
    `SELECT c.*, g.name as group_name
     FROM canvases c
     INNER JOIN groups g ON c.group_id = g.id
     WHERE c.group_id = ANY($1)
     ORDER BY g.name, c.title`,
    [groupIds]
  );
}
```

**Tasks:**
- [ ] Rewrite `api/lib/permissions.js` with group-based logic
- [ ] Add helper functions for role checking
- [ ] Remove all org-related code

#### 2.3 Groups API Update

**File: `api/groups.js`**

Update to remove org dependency, add super admin check for creation:

```javascript
// GET /api/groups - List groups user belongs to
// POST /api/groups - Create group (super admin only)

export default async function handler(req, res) {
  const auth = await requireAuth(req);
  const { userId, email } = auth;

  if (req.method === 'GET') {
    const groups = await getUserGroups(userId, email);
    return json(res, 200, { groups });
  }

  if (req.method === 'POST') {
    if (!canCreateGroup(email)) {
      return json(res, 403, { error: 'Only super admins can create groups' });
    }
    // ... create group logic
  }
}
```

**Tasks:**
- [ ] Update `api/groups.js` to remove org requirement
- [ ] Add super admin check for group creation
- [ ] Return user's role with each group in list response

#### 2.4 Group Members API Update

**File: `api/groups/[id]/members.js`**

Update to use new permission model:

```javascript
// GET - List members (any member can view)
// POST - Add member (admin can set role, viewer can only invite as viewer)
// PUT - Update member role (admin only)
// DELETE - Remove member (admin only, can't remove self if last admin)
```

**Tasks:**
- [ ] Update to use `canManageMembers()` for admin actions
- [ ] Allow viewers to POST (invite) but only as 'viewer' role
- [ ] Add PUT handler for role changes
- [ ] Prevent removing last admin from group
- [ ] Remove org_id requirement

#### 2.5 Invites API (New)

**File: `api/groups/[id]/invites.js`**

Handle email-based invitations:

```javascript
// GET - List pending invites for group
// POST - Create invite (sends email)
// DELETE - Cancel invite

export default async function handler(req, res) {
  const auth = await requireAuth(req);
  const { userId, email } = auth;
  const groupId = req.query.id;

  if (req.method === 'POST') {
    const { email: inviteeEmail, role } = req.body;

    // Check inviter's permissions
    const canInvite = await canInviteToGroup(userId, email, groupId);
    if (!canInvite) {
      return json(res, 403, { error: 'Not authorized to invite' });
    }

    // Viewers can only invite as viewers
    const inviterRole = await getGroupRole(userId, email, groupId);
    const effectiveRole = (inviterRole === 'viewer') ? 'viewer' : (role || 'viewer');

    // Check if user already exists in Clerk
    const existingUser = await findClerkUserByEmail(inviteeEmail);

    if (existingUser) {
      // Add directly to group
      await addMemberToGroup(groupId, existingUser.id, effectiveRole, userId);
      // Send notification email
      await sendGroupAddedEmail(inviteeEmail, groupName);
    } else {
      // Create pending invite
      await createPendingInvite(groupId, inviteeEmail, effectiveRole, userId);
      // Send invite email with sign-up link
      await sendInviteEmail(inviteeEmail, groupName, inviteLink);
    }

    return json(res, 201, { success: true });
  }
}
```

**Tasks:**
- [ ] Create `api/groups/[id]/invites.js`
- [ ] Implement invite creation with email sending
- [ ] Handle existing vs new users
- [ ] Add invite expiration logic (7 days)
- [ ] Create email templates for invites

#### 2.6 Accept Invite Flow

**File: `api/invites/accept.js`**

Handle invite acceptance after user signs up:

```javascript
// Called after successful Clerk sign-up/sign-in
// Checks for pending invites for user's email
// Adds user to groups and deletes pending invites

export default async function handler(req, res) {
  const auth = await requireAuth(req);
  const { userId, email } = auth;

  // Find pending invites for this email
  const invites = await queryAll(
    `SELECT * FROM group_invites
     WHERE email = $1 AND expires_at > now()`,
    [email]
  );

  for (const invite of invites) {
    // Add to group
    await query(
      `INSERT INTO group_members (group_id, user_id, role, invited_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [invite.group_id, userId, invite.role, invite.invited_by_user_id]
    );
  }

  // Delete processed invites
  await query(`DELETE FROM group_invites WHERE email = $1`, [email]);

  return json(res, 200, { processed: invites.length });
}
```

**Tasks:**
- [ ] Create `api/invites/accept.js`
- [ ] Call this endpoint after Clerk authentication succeeds
- [ ] Update client auth flow to check for pending invites

#### 2.7 Config API Update

**File: `api/config.js`**

Update to work with group-based canvases:

```javascript
// GET with list=1 - List canvases from user's groups
// GET with doc=X - Get specific canvas (if user has access via group)
// POST - Create/update canvas (requires admin role in target group)
// DELETE - Delete canvas (requires admin role in canvas's group)
```

Key changes:
- Remove `scope_type`, `owner_user_id`, `org_id` logic
- Add `group_id` to canvas creation (required parameter)
- Check group membership for access
- Check admin role for create/delete

**Tasks:**
- [ ] Update GET to use `getAccessibleCanvases()`
- [ ] Update POST to require `group_id` parameter
- [ ] Check `canManageCanvases()` for create/update/delete
- [ ] Return `group_id` and `group_name` with canvas data
- [ ] Remove all org-related code

---

### Phase 3: Frontend Updates

#### 3.1 Auth Flow Update

**File: `auth-client.js`**

After successful authentication, check for pending invites:

```javascript
async function onAuthSuccess() {
  // Process any pending invites for this email
  await authenticatedFetch('/api/invites/accept', { method: 'POST' });

  // Continue with normal flow
  await loadUserGroups();
}
```

**Tasks:**
- [ ] Add invite acceptance call after auth
- [ ] Remove org-related helpers (`getOrgId()`, etc.)

#### 3.2 Group Context UI

**File: `main.js` / new `groups.js`**

Add group switcher and context:

```javascript
let currentGroupId = null;
let userGroups = [];

async function loadUserGroups() {
  const response = await authenticatedFetch('/api/groups');
  const { groups } = await response.json();
  userGroups = groups;

  // Set default group (first one, or from localStorage)
  const savedGroupId = localStorage.getItem('currentGroupId');
  currentGroupId = savedGroupId && groups.find(g => g.id === savedGroupId)
    ? savedGroupId
    : groups[0]?.id;

  renderGroupSwitcher();
  await loadCanvases();
}

function renderGroupSwitcher() {
  // Dropdown in header showing current group
  // Option to switch groups
  // Shows user's role badge next to each group
}
```

**Tasks:**
- [ ] Add group state management
- [ ] Create group switcher UI component
- [ ] Show role badge (admin/viewer) per group
- [ ] Persist selected group in localStorage
- [ ] Filter canvases by current group

#### 3.3 Group Management UI

**File: `groups-ui.js` (new) or integrated into `main.js`**

Group management modal for admins:

```javascript
function renderGroupManagementModal(groupId) {
  // Tab 1: Members
  //   - List current members with roles
  //   - Invite button (opens invite form)
  //   - For admins: change role dropdown, remove button

  // Tab 2: Pending Invites (admin only)
  //   - List pending invites with expiration
  //   - Cancel invite button

  // Tab 3: Settings (admin only)
  //   - Rename group
  //   - Delete group (super admin only)
}

function renderInviteForm(groupId, userRole) {
  // Email input
  // Role selector (only if user is admin)
  // Send invite button
}
```

**Tasks:**
- [ ] Create group management modal
- [ ] Member list with role badges
- [ ] Invite form (email + role)
- [ ] Role change dropdown (admin only)
- [ ] Remove member button (admin only)
- [ ] Pending invites list

#### 3.4 Canvas Creation Update

**File: `documents.js`**

Update canvas creation to require group selection:

```javascript
function showNewCanvasModal() {
  // If user is in multiple groups with admin role, show group selector
  // Otherwise auto-select the current group
  // Validate user has admin role before allowing creation
}
```

**Tasks:**
- [ ] Add group selector to new canvas flow
- [ ] Disable create button if user is viewer in all groups
- [ ] Show helpful message for viewers ("Ask a group admin to create canvases")

#### 3.5 Permission-Based UI

Throughout the UI, show/hide actions based on role:

| Element | Viewer | Admin | Super Admin |
|---------|--------|-------|-------------|
| View canvas | ✓ | ✓ | ✓ |
| Edit canvas content | ✓ | ✓ | ✓ |
| Create canvas | ✗ | ✓ | ✓ |
| Delete canvas | ✗ | ✓ | ✓ |
| Rename canvas | ✗ | ✓ | ✓ |
| Invite users | ✓ (as viewer) | ✓ (any role) | ✓ (any role) |
| Remove users | ✗ | ✓ | ✓ |
| Change roles | ✗ | ✓ | ✓ |
| Create groups | ✗ | ✗ | ✓ |
| Delete groups | ✗ | ✗ | ✓ |

**Tasks:**
- [ ] Add role-based visibility throughout UI
- [ ] Fetch and cache current user's role per group
- [ ] Hide/disable actions based on role
- [ ] Show role indicator in UI

#### 3.6 Super Admin UI

For super admins, add a simple admin panel:

```javascript
function renderSuperAdminPanel() {
  // Only visible to super admins
  // Create new group form
  // List all groups with member counts
  // Quick actions: view group, add self to group
}
```

**Tasks:**
- [ ] Add super admin panel (accessible from header menu)
- [ ] Create group form
- [ ] All groups list
- [ ] Only render for super admins

---

### Phase 4: Email Templates

#### 4.1 Invite Email

**File: `api/lib/email-templates.js`**

```javascript
export function getInviteEmailHtml(groupName, inviterName, signUpUrl) {
  return `
    <h1>You've been invited to ${groupName}</h1>
    <p>${inviterName} has invited you to collaborate on AgentCanvas.</p>
    <p><a href="${signUpUrl}">Click here to join</a></p>
    <p>This invite expires in 7 days.</p>
  `;
}

export function getAddedToGroupEmailHtml(groupName, inviterName, loginUrl) {
  return `
    <h1>You've been added to ${groupName}</h1>
    <p>${inviterName} added you to their group on AgentCanvas.</p>
    <p><a href="${loginUrl}">Click here to view</a></p>
  `;
}
```

**Tasks:**
- [ ] Create invite email template
- [ ] Create "added to group" notification template
- [ ] Integrate with Resend

---

### Phase 5: Testing

#### 5.1 Permission Tests

```javascript
describe('Group Permissions', () => {
  test('viewer can view canvases but not create');
  test('admin can create and delete canvases');
  test('viewer can invite as viewer only');
  test('admin can invite with any role');
  test('super admin can create groups');
  test('super admin can access any group');
});
```

#### 5.2 Invite Flow Tests

```javascript
describe('Invite Flow', () => {
  test('invite creates pending invite for new email');
  test('invite adds existing user directly');
  test('pending invite is processed on sign-up');
  test('expired invites are not processed');
});
```

**Tasks:**
- [ ] Add permission unit tests
- [ ] Add invite flow integration tests
- [ ] Add E2E test for full invite → sign-up → access flow

---

## Migration Checklist

### Pre-Migration
- [ ] Back up current database
- [ ] Document current users and their canvases
- [ ] Set `SUPER_ADMIN_EMAILS` env var

### Database Migration
- [ ] Run schema-v2.sql on Neon (creates new tables)
- [ ] Run migration script to move existing data
- [ ] Verify data integrity
- [ ] Drop old tables

### Deployment
- [ ] Deploy backend API changes
- [ ] Deploy frontend changes
- [ ] Test invite flow end-to-end
- [ ] Test super admin functions

### Post-Migration
- [ ] Verify all existing users can access their canvases
- [ ] Create initial groups via super admin
- [ ] Invite users to appropriate groups
- [ ] Monitor for errors

---

## File Changes Summary

### New Files
- `db/schema-v2.sql` - New database schema
- `db/migrate-to-groups.sql` - Migration script
- `api/lib/super-admin.js` - Super admin helper
- `api/groups/[id]/invites.js` - Invite management API
- `api/invites/accept.js` - Accept invite API
- `api/lib/email-templates.js` - Email templates

### Modified Files
- `api/lib/permissions.js` - Complete rewrite for group-based access
- `api/groups.js` - Remove org dependency, add super admin check
- `api/groups/[id]/members.js` - Add role management
- `api/config.js` - Use group-based access
- `auth-client.js` - Add invite acceptance flow
- `main.js` - Add group context and switcher
- `documents.js` - Update canvas creation
- `index.html` - Add group management UI elements
- `styles.css` - Add group-related styles

### Removed/Deprecated
- `api/canvases/[id]/shares.js` - No longer needed (access via groups)
- All org-related code paths

---

## API Endpoint Summary

| Endpoint | Method | Access | Description |
|----------|--------|--------|-------------|
| `/api/groups` | GET | Any authenticated | List user's groups |
| `/api/groups` | POST | Super admin | Create group |
| `/api/groups/[id]` | PUT | Super admin | Update group |
| `/api/groups/[id]` | DELETE | Super admin | Delete group |
| `/api/groups/[id]/members` | GET | Group member | List members |
| `/api/groups/[id]/members` | POST | Group member | Add member |
| `/api/groups/[id]/members` | PUT | Group admin | Change role |
| `/api/groups/[id]/members` | DELETE | Group admin | Remove member |
| `/api/groups/[id]/invites` | GET | Group admin | List pending invites |
| `/api/groups/[id]/invites` | POST | Group member | Create invite |
| `/api/groups/[id]/invites` | DELETE | Group admin | Cancel invite |
| `/api/invites/accept` | POST | Authenticated | Process pending invites |
| `/api/config` | GET | Group member | List/get canvases |
| `/api/config` | POST | Group admin | Create/update canvas |
| `/api/config` | DELETE | Group admin | Delete canvas |

---

## Estimated Effort

| Phase | Complexity | Notes |
|-------|------------|-------|
| Phase 1: Database | Low | Schema is straightforward, migration needs care |
| Phase 2: Backend API | Medium | Most logic already exists, needs refactoring |
| Phase 3: Frontend | Medium-High | New UI components for group management |
| Phase 4: Email | Low | Simple templates |
| Phase 5: Testing | Medium | Important for permissions |

---

## Open Questions

1. **First-time user experience**: What happens when a user signs up without an invite?
   - Option A: They see an empty state until invited to a group
   - Option B: Super admin pre-creates invites before sharing the app

2. **Leaving groups**: Can users leave groups voluntarily?
   - Probably yes, with a "Leave group" button

3. **Transfer ownership**: What if the last admin wants to leave?
   - Require promoting another member first, or transferring to super admin

4. **Audit logging**: Should we track who did what?
   - Could add `action_log` table for compliance needs

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (Database) - can be done independently
3. Phase 2 (Backend) builds on Phase 1
4. Phase 3 (Frontend) can partially parallel Phase 2
5. Phase 4-5 complete the implementation
