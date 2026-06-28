import express from 'express';
import { z } from 'zod';
import { pool } from '../index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const institutionSchema = z.object({
  name: z.string().min(2),
  domain: z.string().min(3),
});

const courseSchema = z.object({
  // Optional: single-institution deployments let the server fill this from the
  // admin's own institution so the UI never has to pick one.
  institutionId: z.string().uuid().optional(),
  code: z.string().min(2),
  title: z.string().min(2),
  facultyId: z.string().uuid().optional(),
});

const enrollmentSchema = z.object({
  courseId: z.string().uuid(),
  userEmail: z.string().email(),
  role: z.enum(['STUDENT', 'TA', 'FACULTY']).default('STUDENT'),
});

router.get('/institutions', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT id, name, domain, created_at FROM institutions ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching institutions:', error);
    res.status(500).json({ error: 'Error fetching institutions' });
  }
});

router.post('/institutions', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const parseResult = institutionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const { name, domain } = parseResult.data;

  try {
    const result = await pool.query(
      `INSERT INTO institutions (name, domain)
       VALUES ($1, $2)
       RETURNING id, name, domain, created_at`,
      [name, domain]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Institution domain already exists' });
    }
    console.error('Error creating institution:', error);
    res.status(500).json({ error: 'Error creating institution' });
  }
});

router.get('/courses', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  // Default to the admin's own institution when not explicitly provided.
  const institutionId = (req.query.institution_id as string | undefined) || req.auth?.institutionId;
  if (!institutionId) {
    return res.status(400).json({ error: 'institution_id is required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, institution_id, faculty_id, code, title, status, created_at
       FROM courses
       WHERE institution_id = $1
       ORDER BY code`,
      [institutionId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Error fetching courses' });
  }
});

router.post('/courses', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const parseResult = courseSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const { facultyId, code, title } = parseResult.data;
  const institutionId = parseResult.data.institutionId || req.auth?.institutionId;
  if (!institutionId) {
    return res.status(400).json({ error: 'institution_id is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO courses (institution_id, faculty_id, code, title)
       VALUES ($1, $2, $3, $4)
       RETURNING id, institution_id, faculty_id, code, title, status, created_at`,
      [institutionId, facultyId || null, code, title]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Course code already exists for institution' });
    }
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Error creating course' });
  }
});

router.get('/enrollments', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const courseId = req.query.course_id as string | undefined;
  if (!courseId) {
    return res.status(400).json({ error: 'course_id is required' });
  }

  try {
    const result = await pool.query(
      `SELECT e.id, e.role, e.created_at,
              u.id as user_id, u.institutional_email, u.full_name, u.display_name
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       WHERE e.course_id = $1
       ORDER BY u.institutional_email`,
      [courseId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Error fetching enrollments' });
  }
});

router.post('/enrollments', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const parseResult = enrollmentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const { courseId, userEmail, role } = parseResult.data;

  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE institutional_email = $1',
      [userEmail]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;
    const result = await pool.query(
      `INSERT INTO enrollments (user_id, course_id, role)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, course_id, role, created_at`,
      [userId, courseId, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'User already enrolled' });
    }
    console.error('Error creating enrollment:', error);
    res.status(500).json({ error: 'Error creating enrollment' });
  }
});

router.delete('/enrollments/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const enrollmentId = req.params.id;

  try {
    const result = await pool.query('DELETE FROM enrollments WHERE id = $1 RETURNING id', [enrollmentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json({ message: 'Enrollment deleted' });
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    res.status(500).json({ error: 'Error deleting enrollment' });
  }
});

router.post('/courses/:id/archive', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const courseId = req.params.id;

  try {
    await pool.query('BEGIN');

    const courseResult = await pool.query(
      `UPDATE courses
       SET status = 'ARCHIVED', archived_at = now()
       WHERE id = $1 AND status != 'ARCHIVED'
       RETURNING archived_at`,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Course not found or already archived' });
    }

    const archivedAt = new Date(courseResult.rows[0].archived_at);
    const year = archivedAt.getUTCFullYear();
    const from = `${year}-01-01`;
    const to = `${year + 1}-01-01`;

    await pool.query(
      `CREATE TABLE IF NOT EXISTS questions_archive_${year}
       PARTITION OF questions_archive
       FOR VALUES FROM ('${from}') TO ('${to}')`
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS answers_archive_${year}
       PARTITION OF answers_archive
       FOR VALUES FROM ('${from}') TO ('${to}')`
    );

    await pool.query(
      `UPDATE questions
       SET status = 'ARCHIVED', updated_at = now(), archived_at = $1
       WHERE course_id = $2`,
      [archivedAt, courseId]
    );

    await pool.query(
      `UPDATE answers
       SET status = 'ARCHIVED', updated_at = now(), archived_at = $1
       WHERE question_id IN (SELECT id FROM questions WHERE course_id = $2)`,
      [archivedAt, courseId]
    );

    await pool.query(
      `INSERT INTO questions_archive
       SELECT * FROM questions WHERE course_id = $1 AND status = 'ARCHIVED'`,
      [courseId]
    );

    await pool.query(
      `INSERT INTO answers_archive
       SELECT * FROM answers
       WHERE question_id IN (SELECT id FROM questions WHERE course_id = $1)
         AND status = 'ARCHIVED'`,
      [courseId]
    );

    await pool.query('DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE course_id = $1)', [courseId]);
    await pool.query('DELETE FROM questions WHERE course_id = $1', [courseId]);

    await pool.query('COMMIT');

    res.json({ message: 'Course archived', archivedAt });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error archiving course:', error);
    res.status(500).json({ error: 'Error archiving course' });
  }
});

export default router;
