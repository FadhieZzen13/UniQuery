import express from 'express';
import { pool } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const parseDisplayMeta = (displayName: string | null) => {
  if (!displayName) {
    return { major: null as string | null, year: null as string | null };
  }
  const [major, year] = displayName.split('|');
  return {
    major: major?.trim() || null,
    year: year?.trim() || null,
  };
};

const formatDisplayMeta = (major: string, year: string) => `${major}|${year}`;

const mapUserRow = (
  row: {
    id: string;
    institutional_email: string;
    full_name: string | null;
    display_name: string | null;
    reputation: number | null;
    role?: string | null;
    created_at: string;
  },
  hasEnrollment = false
) => {
  const { major, year } = parseDisplayMeta(row.display_name);
  const name = row.full_name;
  const onboardingCompleted = name !== null;
  return {
    id: row.id,
    email: row.institutional_email,
    name,
    major,
    year,
    avatar: name
      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
      : null,
    reputation: row.reputation ?? 0,
    // Carried to the client so the UI can gate admin/moderation surfaces by role.
    role: row.role ?? 'STUDENT',
    onboardingCompleted,
    needsCourseEnrollment: onboardingCompleted && !hasEnrollment,
    createdAt: row.created_at,
  };
};

const userHasEnrollment = async (userId: string) => {
  const result = await pool.query(
    'SELECT 1 FROM enrollments WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows.length > 0;
};

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT id, institutional_email, full_name, display_name, reputation, role, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hasEnrollment = await userHasEnrollment(userId);
    res.json(mapUserRow(result.rows[0], hasEnrollment));
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

// Complete onboarding (set profile details)
router.post('/onboarding', authenticate, async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, major, year, courseId } = req.body;

  if (!courseId) {
    return res.status(400).json({ error: 'Course selection is required' });
  }

  try {
    const userResult = await pool.query(
      'SELECT institution_id, full_name, display_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const institutionId = userResult.rows[0].institution_id;
    const hasProfile = userResult.rows[0].full_name !== null;

    if (!hasProfile && (!name || !major || !year)) {
      return res.status(400).json({ error: 'Name, major, and year are required' });
    }

    const courseResult = await pool.query(
      `SELECT id FROM courses
       WHERE id = $1 AND institution_id = $2 AND status = 'ACTIVE'`,
      [courseId, institutionId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid course selection' });
    }

    await pool.query('BEGIN');

    let result;
    if (!hasProfile) {
      result = await pool.query(
        `UPDATE users
         SET full_name = $1, display_name = $2, updated_at = now()
         WHERE id = $3
         RETURNING id, institutional_email, full_name, display_name, reputation, role, created_at`,
        [name, formatDisplayMeta(major, year), userId]
      );
    } else {
      result = await pool.query(
        `SELECT id, institutional_email, full_name, display_name, reputation, role, created_at
         FROM users WHERE id = $1`,
        [userId]
      );
    }

    await pool.query(
      `INSERT INTO enrollments (user_id, course_id, role)
       VALUES ($1, $2, 'STUDENT')
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [userId, courseId]
    );

    await pool.query('COMMIT');

    res.json(mapUserRow(result.rows[0], true));
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Error completing onboarding' });
  }
});

// Update user profile
router.put('/profile', authenticate, async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, major, year } = req.body;

  try {
    const current = await pool.query(
      'SELECT full_name, display_name FROM users WHERE id = $1',
      [userId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingMeta = parseDisplayMeta(current.rows[0].display_name);
    const nextName = name ?? current.rows[0].full_name;
    const nextMajor = major ?? existingMeta.major;
    const nextYear = year ?? existingMeta.year;

    if (!nextName || !nextMajor || !nextYear) {
      return res.status(400).json({ error: 'Name, major, and year are required' });
    }

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1, display_name = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, institutional_email, full_name, display_name, reputation, role, created_at`,
      [nextName, formatDisplayMeta(nextMajor, nextYear), userId]
    );

    const hasEnrollment = await userHasEnrollment(userId);
    res.json(mapUserRow(result.rows[0], hasEnrollment));
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Get user by ID (public profile)
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, institutional_email, full_name, display_name, reputation, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mapped = mapUserRow(result.rows[0]);
    res.json({
      id: mapped.id,
      name: mapped.name,
      major: mapped.major,
      year: mapped.year,
      avatar: mapped.avatar,
      reputation: mapped.reputation,
      created_at: mapped.createdAt,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user' });
  }
});

export default router;
