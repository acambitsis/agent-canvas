/**
 * Migration script: Blob Storage → Neon Postgres
 * 
 * Migrates existing YAML documents from Vercel Blob Storage to Neon Postgres canvases.
 * 
 * Usage:
 *   node scripts/migrate-blob-to-db.js [--owner-user-id <userId>] [--org-id <orgId>] [--scope personal|org]
 * 
 * Environment variables required:
 *   - DATABASE_URL: Neon Postgres connection string
 *   - BLOB_READ_WRITE_TOKEN: Vercel Blob storage token
 *   - CLERK_SECRET_KEY: Clerk secret key (for verifying user/org IDs)
 * 
 * Examples:
 *   # Migrate to personal canvas owned by user
 *   node scripts/migrate-blob-to-db.js --owner-user-id user_xxx --scope personal
 * 
 *   # Migrate to org canvas
 *   node scripts/migrate-blob-to-db.js --org-id org_xxx --scope org
 */

import { list, head } from '@vercel/blob';
import { neon } from '@neondatabase/serverless';
import { createClerkClient } from '@clerk/backend';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, shortName) => {
  const fullIndex = args.indexOf(`--${name}`);
  const shortIndex = shortName ? args.indexOf(`-${shortName}`) : -1;
  const index = fullIndex !== -1 ? fullIndex : shortIndex;
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const ownerUserId = getArg('owner-user-id', 'u');
const orgId = getArg('org-id', 'o');
const scope = getArg('scope', 's') || 'personal';

// Validate arguments
if (scope !== 'personal' && scope !== 'org') {
  console.error('Error: scope must be "personal" or "org"');
  process.exit(1);
}

if (scope === 'personal' && !ownerUserId) {
  console.error('Error: --owner-user-id is required for personal scope');
  process.exit(1);
}

if (scope === 'org' && (!orgId || !ownerUserId)) {
  console.error('Error: --org-id and --owner-user-id are required for org scope');
  process.exit(1);
}

// Initialize connections
const dbUrl = process.env.DATABASE_URL;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

if (!dbUrl) {
  console.error('Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

if (!blobToken) {
  console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is not set');
  process.exit(1);
}

if (!clerkSecretKey) {
  console.error('Error: CLERK_SECRET_KEY environment variable is not set');
  process.exit(1);
}

const sql = neon(dbUrl);
const clerk = createClerkClient({ secretKey: clerkSecretKey });

// Verify user exists
async function verifyUser(userId) {
  try {
    const user = await clerk.users.getUser(userId);
    return user !== null;
  } catch (error) {
    console.error(`Error verifying user ${userId}:`, error.message);
    return false;
  }
}

// Verify org exists and user is member
async function verifyOrg(orgId, userId) {
  try {
    const org = await clerk.organizations.getOrganization({ organizationId: orgId });
    if (!org) return false;
    
    const membership = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      userId,
    });
    
    return membership && membership.length > 0;
  } catch (error) {
    console.error(`Error verifying org ${orgId}:`, error.message);
    return false;
  }
}

// Extract title from YAML text
function extractTitle(yamlText) {
  try {
    const titleMatch = yamlText.match(/^title:\s*(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

// Sanitize slug from filename
function sanitizeSlug(filename) {
  return filename.replace(/\.yaml$/, '').replace(/\.yml$/, '').replace(/[^A-Za-z0-9._-]/g, '-');
}

async function main() {
  console.log('Starting migration from Blob Storage to Neon Postgres...');
  console.log(`Scope: ${scope}`);
  console.log(`Owner User ID: ${ownerUserId}`);
  if (orgId) console.log(`Org ID: ${orgId}`);
  console.log('');

  // Verify user
  console.log(`Verifying user ${ownerUserId}...`);
  const userExists = await verifyUser(ownerUserId);
  if (!userExists) {
    console.error(`Error: User ${ownerUserId} not found in Clerk`);
    process.exit(1);
  }
  console.log('✓ User verified');

  // Verify org if needed
  if (scope === 'org') {
    console.log(`Verifying org ${orgId} and membership...`);
    const orgValid = await verifyOrg(orgId, ownerUserId);
    if (!orgValid) {
      console.error(`Error: Org ${orgId} not found or user is not a member`);
      process.exit(1);
    }
    console.log('✓ Org verified');
  }

  console.log('');

  // List all YAML files from Blob
  console.log('Fetching documents from Blob Storage...');
  let blobs;
  try {
    const result = await list({ token: blobToken, limit: 1000 });
    blobs = result.blobs.filter(
      blob => blob.pathname.endsWith('.yaml') || blob.pathname.endsWith('.yml')
    );
    console.log(`Found ${blobs.length} YAML documents`);
  } catch (error) {
    console.error('Error listing blobs:', error);
    process.exit(1);
  }

  if (blobs.length === 0) {
    console.log('No documents to migrate.');
    return;
  }

  console.log('');

  // Migrate each document
  let successCount = 0;
  let errorCount = 0;

  for (const blob of blobs) {
    const filename = blob.pathname;
    console.log(`Migrating: ${filename}...`);

    try {
      // Fetch YAML content
      const { url } = await head(filename, { token: blobToken });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.status}`);
      }
      const yamlText = await response.text();

      // Extract title and slug
      const title = extractTitle(yamlText) || sanitizeSlug(filename);
      const slug = sanitizeSlug(filename);

      // Check if canvas already exists
      const existing = await sql(
        scope === 'org'
          ? `SELECT * FROM canvases WHERE scope_type = $1 AND org_id = $2 AND slug = $3`
          : `SELECT * FROM canvases WHERE scope_type = $1 AND owner_user_id = $2 AND slug = $3`,
        scope === 'org' ? [scope, orgId, slug] : [scope, ownerUserId, slug]
      );

      if (existing && existing.length > 0) {
        console.log(`  ⚠ Canvas with slug "${slug}" already exists, skipping`);
        continue;
      }

      // Insert into database
      await sql(
        `INSERT INTO canvases (scope_type, owner_user_id, org_id, title, slug, yaml_text, created_by_user_id, updated_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [scope, ownerUserId, orgId || null, title, slug, yamlText, ownerUserId, ownerUserId]
      );

      console.log(`  ✓ Migrated as "${title}" (slug: ${slug})`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('Migration complete!');
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

