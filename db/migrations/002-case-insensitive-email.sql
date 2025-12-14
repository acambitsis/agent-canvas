-- Migration: Add case-insensitive unique constraint on group_invites.email
-- Purpose: Fix security vulnerability where duplicate invites could be created with different email casing
-- Date: 2025-12-14

-- Step 1: Remove old case-sensitive constraint if it exists
ALTER TABLE group_invites DROP CONSTRAINT IF EXISTS group_invites_group_id_email_key;

-- Step 2: Clean up any duplicate emails that differ only in case
-- Keep the oldest invite for each (group_id, LOWER(email)) combination
DELETE FROM group_invites
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY group_id, LOWER(email)
                   ORDER BY created_at ASC
               ) as row_num
        FROM group_invites
    ) t
    WHERE row_num > 1
);

-- Step 3: Create case-insensitive unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_invites_email_case_insensitive
ON group_invites (group_id, LOWER(email));
