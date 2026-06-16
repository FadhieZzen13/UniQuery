-- Validation fixes: closes the failing gates in the Backend Validation Checklist
--   §1.2  idp_protocol CHECK constraint
--   §1.3  moderation_audit_log.actor_id must NOT cascade (preserve audit trail)
--   §2.2  application_role (a non-superuser, RLS-respecting app role)
--   §5.3  moderation_audit_log is append-only (REVOKE + enforcing triggers)
--   §6.6  search_questions_ranked: paginated signature, no author_id leak, weighted tsv

-- §1.2 — idp_protocol column + CHECK IN ('OAUTH2','SAML2','LOCAL')
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS idp_protocol TEXT NOT NULL DEFAULT 'LOCAL';

DO $$
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_idp_protocol_check
    CHECK (idp_protocol IN ('OAUTH2', 'SAML2', 'LOCAL'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- §1.3 — actor_id FK must not cascade. RESTRICT preserves the audit trail when a
-- user delete is attempted (the trail can never be silently erased by it).
ALTER TABLE moderation_audit_log
  DROP CONSTRAINT IF EXISTS moderation_audit_log_actor_id_fkey;

ALTER TABLE moderation_audit_log
  ADD CONSTRAINT moderation_audit_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;

-- §2.2 — a dedicated, non-superuser application role. Unlike postgres/service_role
-- it does NOT bypass RLS, so the identity_markers policy actually applies to it.
DO $$
BEGIN
  CREATE ROLE application_role NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN RAISE NOTICE 'Skipping application_role creation (insufficient_privilege).';
END $$;

-- §5.3 — append-only: revoke mutation grants from every non-owner role.
REVOKE UPDATE, DELETE, TRUNCATE ON moderation_audit_log FROM PUBLIC;

DO $$
BEGIN
  EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON moderation_audit_log FROM application_role';
  EXECUTE 'GRANT SELECT, INSERT ON moderation_audit_log TO application_role';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON moderation_audit_log FROM anon, authenticated, service_role';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- §5.3 — defense-in-depth: the app currently connects as a superuser, which
-- bypasses GRANTs. A trigger blocks UPDATE/DELETE/TRUNCATE for ALL roles,
-- superusers included, so append-only is enforced regardless of connection role.
CREATE OR REPLACE FUNCTION moderation_audit_log_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'moderation_audit_log is append-only; % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_moderation_audit_log_append_only ON moderation_audit_log;
CREATE TRIGGER trg_moderation_audit_log_append_only
BEFORE UPDATE OR DELETE ON moderation_audit_log
FOR EACH ROW EXECUTE FUNCTION moderation_audit_log_append_only();

DROP TRIGGER IF EXISTS trg_moderation_audit_log_no_truncate ON moderation_audit_log;
CREATE TRIGGER trg_moderation_audit_log_no_truncate
BEFORE TRUNCATE ON moderation_audit_log
FOR EACH STATEMENT EXECUTE FUNCTION moderation_audit_log_append_only();

-- §6.6 — search RPC. Replaces the 1-arg variant. Adds pagination, ranks with
-- weighted tsvector (Title = A, Body = B per search-design.md), and NEVER returns
-- author_id for anonymous questions.
DROP FUNCTION IF EXISTS search_questions_ranked(text);
DROP FUNCTION IF EXISTS search_questions_ranked(text, integer, integer);

CREATE FUNCTION search_questions_ranked(
  search_query TEXT,
  result_limit INTEGER DEFAULT 20,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  course_id UUID,
  author_id UUID,
  title TEXT,
  body TEXT,
  is_anonymous BOOLEAN,
  status TEXT,
  hot_score NUMERIC,
  created_at TIMESTAMPTZ,
  rank REAL
)
LANGUAGE sql STABLE AS $$
  SELECT
    q.id,
    q.course_id,
    CASE WHEN q.is_anonymous THEN NULL ELSE q.author_id END AS author_id,
    q.title,
    q.body,
    q.is_anonymous,
    q.status,
    q.hot_score,
    q.created_at,
    ts_rank(
      setweight(to_tsvector('english', coalesce(q.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(q.body, '')), 'B'),
      websearch_to_tsquery('english', search_query)
    ) AS rank
  FROM questions q
  WHERE q.status <> 'ARCHIVED'
    AND (
      setweight(to_tsvector('english', coalesce(q.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(q.body, '')), 'B')
    ) @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC, q.hot_score DESC, q.created_at DESC
  LIMIT GREATEST(result_limit, 0)
  OFFSET GREATEST(result_offset, 0);
$$;
