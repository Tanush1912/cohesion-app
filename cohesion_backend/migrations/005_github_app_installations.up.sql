CREATE TABLE github_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id VARCHAR(255) NOT NULL,
    installation_id BIGINT NOT NULL,
    github_account_login VARCHAR(255) NOT NULL DEFAULT '',
    github_account_type VARCHAR(50) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clerk_user_id, installation_id)
);
CREATE INDEX idx_github_installations_clerk_user_id ON github_installations(clerk_user_id);
