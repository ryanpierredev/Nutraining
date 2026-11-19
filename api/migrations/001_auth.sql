BEGIN;

CREATE TABLE nt_schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nt_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(120) NOT NULL
    CHECK (char_length(btrim(name)) >= 2),

  email VARCHAR(254) NOT NULL,

  password_hash TEXT NOT NULL,

  role VARCHAR(20) NOT NULL
    CHECK (role IN ('student', 'trainer', 'nutritionist')),

  professional_code VARCHAR(24) UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX nt_users_email_unique
  ON nt_users (lower(email));

CREATE TABLE nt_sessions (
  token_hash VARCHAR(64) PRIMARY KEY,

  user_id UUID NOT NULL
    REFERENCES nt_users(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX nt_sessions_user_index
  ON nt_sessions(user_id);

CREATE INDEX nt_sessions_expiration_index
  ON nt_sessions(expires_at);

INSERT INTO nt_schema_migrations(version) VALUES (1);

COMMIT;
