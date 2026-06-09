# HeptaCore — UniQuery
## Backend Validation Checklist
*Athar's review pack for Karthik's backend*

| Item | Value |
|---|---|
| **Owner** | Athar (reviewer) + Karthik (author) |
| **When** | This week, before Sprint 2 review with supervisor |
| **Verdict gates** | Cannot merge to main until every gate passes |

### How to Use
Clone Karthik's branch. Run the schema migrations against a clean Supabase project. For each section below, run the verification command and tick the box. If anything fails, file a Trello card on Karthik before approving.

---

### 1. Schema Verification

- [ ] All 16 entities exist: `INSTITUTIONS`, `USERS`, `SESSIONS`, `FACULTIES`, `COURSES`, `ENROLLMENTS`, `QUESTIONS`, `ANSWERS`, `VOTES`, `BOOKMARKS`, `TAGS`, `QUESTION_TAGS`, `IDENTITY_MARKERS`, `FLAGS`, `MODERATION_AUDIT_LOG`, `NOTIFICATIONS`, `ANALYTICS_SNAPSHOTS`, `SUBSCRIPTIONS`.
  ```sql
  SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;
  ```
- [ ] Every `CHECK` constraint from the SDD Data Dictionary is present (e.g., `role IN ('STUDENT','FACULTY','ADMIN')`; `idp_protocol IN ('OAUTH2','SAML2','LOCAL')`).
  ```sql
  SELECT conname, conrelid::regclass, pg_get_constraintdef(oid) FROM pg_constraint WHERE contype='c';
  ```
- [ ] Every FK from Appendix E is present with the correct `ON DELETE` behaviour (mostly `CASCADE` except `MODERATION_AUDIT_LOG` which is append-only).
  ```sql
  SELECT conname, conrelid::regclass, confrelid::regclass, confdeltype FROM pg_constraint WHERE contype='f';
  ```
- [ ] Every GIN/BTREE index from Appendix D exists.
  ```sql
  SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname='public';
  ```

### 2. Anonymity Engine Verification (CRITICAL)

- [ ] RLS is ENABLED on `identity_markers`.
  ```sql
  SELECT relname, relrowsecurity FROM pg_class WHERE relname='identity_markers';
  ```
- [ ] Connect as `application_role` and assert `SELECT` on `identity_markers` fails or returns zero rows.
  ```sql
  SET ROLE application_role; SELECT * FROM identity_markers LIMIT 1;
  ```
- [ ] `encrypted_user_id` column is `BYTEA`, not `TEXT`. Plaintext `user_id` NEVER appears.
- [ ] `data_key_id` column populated on every row (no `NULL`s); confirms envelope encryption pattern.
  ```sql
  SELECT count(*) FROM identity_markers WHERE data_key_id IS NULL;
  ```
- [ ] Manually POST an anonymous question via `/api/v1/questions`. Then query: confirm `encrypted_user_id` is binary garbage, not the `user_id`.
  ```sql
  SELECT body, encrypted_user_id FROM questions JOIN identity_markers USING (target_id) WHERE target_type='Q';
  ```

### 3. Authentication Verification

- [ ] `POST /auth/login` with correct credentials returns a JWT containing `sub`, `role`, `institution_id`, `course_enrollments`, `jti`, `exp`.
- [ ] Decode the JWT at https://jwt.io and verify the 24-hour expiry.
- [ ] `SESSIONS` row created on login with `jwt_fingerprint = SHA-256(token)`. Plaintext token NEVER stored.
- [ ] Submit 5 wrong passwords for the same account; on 6th attempt assert HTTP `423` with `locked_until`.
- [ ] `POST /auth/logout` sets `revoked_at = now()` on the `SESSIONS` row. Subsequent requests with that JWT return HTTP `401`.

### 4. RBAC Verification

- [ ] With a `STUDENT` JWT, `POST /api/v1/moderation/decrypt` returns HTTP `403`.
- [ ] With a `STUDENT` JWT, `PATCH /api/v1/users/:id` returns HTTP `403`.
- [ ] With a `FACULTY` JWT, `POST /api/v1/admin/courses/:id/archive` returns HTTP `403`.
- [ ] Middleware runs BEFORE the controller — confirm by reading `auth.middleware.ts`.

### 5. Audit Log Verification

- [ ] Every successful moderation action writes one `MODERATION_AUDIT_LOG` row in the same transaction.
- [ ] Decryption attempts write the audit log BEFORE returning plaintext (audit-first ordering).
- [ ] `UPDATE` and `DELETE` on `moderation_audit_log` are REVOKED from `application_role`.
  ```sql
  REVOKE UPDATE, DELETE ON moderation_audit_log FROM application_role;
  ```

### 6. Functional Smoke Tests

- [ ] `POST /api/v1/questions` with valid `course_id` → HTTP `201`; `question_id` returned.
- [ ] `POST /api/v1/questions` with invalid `course_code` → HTTP `422`.
- [ ] `POST /api/v1/votes` twice with same (`voter_id`, `target_id`) → HTTP `409` on second.
- [ ] `POST /api/v1/answers` to a LOCKED question → HTTP `423`.
- [ ] `PATCH /accept-answer` twice on different answers → HTTP `409` on second.
- [ ] Run Rifli's improved search RPC; confirm no `author_id` leaks.
  ```sql
  SELECT * FROM search_questions_ranked('algorithm', NULL, NULL, 'OPEN', NULL, NULL, 10, 0);
  ```

### 7. Sign-off

- [ ] **Approve only when all 6 sections pass** — If any gate fails, file a Trello card describing the failure, link to the SDD section it violates, and request a fix from Karthik. Do not approve the merge.
