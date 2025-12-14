-- Migration script: org-based model to group-based access control
-- Run this AFTER creating schema-v2.sql tables
--
-- Prerequisites:
-- 1. Back up your database
-- 2. Run schema-v2.sql to create new tables (if not exists)
-- 3. Identify the super admin user ID from Clerk
--
-- Usage: Replace 'SUPER_ADMIN_USER_ID' with the actual Clerk user ID

-- Step 1: Create the default group for migrated canvases
INSERT INTO groups (id, name, created_by_user_id)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Default',
    'SUPER_ADMIN_USER_ID'  -- Replace with actual user ID
)
ON CONFLICT (name) DO NOTHING;

-- Step 2: Add super admin as admin of the default group
INSERT INTO group_members (group_id, user_id, role, invited_by_user_id)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'SUPER_ADMIN_USER_ID',  -- Replace with actual user ID
    'admin',
    NULL
)
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Step 3: Migrate existing canvases to the default group
-- This creates new canvas records in the v2 schema
-- Note: Run this only if you have existing data in the old canvases table

-- If tables coexist (old and new), migrate data:
-- INSERT INTO canvases (id, group_id, title, slug, yaml_text, created_at, updated_at, created_by_user_id, updated_by_user_id)
-- SELECT
--     id,
--     'a0000000-0000-0000-0000-000000000001'::uuid as group_id,
--     title,
--     slug,
--     yaml_text,
--     created_at,
--     updated_at,
--     created_by_user_id,
--     updated_by_user_id
-- FROM canvases_old
-- ON CONFLICT (id) DO NOTHING;

-- Step 4: Clean up old tables (uncomment when ready)
-- DROP TABLE IF EXISTS canvas_acl;
-- DROP TABLE IF EXISTS canvases_old;
-- Note: groups and group_members tables will be replaced in-place

-- Verification queries
-- SELECT COUNT(*) as group_count FROM groups;
-- SELECT COUNT(*) as member_count FROM group_members;
-- SELECT COUNT(*) as canvas_count FROM canvases;
-- SELECT COUNT(*) as invite_count FROM group_invites;
