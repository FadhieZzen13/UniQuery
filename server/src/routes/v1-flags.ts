import express from 'express';
import { z } from 'zod';
import { pool } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { emitNotification } from '../services/notifications.js';

const router = express.Router();

const flagSchema = z.object({
  targetType: z.enum(['QUESTION', 'ANSWER']),
  targetId: z.string().uuid(),
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  const parseResult = flagSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const reporterId = req.auth?.userId;
  if (!reporterId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await pool.query(
      `INSERT INTO flags (reporter_id, target_type, target_id)
       VALUES ($1, $2, $3)`,
      [reporterId, parseResult.data.targetType, parseResult.data.targetId]
    );

    const questionIdResult = await pool.query(
      parseResult.data.targetType === 'QUESTION'
        ? 'SELECT id, course_id FROM questions WHERE id = $1'
        : `SELECT q.id, q.course_id
           FROM answers a
           JOIN questions q ON q.id = a.question_id
           WHERE a.id = $1`,
      [parseResult.data.targetId]
    );

    if (questionIdResult.rows.length === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }

    const courseId = questionIdResult.rows[0].course_id;

    const faculty = await pool.query(
      `SELECT DISTINCT u.id
       FROM users u
       JOIN enrollments e ON e.user_id = u.id
       WHERE u.role IN ('FACULTY', 'ADMIN') AND e.course_id = $1`,
      [courseId]
    );

    for (const row of faculty.rows) {
      await emitNotification(row.id, 'FLAG_TRIAGE', {
        targetType: parseResult.data.targetType,
        targetId: parseResult.data.targetId,
        courseId,
      });
    }

    res.status(201).json({ message: 'Flag submitted' });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Already flagged' });
    }
    console.error('Error flagging:', error);
    res.status(500).json({ error: 'Error creating flag' });
  }
});

export default router;
