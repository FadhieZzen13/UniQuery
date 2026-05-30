import express from 'express';
import { z } from 'zod';
import { pool } from '../index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { decryptIdentity } from '../services/anonymity.js';

const router = express.Router();

const actionSchema = z.object({
  targetType: z.enum(['QUESTION', 'ANSWER']),
  targetId: z.string().uuid(),
  action: z.enum(['HIDE', 'LOCK', 'DELETE', 'UNHIDE']),
  justification: z.string().min(10),
});

const decryptSchema = z.object({
  markerId: z.string().uuid(),
});

router.get('/flags', authenticate, requireRole('FACULTY', 'ADMIN'), async (req: AuthRequest, res) => {
  const courseId = req.query.course_id as string | undefined;
  if (!courseId) {
    return res.status(400).json({ error: 'course_id is required' });
  }

  try {
    const result = await pool.query(
      `SELECT f.*, im.id as marker_id,
              q.title as question_title,
              q.body as question_body,
              a.body as answer_body
       FROM flags f
       LEFT JOIN questions q ON f.target_type = 'QUESTION' AND f.target_id = q.id
       LEFT JOIN answers a ON f.target_type = 'ANSWER' AND f.target_id = a.id
       LEFT JOIN questions aq ON a.question_id = aq.id
       LEFT JOIN identity_markers im ON im.target_type = f.target_type AND im.target_id = f.target_id
       WHERE COALESCE(q.course_id, aq.course_id) = $1 AND f.status = 'OPEN'`,
      [courseId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching flags:', error);
    res.status(500).json({ error: 'Error fetching flags' });
  }
});

router.post('/actions', authenticate, requireRole('FACULTY', 'ADMIN'), async (req: AuthRequest, res) => {
  const parseResult = actionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const { targetType, targetId, action, justification } = parseResult.data;
  const actorId = req.auth?.userId;

  if (!actorId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await pool.query('BEGIN');

    const statusMap: Record<string, string> = {
      HIDE: 'HIDDEN',
      LOCK: 'LOCKED',
      DELETE: 'HIDDEN',
      UNHIDE: 'OPEN',
    };
    const newStatus = statusMap[action];

    if (targetType === 'QUESTION') {
      await pool.query('UPDATE questions SET status = $1 WHERE id = $2', [newStatus, targetId]);
    } else {
      await pool.query('UPDATE answers SET status = $1 WHERE id = $2', [newStatus, targetId]);
    }

    await pool.query(
      'UPDATE flags SET status = $1 WHERE target_type = $2 AND target_id = $3',
      ['RESOLVED', targetType, targetId]
    );

    await pool.query(
      `INSERT INTO moderation_audit_log (actor_id, action, target_type, target_id, justification)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId, action, targetType, targetId, justification]
    );

    await pool.query('COMMIT');
    res.json({ message: 'Moderation action recorded' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error handling moderation action:', error);
    res.status(500).json({ error: 'Error performing moderation action' });
  }
});

router.post('/decrypt', authenticate, requireRole('FACULTY', 'ADMIN'), async (req: AuthRequest, res) => {
  const parseResult = decryptSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const actorId = req.auth?.userId;
  const actorRole = req.auth?.role || '';

  if (!actorId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = await decryptIdentity(parseResult.data.markerId, actorId, actorRole);
    res.json({ userId });
  } catch (error: any) {
    res.status(403).json({ error: error?.message || 'Not authorized' });
  }
});

export default router;
