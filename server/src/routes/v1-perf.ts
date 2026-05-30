import express from 'express';
import { pool } from '../index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/slow-queries', authenticate, requireRole('ADMIN'), async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

  try {
    const result = await pool.query(
      `SELECT query, calls, total_time, mean_time, rows
       FROM pg_stat_statements
       ORDER BY total_time DESC
       LIMIT $1`,
      [limit]
    );

    res.json({ queries: result.rows });
  } catch (error) {
    console.error('Error fetching slow queries:', error);
    res.status(500).json({ error: 'Error fetching slow queries' });
  }
});

export default router;
