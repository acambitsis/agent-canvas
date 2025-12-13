# Migration Guide: Clerk + Neon Multi-User System

This guide covers the migration from magic-link auth + Blob storage to Clerk authentication + Neon Postgres.

## Overview

The application has been upgraded to support:
- **Clerk authentication** (replaces magic-link auth)
- **Neon Postgres** storage (replaces Vercel Blob Storage)
- **Multi-user support** with personal and org canvases
- **Group-based sharing** for org canvases

## Environment Variables

Add these to your Vercel project:

### Required
- `CLERK_PUBLISHABLE_KEY` - Clerk publishable key (frontend)
- `CLERK_SECRET_KEY` - Clerk secret key (backend)
- `DATABASE_URL` - Neon Postgres connection string

### Optional (for migration)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob token (only needed for migration script)

## Setup Steps

### 1. Create Neon Database

**Option A: Using Neon CLI (Recommended)**

The Neon CLI is already installed. To create a new project:

```bash
neon projects create --name agent-canvas --region-id aws-us-east-2
```

This will create a project and display the connection string. Copy it and set as `DATABASE_URL` in Vercel.

**Option B: Using Neon Dashboard**

1. Create a Neon database at https://neon.tech
2. Copy the connection string (format: `postgresql://user:pass@host/dbname`)
3. Set `DATABASE_URL` in Vercel environment variables

**Note:** A Neon project named "agent-canvas-eu" has been created in **EU Central (Frankfurt)**.

**Important:** Do **not** store `DATABASE_URL` (or any connection string credentials) in git. Set it via Vercel environment variables (and optionally `.env.local` for local dev).

**Project Details (non-secret):**
- **Project ID:** `shy-sun-41379197`
- **Region:** aws-eu-central-1 (Frankfurt, Germany)
- **Status:** Schema applied and ready to use

### 2. Run Database Schema

Execute the schema file to create tables:

```bash
export DATABASE_URL="your-connection-string-here"
node scripts/setup-db.js
```

Or use Neon's SQL editor in the dashboard to paste and run `db/schema.sql`.

**Note:** The schema has already been applied to the "agent-canvas-eu" Neon project in EU Central.

### 3. Set Up Clerk

1. Create a Clerk account at https://clerk.com
2. Create a new application
3. Copy the publishable key and secret key
4. Set `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in Vercel
5. Configure Clerk:
   - Enable Organizations (if you want org canvases)
   - Set up your authentication methods (email, OAuth, etc.)

### 4. Configure Frontend

The frontend needs access to the Clerk publishable key. You can either:

**Option A: Environment variable (recommended for Vercel)**
- Set `VITE_CLERK_PUBLISHABLE_KEY` in Vercel (or use `CLERK_PUBLISHABLE_KEY`)

**Option B: Window variable**
- Add to `index.html` and `login.html`:
```html
<script>
  window.CLERK_PUBLISHABLE_KEY = 'pk_test_...';
</script>
```

### 5. Migrate Existing Data

Run the migration script to move existing YAML documents from Blob Storage to Neon:

```bash
# For personal canvases
node scripts/migrate-blob-to-db.js \
  --owner-user-id user_xxx \
  --scope personal

# For org canvases
node scripts/migrate-blob-to-db.js \
  --owner-user-id user_xxx \
  --org-id org_xxx \
  --scope org
```

The script requires:
- `DATABASE_URL` environment variable
- `BLOB_READ_WRITE_TOKEN` environment variable
- `CLERK_SECRET_KEY` environment variable

## API Changes

### Authentication
- All API requests now require `Authorization: Bearer <ClerkJWT>` header
- JWT tokens are obtained from Clerk SDK (`Clerk.session.getToken()`)

### Canvas Identifiers
- Canvases are identified by UUID (`id`) or `slug`
- The API maintains backward compatibility with `.yaml` filenames
- Document list now returns `id`, `slug`, `title`, `scope_type`, `org_id`

### New Endpoints

**Groups:**
- `GET /api/groups` - List groups in current org
- `POST /api/groups` - Create a group
- `GET /api/groups/:id/members` - List group members
- `POST /api/groups/:id/members` - Add member to group
- `DELETE /api/groups/:id/members` - Remove member from group

**Canvas Shares:**
- `GET /api/canvases/:id/shares` - List shares for a canvas
- `POST /api/canvases/:id/shares` - Share canvas with user/group
- `DELETE /api/canvases/:id/shares` - Remove share

## Permission Model

- **Personal canvases**: Owned by a user, can be shared with other users
- **Org canvases**: Owned by a user within an org, can be shared with org members or groups
- **Sharing**: RW-only (anyone with access can edit)
- **Deletion**: Only owner can delete

## Breaking Changes

1. **Authentication**: Magic-link auth removed, must use Clerk
2. **Storage**: Blob Storage no longer used (after migration)
3. **Document names**: Now use `slug` instead of filename (backward compatible)
4. **Multi-user**: Documents are now user/org-scoped

## Rollback Plan

If you need to rollback:
1. Keep the old Blob Storage code in git history
2. Revert environment variables
3. The old code will still work with Blob Storage

## Troubleshooting

**"Clerk publishable key not found"**
- Ensure `VITE_CLERK_PUBLISHABLE_KEY` or `CLERK_PUBLISHABLE_KEY` is set
- Check that Clerk SDK is loaded before initialization

**"Authentication required"**
- Verify Clerk JWT token is being sent in `Authorization` header
- Check that `CLERK_SECRET_KEY` is correct

**"Database connection failed"**
- Verify `DATABASE_URL` is correct
- Check Neon database is accessible
- Ensure schema has been applied

**"Organization context required"**
- User must be in an organization context to use groups
- Use Clerk OrganizationSwitcher to switch orgs

