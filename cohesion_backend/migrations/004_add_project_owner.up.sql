ALTER TABLE projects ADD COLUMN owner_id VARCHAR(255) NOT NULL DEFAULT '';
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
