import express from 'express';
import { pool } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  try {
    const result = await pool.query(
      `SELECT id, type, payload, delivery_channel, read_at, created_at
       FROM notifications
       WHERE recipient_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ notifications: result.rows, limit, offset });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});

router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET read_at = now()
       WHERE id = $1 AND recipient_id = $2
       RETURNING id, read_at`,
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ id: result.rows[0].id, readAt: result.rows[0].read_at });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Error updating notification' });
  }
});

export default router;
