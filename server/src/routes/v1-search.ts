import express from 'express';
import { z } from 'zod';
import { pool } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const querySchema = z.object({
  q:      z.string().min(1, 'q is required'),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Calls Karthik's 3-arg RPC (search_query, result_limit, result_offset).
// The RPC already nulls author_id for anonymous questions — but the column is still
// present in the row shape. The defence-in-depth assertion below catches drift.
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await pool.query(
      'SELECT * FROM search_questions_ranked($1, $2, $3)',
      [parsed.data.q, parsed.data.limit, parsed.data.offset]
    );

    // Anonymity invariant: no row may expose author_id when is_anonymous = true.
    const violation = result.rows.find((r: any) => r.is_anonymous === true && r.author_id !== null);
    if (violation) {
      console.error('search rpc returned author_id for anonymous row', violation.id);
      return res.status(500).json({ error: 'Search failed' });
    }

    res.json({
      query:   parsed.data.q,
      limit:   parsed.data.limit,
      offset:  parsed.data.offset,
      results: result.rows,
    });
  } catch (err) {
    console.error('search rpc error', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
