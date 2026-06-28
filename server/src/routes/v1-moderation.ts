import express from 'express';
import { z } from 'zod';
import { pool } from '../index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { decryptIdentity } from '../services/anonymity.js';

const router = express.Router();

const actionSchema = z.object({
  targetType: z.enum(['QUESTION', 'ANSWER']),
  targetId: z.string().uuid(),
  // HIDE/LOCK/DELETE/UNHIDE change the content's status and resolve the flag.
  // DISMISS rejects the flag (resolves it) WITHOUT touching the content — used when
  // a moderator reviews a report and decides the content does not violate guidelines.
  action: z.enum(['HIDE', 'LOCK', 'DELETE', 'UNHIDE', 'DISMISS']),
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

// Admin-wide triage: every open flag across ALL courses in the admin's institution,
// each tagged with the course it belongs to. Lets an admin resolve reports from one
// place instead of course-by-course. Resolution still flows through POST /actions
// (which works by target id, independent of course membership).
router.get('/flags/all', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const institutionId = req.auth?.institutionId;
  if (!institutionId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT f.id, f.reporter_id, f.target_type, f.target_id, f.status, f.created_at,
              im.id as marker_id,
              q.title as question_title,
              q.body as question_body,
              a.body as answer_body,
              COALESCE(cq.id, ca.id) as course_id,
              COALESCE(cq.code, ca.code) as course_code,
              COALESCE(cq.title, ca.title) as course_title
       FROM flags f
       LEFT JOIN questions q ON f.target_type = 'QUESTION' AND f.target_id = q.id
       LEFT JOIN answers a ON f.target_type = 'ANSWER' AND f.target_id = a.id
       LEFT JOIN questions aq ON a.question_id = aq.id
       LEFT JOIN courses cq ON cq.id = q.course_id
       LEFT JOIN courses ca ON ca.id = aq.course_id
       LEFT JOIN identity_markers im ON im.target_type = f.target_type AND im.target_id = f.target_id
       WHERE f.status = 'OPEN'
         AND COALESCE(cq.institution_id, ca.institution_id) = $1
       ORDER BY f.created_at DESC`,
      [institutionId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all flags:', error);
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

  // Use a single dedicated connection so BEGIN/COMMIT/ROLLBACK apply to the same
  // session — pool.query() can otherwise run each statement on a different connection.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // DISMISS resolves the flag without changing content status. The others map to a
    // content status change before the flag is resolved.
    const statusMap: Record<string, string> = {
      HIDE: 'HIDDEN',
      LOCK: 'LOCKED',
      DELETE: 'HIDDEN',
      UNHIDE: 'OPEN',
    };
    const newStatus = statusMap[action];

    if (newStatus) {
      if (targetType === 'QUESTION') {
        await client.query('UPDATE questions SET status = $1 WHERE id = $2', [newStatus, targetId]);
      } else {
        await client.query('UPDATE answers SET status = $1 WHERE id = $2', [newStatus, targetId]);
      }
    }

    await client.query(
      'UPDATE flags SET status = $1 WHERE target_type = $2 AND target_id = $3',
      ['RESOLVED', targetType, targetId]
    );

    await client.query(
      `INSERT INTO moderation_audit_log (actor_id, action, target_type, target_id, justification)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId, action, targetType, targetId, justification]
    );

    await client.query('COMMIT');
    res.json({ message: 'Moderation action recorded' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error handling moderation action:', error);
    res.status(500).json({ error: 'Error performing moderation action' });
  } finally {
    client.release();
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
