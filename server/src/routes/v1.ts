import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import qaRoutes from './v1-qa.js';
import moderationRoutes from './v1-moderation.js';
import flagsRoutes from './v1-flags.js';
import notificationsRoutes from './v1-notifications.js';
import adminRoutes from './v1-admin.js';
import perfRoutes from './v1-perf.js';
import usersAdminRoutes from './v1-users.js';

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresInHours = 24;
const bcryptCost = 12;

const hasEduEmail = (email: string) => email.toLowerCase().includes('.edu');

const registerSchema = z.object({
  institutionalEmail: z.string().email(),
  password: z.string().min(6),
  institutionId: z.string().uuid(),
  role: z.enum(['STUDENT', 'FACULTY', 'ADMIN']).default('STUDENT'),
  fullName: z.string().optional(),
  displayName: z.string().optional(),
});

const loginSchema = z.object({
  institutionalEmail: z.string().email(),
  password: z.string().min(1),
});

const fingerprintToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const signToken = (payload: {
  sub: string;
  role: string;
  institution_id: string;
  course_enrollments: string[];
  jti: string;
}) => {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(payload, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${jwtExpiresInHours}h`,
  });
};

router.post('/auth/register', async (req, res) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const { institutionalEmail, password, institutionId, role, fullName, displayName } = parseResult.data;

  if (!hasEduEmail(institutionalEmail)) {
    return res.status(400).json({ error: 'Email must contain ".edu".' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE institutional_email = $1',
      [institutionalEmail]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, bcryptCost);

    const result = await pool.query(
      `INSERT INTO users (institution_id, institutional_email, password_hash, role, full_name, display_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, institution_id, institutional_email, role, full_name, display_name, created_at`,
      [institutionId, institutionalEmail, passwordHash, role, fullName || null, displayName || null]
    );

    const user = result.rows[0];

    const defaultCourse = await pool.query(
      `SELECT id FROM courses
       WHERE institution_id = $1 AND status = 'ACTIVE'
       ORDER BY created_at ASC
       LIMIT 1`,
      [institutionId]
    );

    const courseEnrollments: string[] = [];
    if (defaultCourse.rows.length > 0) {
      const courseId = defaultCourse.rows[0].id;
      await pool.query(
        `INSERT INTO enrollments (user_id, course_id, role)
         VALUES ($1, $2, 'STUDENT')
         ON CONFLICT (user_id, course_id) DO NOTHING`,
        [user.id, courseId]
      );
      courseEnrollments.push(courseId);
    }

    const jti = uuidv4();
    const token = signToken({
      sub: user.id,
      role: user.role,
      institution_id: user.institution_id,
      course_enrollments: courseEnrollments,
      jti,
    });
  
      const fingerprint = fingerprintToken(token);
      await pool.query(
        `INSERT INTO sessions (session_id, user_id, jwt_fingerprint, last_seen_at, expires_at)
         VALUES ($1, $2, $3, now(), now() + interval '24 hours')`,
        [jti, user.id, fingerprint]
      );
  
      res.status(201).json({
        token,
        
        user: {
          id: user.id,
          email: user.institutional_email,
          name: user.full_name,
          role: user.role,
          institutionId: user.institution_id,
          onboardingCompleted: user.full_name !== null,
          courseEnrollments,
        },
      });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error registering user.' });
  }
});

router.post('/auth/login', async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const { institutionalEmail, password } = parseResult.data;

  try {
    const userResult = await pool.query(
      `SELECT id, institution_id, institutional_email, password_hash, role, full_name, failed_login_count, locked_until
       FROM users WHERE institutional_email = $1`,
      [institutionalEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({
        error: 'Account locked. Try again later.',
        locked_until: user.locked_until,
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      const failedCount = (user.failed_login_count || 0) + 1;
      const lockedUntil = failedCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await pool.query(
        'UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3',
        [failedCount, lockedUntil, user.id]
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1', [user.id]);

    const enrollments = await pool.query(
      'SELECT course_id FROM enrollments WHERE user_id = $1',
      [user.id]
    );

    const courseEnrollments = enrollments.rows.map((row) => row.course_id);
    const jti = uuidv4();
    const token = signToken({
      sub: user.id,
      role: user.role,
      institution_id: user.institution_id,
      course_enrollments: courseEnrollments,
      jti,
    });

    const fingerprint = fingerprintToken(token);
    await pool.query(
      `INSERT INTO sessions (session_id, user_id, jwt_fingerprint, last_seen_at, expires_at)
       VALUES ($1, $2, $3, now(), now() + interval '24 hours')`,
      [jti, user.id, fingerprint]
    );

    res.json({
        token,
        
        user: {
          id: user.id,
          email: user.institutional_email,
          name: user.full_name,
          role: user.role,
          institutionId: user.institution_id,
          onboardingCompleted: (user.full_name) !== null,
          courseEnrollments: courseEnrollments,
        },
      });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in.' });
  }
});

router.post('/auth/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    const sessionId = req.auth?.sessionId;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session not found' });
    }

    await pool.query('UPDATE sessions SET revoked_at = now() WHERE session_id = $1', [sessionId]);
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Error logging out.' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT id, institution_id, institutional_email, role, full_name, display_name, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const dbUser = result.rows[0];
      res.json({
        user: {
          id: dbUser.id,
          email: dbUser.institutional_email,
          name: dbUser.full_name,
          role: dbUser.role,
          institutionId: dbUser.institution_id,
          onboardingCompleted: dbUser.full_name !== null,
          courseEnrollments: [], // Can query if needed
        }
      });
    } catch (error) {
      console.error('Me error:', error);
    res.status(500).json({ error: 'Error fetching profile.' });
  }
});

const ensureDefaultCourses = async (institutionId: string) => {
  const existing = await pool.query(
    'SELECT id FROM courses WHERE institution_id = $1 LIMIT 1',
    [institutionId]
  );
  if (existing.rows.length > 0) return;

  await pool.query(
    `INSERT INTO courses (institution_id, code, title, status)
     VALUES ($1, 'CAMPUS', 'Campus Connect General', 'ACTIVE')
     ON CONFLICT (institution_id, code) DO NOTHING`,
    [institutionId]
  );
};

router.get('/courses/available', authenticate, async (req: AuthRequest, res) => {
  const institutionId = req.auth?.institutionId;
  if (!institutionId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await ensureDefaultCourses(institutionId);

    const result = await pool.query(
      `SELECT id, code, title, status
       FROM courses
       WHERE institution_id = $1 AND status = 'ACTIVE'
       ORDER BY code`,
      [institutionId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching available courses:', error);
    res.status(500).json({ error: 'Error fetching courses' });
  }
});

router.get('/courses/my', authenticate, async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT c.id, c.code, c.title, c.status, c.institution_id
       FROM courses c
       JOIN enrollments e ON e.course_id = c.id
       WHERE e.user_id = $1
       ORDER BY c.code`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Error fetching courses' });
  }
});

router.use(qaRoutes);
router.use('/users', usersAdminRoutes);
router.use('/moderation', moderationRoutes);
router.use('/flags', flagsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/perf', perfRoutes);

export default router;
