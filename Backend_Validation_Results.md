# Backend Validation Checklist — Results

**Project:** HeptaCore — UniQuery · **Reviewer:** Athar · **Author:** Karthik
**Date:** 2026-06-09 · **Branch:** `main`

**Verdict legend:** ✅ pass · ❌ fail (blocks merge) · ⚠️ pass-with-caveat / deviation

**Evidence sources:** live DB introspection (`pg_catalog`/`information_schema` against the configured Supabase, connected as `postgres`), live RPC execution, live HTTP harness (booted server on :4000, seeded a tagged `vtest-*.edu` institution, then cascade-cleaned), and source review.

---

## ⛔ OVERALL VERDICT: DO NOT APPROVE MERGE

Failing gates: **§1** (missing `idp_protocol` CHECK; audit-log FK cascades), **§2 CRITICAL** (RLS bypassed by app role; no `application_role`), **§5** (audit log not append-only at all), **§6** (search RPC leaks `author_id` + wrong signature). Plus two cross-cutting blockers (mock-only test suite; broken legacy routes) below.

---

## 0. Cross-cutting blockers (not a numbered section, but gate the merge)

### 0a. ❌ The Jest suite is mock-only — green CI proves nothing about this backend
`npm test` → **4 suites, 26 passed, 13 todo**. But `tests/app.ts` `createApp()` returns `501 Not implemented` for every route; tests `fetch()` against **MSW handlers** (`tests/mocks/handlers.ts`), never `src/routes/*`. The mock contract also contradicts the real impl:

| Aspect | Mock (tested) | Real backend |
|---|---|---|
| Roles | `MODERATOR` | `STUDENT/FACULTY/ADMIN` (no MODERATOR) |
| JWT claims | `userId`, `course_ids` | `sub`, `course_enrollments` |
| Token TTL | 7 days | 24 h |
| Lockout | 423 on **5th**, body has `locked_until` | 423 on **6th**, body has **no** `locked_until` |
| `PATCH /api/users/:id` | 403/200 | route **does not exist** (404) |
| Decrypt route | `/api/moderation/decrypt`, returns `real_author` | `/api/v1/moderation/decrypt`, returns `userId` |

→ Tests validate an idealized SDD spec, not Karthik's code. **Sign-off cannot rely on the suite.**

### 0b. ❌ Legacy routes broken against the migrated schema
`src/routes/questions.ts`, `answers.ts`, `votes.ts` (mounted at `/api/questions|answers|votes`) and `src/routes/auth.ts` (Supabase Auth, `/api/auth/*`) reference columns that don't exist post-migration (`user_id`, `description`, `content`, `votes.question_id/answer_id`, `users.name/avatar/email/onboarding_completed`). They 500 at runtime. The working surface is `/api/v1/*` (`v1.ts` + `v1-qa.ts`). Dead/duplicate code; remove or fix.

---

## 1. Schema Verification

| # | Item | Verdict | Evidence |
|---|---|---|---|
|1.1| All entities exist | ✅ | All 18 present (`institutions … subscriptions`). `information_schema.tables` → `missing: NONE`. (Checklist says "16", lists 18 — all there, plus `questions_archive`/`answers_archive`.) |
|1.2| Every SDD CHECK constraint present | ❌ | `role IN (STUDENT,FACULTY,ADMIN)` ✅, status/value checks ✅. But **`idp_protocol IN ('OAUTH2','SAML2','LOCAL')` is ABSENT** — no `idp_protocol` column exists anywhere (no IdP fields on `sessions`/`users`). `init.sql` header even says "pending SDD appendices". |
|1.3| FKs with correct ON DELETE | ❌ | **`moderation_audit_log.actor_id` is `ON DELETE CASCADE`** — checklist requires this table be append-only (must NOT cascade). Deleting a user erases their audit trail. (`users→institutions`=RESTRICT, `courses→faculties`=SET NULL, rest CASCADE — those are fine.) |
|1.4| GIN/BTREE indexes from Appendix D | ⚠️ | GIN ×2 (`idx_questions_body_tsv`, `questions_body_tsv_idx WITH fastupdate=off`), BTREE incl. `idx_questions_course_hot`, `idx_votes_target`, etc. all exist. Cannot prove exact parity — **Appendix D / SDD is not in the repo.** |

## 2. Anonymity Engine Verification (CRITICAL)

| # | Item | Verdict | Evidence |
|---|---|---|---|
|2.1| RLS enabled on `identity_markers` | ✅ | `relrowsecurity = true`. Policy `moderation_only` (SELECT → `moderation_role`). |
|2.2| App role SELECT fails / zero rows | ❌ **CRITICAL** | **`application_role` does not exist.** The app connects as **`postgres` (`rolbypassrls = true`)**, and `service_role` also bypasses RLS. So RLS on `identity_markers` is **completely bypassed for the app's real connection** — the anonymity guarantee rests entirely on app-layer code, no DB defense-in-depth. |
|2.3| `encrypted_user_id` is BYTEA | ✅ | `bytea NOT NULL`. Code uses AES-256-GCM (`iv‖authTag‖ciphertext`); plaintext id never written to that column. |
|2.4| `data_key_id` populated every row | ✅ | `text NOT NULL`, 0 NULLs over 2 rows. Envelope encryption in `anonymity.ts` (per-row DEK wrapped by master key). ⚠️ `data_key_id` stores the wrapped DEK itself (`local:<b64>`), not a KMS key id — functional, but not the KMS pattern the SDD implies. |
|2.5| Anon post → `encrypted_user_id` is ciphertext, not the id | ✅ | Substance holds: bytea AES-GCM blob, not the UUID. (Note: the checklist's literal `JOIN … USING (target_id WHERE…)` SQL is malformed and won't run as written.) |

## 3. Authentication Verification  *(applies to `/api/v1/auth/*`; the `/api/auth/*` Supabase variant is broken — see 0b)*

| # | Item | Verdict | Evidence (live HTTP) |
|---|---|---|---|
|3.1| Login returns JWT w/ `sub, role, institution_id, course_enrollments, jti, exp` | ✅ | All claims present in decoded token. |
|3.2| 24-hour expiry | ✅ | `exp − iat = 24h`. |
|3.3| SESSIONS row w/ `jwt_fingerprint = SHA-256(token)`; plaintext token never stored | ✅ | Stored fingerprint == `sha256(token)`; 0 rows store the plaintext token. |
|3.4| 5 wrong → 6th = HTTP 423 with `locked_until` | ⚠️ | Live: `[401,401,401,401,401,423]` — 423 fires on the 6th. **Caveat:** the 423 body does **not** include `locked_until` (only `{error}`). Lock state is persisted on the row, but not returned. |
|3.5| Logout sets `revoked_at`; reuse → 401 | ✅ | logout=200; reusing same JWT → 401. |

## 4. RBAC Verification

| # | Item | Verdict | Evidence (live HTTP) |
|---|---|---|---|
|4.1| STUDENT → `POST /api/v1/moderation/decrypt` = 403 | ✅ | 403. |
|4.2| STUDENT → `PATCH /api/v1/users/:id` = 403 | ❌ | **404 — the endpoint does not exist.** No admin user-management route anywhere (`users.ts` has only `GET /me`, `POST /onboarding`, `PUT /profile` (self), `GET /:id` (public, unauthenticated)). RBAC on user edits is therefore unverifiable/unimplemented. |
|4.3| FACULTY → `POST /api/v1/admin/courses/:id/archive` = 403 | ✅ | 403. |
|4.4| Middleware runs before controller | ✅ | `auth.ts`: `authenticate` + `requireRole(...)` are route-level middleware ahead of handlers; live 403s on valid sessions confirm gating precedes controller logic. (File is `auth.ts`, not `auth.middleware.ts`.) |

## 5. Audit Log Verification

| # | Item | Verdict | Evidence |
|---|---|---|---|
|5.1| Successful moderation action writes 1 audit row in same txn | ✅ | `v1-moderation.ts /actions` wraps status update + flag resolve + audit insert in `BEGIN…COMMIT`. |
|5.2| Decrypt writes audit BEFORE returning plaintext | ✅ | `decryptIdentity()` inserts the audit row, *then* selects + decrypts. ⚠️ Not a single transaction (separate pool queries) — audit-first holds, atomicity does not. |
|5.3| UPDATE/DELETE on `moderation_audit_log` REVOKED from `application_role` | ❌ | **No `application_role` exists; no REVOKE anywhere.** `anon`, `authenticated`, `service_role`, `postgres` all hold `UPDATE`, `DELETE`, **and `TRUNCATE`** on the table. Append-only is unenforced — and `actor_id` cascades on user delete (see 1.3). The table is freely mutable. |

## 6. Functional Smoke Tests

| # | Item | Verdict | Evidence (live HTTP / RPC) |
|---|---|---|---|
|6.1| Valid `course_id` → 201, id returned | ✅ | 201, `id` returned. |
|6.2| Invalid `course_code` → 422 | ❌ | bad UUID → **400**; valid-but-unknown course → **403** ("Not enrolled"). No 422 path. (API also keys on `courseId` UUID, not a `course_code`.) |
|6.3| Double vote same `(voter,target)` → 409 on 2nd | ❌ | **200 / 200.** `v1-qa.ts /votes` pre-checks and **toggles** (deletes on repeat) → never returns 409. The `UNIQUE(voter_id,target_type,target_id)` constraint exists but is never surfaced. |
|6.4| Answer to LOCKED question → 423 | ✅ | 423. |
|6.5| Accept-answer twice (different answers) → 409 on 2nd | ✅ | 200 then 409. |
|6.6| `search_questions_ranked(...)` — no `author_id` leak | ❌ | Two failures: **(a)** checklist's 8-arg call errors → `function search_questions_ranked(unknown,…,integer,integer) does not exist`; deployed signature is **1-arg** `search_questions_ranked(text)`. **(b)** Called correctly it's `RETURNS SETOF questions` via `SELECT *` → **returns `author_id` (and every column) for ALL questions, ignoring `is_anonymous`** = anonymity leak. Also it is **absent from migrations** (applied out-of-band — a "clean Supabase" per the checklist's setup step would not have it), and `body_tsv` has **no `setweight` A/B** (search-design.md requires Title=A, Body=B). |

---

## Trello cards to file on Karthik (each blocks approval)

1. **[CRITICAL] Anonymity RLS is bypassed** — app connects as `postgres`/`service_role` (BYPASSRLS); `application_role` never created. Create a least-privilege role, connect the app as it, and verify `SELECT` on `identity_markers` returns 0 rows. *(SDD: Anonymity Engine / §2)*
2. **[CRITICAL] `search_questions_ranked` leaks `author_id`** — `RETURNS SETOF questions; SELECT *` exposes author of anonymous questions; also wrong arity vs spec and missing from migrations; add A/B `setweight`. *(SDD: Search / FR-IDX-02 / §6.6)*
3. **[HIGH] Audit log is not append-only** — REVOKE `UPDATE,DELETE,TRUNCATE` from app/anon/authenticated/service_role; change `actor_id` FK off `ON DELETE CASCADE`. *(SDD: Audit / §5.3, §1.3)*
4. **[HIGH] Test suite is mock-only** — wire Jest to the real `src/routes/*` (supertest against the app + a test DB); current MSW mocks diverge from the implementation. *(§0a)*
5. **[HIGH] Missing `idp_protocol` CHECK / IdP columns** — schema is "best-effort, pending SDD appendices"; add the Data-Dictionary constraints. *(SDD: Data Dictionary / §1.2)*
6. **[MED] Missing admin `PATCH /api/v1/users/:id`** — no RBAC-guarded user-management endpoint exists; `GET /users/:id` is public/unauthenticated. *(§4.2)*
7. **[MED] Double-vote returns 200 (toggle), not 409** — align with spec or update the spec. *(§6.3)*
8. **[MED] Invalid course returns 400/403, not 422.** *(§6.2)*
9. **[LOW] Broken legacy routes** — `questions.ts/answers.ts/votes.ts/auth.ts` reference dropped columns; remove or migrate. *(§0b)*
10. **[LOW] 423 lockout body omits `locked_until`.** *(§3.4)*

---

## Week-12 Recovery Update (branch `recovery/week-12-search-route-toggle-tests`, 2026-06-15)

Karthik's `20260530_validation_fixes.sql` closed §1.2, §1.3, §2.2 (role *created*), §3.4, §5.3,
§6.6 (RPC level). This branch addresses the two remaining cross-cutting blockers and exposes search
over HTTP:

- [x] **§0a — real-route tests.** Added `tests/integration/{auth,anonymity,search,users}.real.test.ts`
      driving `src/app.ts` via supertest against a real Postgres branch
      (`APPLICATION_DATABASE_URL_TEST`); they self-skip when that env is absent. The MSW suites under
      `tests/{auth,anonymity,qa}` are now `describe.skip` with a header explaining they encode the
      aspirational SDD spec, not the shipped backend.
- [x] **§2.2 — activation (code).** The runtime Pool now reads `APPLICATION_DATABASE_URL`
      (`application_role`) first, falling back to `DATABASE_URL` (postgres-role, migrations only).
      `application_role` respects RLS, so `SELECT identity_markers` returns 0 rows for it.
- [ ] **§2.2 — activation (ops, NOT done here).** Requires the one-time DBA `GRANT`s (README) **and**
      a resolution to the RLS prerequisite below before `APPLICATION_DATABASE_URL` is set in prod.
- [x] **§0b — legacy `questions.ts` deleted** (it still referenced the old 1-arg search RPC). Other
      legacy files (`answers.ts/votes.ts/auth.ts`) remain unmounted; out of scope here.
- [x] **§6.6 (HTTP) — `GET /api/v1/search`** added (`v1-search.ts`), authenticated, calls the 3-arg
      RPC, with a defence-in-depth assertion that rejects any anonymous row carrying `author_id`.

> ⚠️ **`application_role` RLS prerequisite (blocker for activation).** `identity_markers` has RLS
> enabled with a single policy `moderation_only FOR SELECT TO moderation_role` and **no INSERT
> policy and no policy for `application_role`**. Once the app connects as `application_role`, both
> `encryptIdentity` (INSERT) and `decryptIdentity` (SELECT) on `identity_markers` will be blocked by
> RLS — breaking anonymous posting and moderator de-anonymisation. The app authorises per app-user
> via `requireRole`, all over a single DB connection role, which is incompatible with a
> `moderation_role`-keyed policy. **Do not set `APPLICATION_DATABASE_URL` in prod until** an INSERT
> policy (and a moderation read path) for `application_role` is added, or the RLS model is reconciled
> with the single-connection-role design. Filed as a follow-up card.
