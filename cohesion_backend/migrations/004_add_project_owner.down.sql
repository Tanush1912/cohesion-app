DROP INDEX IF EXISTS idx_projects_owner_id;
ALTER TABLE projects DROP COLUMN IF EXISTS owner_id;
