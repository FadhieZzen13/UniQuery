-- Phase 4: archive partitions + RLS guards

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS questions_archive (
  id UUID NOT NULL,
  course_id UUID NOT NULL,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'OPEN',
  hot_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  body_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED,
  archived_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, archived_at)
) PARTITION BY RANGE (archived_at);

CREATE TABLE IF NOT EXISTS answers_archive (
  id UUID NOT NULL,
  question_id UUID NOT NULL,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  is_accepted BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, archived_at)
) PARTITION BY RANGE (archived_at);

ALTER TABLE questions_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS questions_archive_read ON questions_archive;
CREATE POLICY questions_archive_read ON questions_archive
  FOR SELECT USING (true);

DROP POLICY IF EXISTS answers_archive_read ON answers_archive;
CREATE POLICY answers_archive_read ON answers_archive
  FOR SELECT USING (true);

DROP POLICY IF EXISTS questions_archive_no_update ON questions_archive;
CREATE POLICY questions_archive_no_update ON questions_archive
  FOR UPDATE USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS answers_archive_no_update ON answers_archive;
CREATE POLICY answers_archive_no_update ON answers_archive
  FOR UPDATE USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS questions_archive_no_delete ON questions_archive;
CREATE POLICY questions_archive_no_delete ON questions_archive
  FOR DELETE USING (false);

DROP POLICY IF EXISTS answers_archive_no_delete ON answers_archive;
CREATE POLICY answers_archive_no_delete ON answers_archive
  FOR DELETE USING (false);
