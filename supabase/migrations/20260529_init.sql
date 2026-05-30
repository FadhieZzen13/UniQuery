-- Best-effort schema based on brief (pending SDD appendices)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Option 1 reset: drop existing tables to avoid type conflicts
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS analytics_snapshots CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS moderation_audit_log CASCADE;
DROP TABLE IF EXISTS flags CASCADE;
DROP TABLE IF EXISTS identity_markers CASCADE;
DROP TABLE IF EXISTS question_tags CASCADE;
DROP TABLE IF EXISTS bookmarks CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS faculties CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;

DO $$
BEGIN
  CREATE ROLE moderation_role;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN RAISE NOTICE 'Skipping role creation (insufficient_privilege).';
END $$;

CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faculties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  institutional_email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'STUDENT',
  pdpa_consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('STUDENT', 'FACULTY', 'ADMIN'))
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jwt_fingerprint TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES faculties(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT courses_status_check CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  UNIQUE (institution_id, code)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'STUDENT',
  pseudonymous_alias TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_role_check CHECK (role IN ('STUDENT', 'TA', 'FACULTY')),
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'OPEN',
  hot_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  body_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED,
  CONSTRAINT questions_status_check CHECK (status IN ('OPEN', 'HIDDEN', 'LOCKED', 'ARCHIVED'))
);

CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  is_accepted BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT answers_status_check CHECK (status IN ('OPEN', 'HIDDEN', 'LOCKED', 'ARCHIVED'))
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  value INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT votes_target_check CHECK (target_type IN ('QUESTION', 'ANSWER')),
  CONSTRAINT votes_value_check CHECK (value IN (-1, 1)),
  UNIQUE (voter_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS question_tags (
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);

CREATE TABLE IF NOT EXISTS identity_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  encrypted_user_id BYTEA NOT NULL,
  data_key_id TEXT NOT NULL,
  hashed_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT identity_markers_target_check CHECK (target_type IN ('QUESTION', 'ANSWER'))
);

CREATE TABLE IF NOT EXISTS flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT flags_status_check CHECK (status IN ('OPEN', 'RESOLVED')),
  CONSTRAINT flags_target_check CHECK (target_type IN ('QUESTION', 'ANSWER')),
  UNIQUE (reporter_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS moderation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  delivery_channel TEXT NOT NULL DEFAULT 'IN_APP',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_status_check CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_questions_course_hot ON questions (course_id, hot_score DESC);
CREATE INDEX IF NOT EXISTS idx_questions_body_tsv ON questions USING GIN (body_tsv);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers (question_id);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_flags_target ON flags (target_type, target_id);

ALTER TABLE identity_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY moderation_only ON identity_markers
  FOR SELECT TO moderation_role USING (true);

CREATE OR REPLACE FUNCTION compute_hot_score(question_id UUID)
RETURNS NUMERIC AS $$
  SELECT
    COALESCE(SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END), 0)
  FROM votes
  WHERE target_type = 'QUESTION' AND target_id = $1;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION recompute_question_hot_score()
RETURNS TRIGGER AS $$
DECLARE
  affected_question_id UUID;
  affected_target_type TEXT;
BEGIN
  affected_question_id := COALESCE(NEW.target_id, OLD.target_id);
  affected_target_type := COALESCE(NEW.target_type, OLD.target_type);

  UPDATE questions
  SET hot_score = (
    (SELECT compute_hot_score(affected_question_id)) /
    power((EXTRACT(EPOCH FROM (now() - created_at)) / 3600 + 2), 1.5)
  )
  WHERE id = affected_question_id AND affected_target_type = 'QUESTION';

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recompute_hot_score ON votes;
CREATE TRIGGER trg_recompute_hot_score
AFTER INSERT OR DELETE ON votes
FOR EACH ROW
EXECUTE FUNCTION recompute_question_hot_score();
