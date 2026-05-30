-- Phase 4b: compatibility columns for UI

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reputation INT NOT NULL DEFAULT 0;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false;
