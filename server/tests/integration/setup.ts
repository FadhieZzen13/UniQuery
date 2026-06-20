/**
 * Integration Test Harness — real routes, real Postgres.
 *
 * Connects to a disposable test branch via APPLICATION_DATABASE_URL_TEST and seeds a
 * minimal fixture: one institution + course, a STUDENT/FACULTY/ADMIN, the student's
 * enrollment, and a known pseudonymous alias. The app under test (src/app.ts) shares
 * the same Pool (src/index.ts reads APPLICATION_DATABASE_URL_TEST under NODE_ENV=test),
 * so requests and seeding hit the same database.
 *
 * NOTE on the DB role: encrypt (INSERT identity_markers) and decrypt (SELECT
 * identity_markers) only work if the test connection's role can write/read that table.
 * The identity_markers RLS policy (moderation_only FOR SELECT TO moderation_role) blocks
 * application_role. For the suite to pass, point APPLICATION_DATABASE_URL_TEST at a role
 * the schema permits for those paths (e.g. the branch owner), or add the matching RLS
 * policies. See the PR body's "application_role RLS prerequisite" note.
 *
 * This module is imported dynamically (only when RUN_INTEGRATION is true) so that the
 * MSW unit suites and skipped integration suites never load the env-sensitive src graph.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../src/index.js';

export const RUN_INTEGRATION = !!process.env.APPLICATION_DATABASE_URL_TEST;

export const TEST_PASSWORD = 'Password123!';

export interface SeededUser {
  id: string;
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
  token: string;
}

export interface TestContext {
  institutionId: string;
  courseId: string;
  alias: string;
  student: SeededUser;
  faculty: SeededUser;
  admin: SeededUser;
}

const jwtSecret = process.env.JWT_SECRET || '';
const fingerprint = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// Mirror the auth route: sign a 24h HS256 token and persist its session so the
// authenticate middleware (which checks jti + fingerprint + freshness) accepts it.
async function issueToken(user: { id: string; role: string; institutionId: string }, courseEnrollments: string[]) {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: user.id, role: user.role, institution_id: user.institutionId, course_enrollments: courseEnrollments, jti },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: '24h' }
  );
  await pool.query(
    `INSERT INTO sessions (session_id, user_id, jwt_fingerprint, last_seen_at, expires_at)
     VALUES ($1, $2, $3, now(), now() + interval '24 hours')`,
    [jti, user.id, fingerprint(token)]
  );
  return token;
}

async function createUser(
  institutionId: string,
  role: 'STUDENT' | 'FACULTY' | 'ADMIN',
  email: string,
  passwordHash: string
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO users (institution_id, institutional_email, password_hash, role, full_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [institutionId, email, passwordHash, role, `${role} Tester`]
  );
  return result.rows[0].id;
}

export async function setupTestData(): Promise<TestContext> {
  const stamp = Date.now();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const inst = await pool.query(
    `INSERT INTO institutions (name, domain) VALUES ($1, $2) RETURNING id`,
    [`Integration U ${stamp}`, `int-${stamp}.edu`]
  );
  const institutionId = inst.rows[0].id as string;

  const course = await pool.query(
    `INSERT INTO courses (institution_id, code, title, status)
     VALUES ($1, $2, 'Integration Course', 'ACTIVE') RETURNING id`,
    [institutionId, `INT${stamp}`]
  );
  const courseId = course.rows[0].id as string;

  const studentId = await createUser(institutionId, 'STUDENT', `student.${stamp}@int.edu`, passwordHash);
  const facultyId = await createUser(institutionId, 'FACULTY', `faculty.${stamp}@int.edu`, passwordHash);
  const adminId = await createUser(institutionId, 'ADMIN', `admin.${stamp}@int.edu`, passwordHash);

  const alias = 'Anonymous Owl';
  await pool.query(
    `INSERT INTO enrollments (user_id, course_id, role, pseudonymous_alias)
     VALUES ($1, $2, 'STUDENT', $3)`,
    [studentId, courseId, alias]
  );

  const student: SeededUser = {
    id: studentId,
    email: `student.${stamp}@int.edu`,
    role: 'STUDENT',
    token: await issueToken({ id: studentId, role: 'STUDENT', institutionId }, [courseId]),
  };
  const faculty: SeededUser = {
    id: facultyId,
    email: `faculty.${stamp}@int.edu`,
    role: 'FACULTY',
    token: await issueToken({ id: facultyId, role: 'FACULTY', institutionId }, []),
  };
  const admin: SeededUser = {
    id: adminId,
    email: `admin.${stamp}@int.edu`,
    role: 'ADMIN',
    token: await issueToken({ id: adminId, role: 'ADMIN', institutionId }, []),
  };

  return { institutionId, courseId, alias, student, faculty, admin };
}

// Best-effort teardown. moderation_audit_log is append-only (triggers block DELETE), and
// its actor_id FK is ON DELETE RESTRICT, so a FACULTY/ADMIN that performed a decrypt cannot
// be deleted — those rows are left for the disposable branch to reset. Everything else
// cascades from the seeded rows.
export async function teardownTestData(ctx: TestContext): Promise<void> {
  const ids = [ctx.student.id, ctx.faculty.id, ctx.admin.id];
  await pool.query(`DELETE FROM questions WHERE author_id = ANY($1)`, [ids]).catch(() => undefined);
  await pool.query(`DELETE FROM enrollments WHERE user_id = ANY($1)`, [ids]).catch(() => undefined);
  await pool.query(`DELETE FROM sessions WHERE user_id = ANY($1)`, [ids]).catch(() => undefined);
  await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]).catch(() => undefined);
  await pool.query(`DELETE FROM courses WHERE id = $1`, [ctx.courseId]).catch(() => undefined);
  await pool.query(`DELETE FROM institutions WHERE id = $1`, [ctx.institutionId]).catch(() => undefined);
}

export async function closePool(): Promise<void> {
  await pool.end().catch(() => undefined);
}
