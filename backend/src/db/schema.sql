CREATE TABLE IF NOT EXISTS workspaces (
  id         UUID PRIMARY KEY,
  state      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The undo stack lives next to the workspace it belongs to.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]';
