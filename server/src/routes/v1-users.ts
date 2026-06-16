import express from 'express';
import { z } from 'zod';
import { pool } from '../index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Admin user management. Mounted at /api/v1/users.
// PATCH is ADMIN-only; requireRole returns 403 for STUDENT/FACULTY (checklist §4.2).
const patchUserSchema = z
  .object({
    role: z.enum(['STUDENT', 'FACULTY', 'ADMIN']).optional(),
    fullName: z.string().min(1).optional(),
    locked: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

router.patch('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const parseResult = patchUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const { role, fullName, locked } = parseResult.data;

  const sets: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (role !== undefined) {
    sets.push(`role = $${paramCount++}`);
    values.push(role);
  }
  if (fullName !== undefined) {
    sets.push(`full_name = $${paramCount++}`);
    values.push(fullName);
  }
  if (locked !== undefined) {
    // Lock for 15 minutes (mirrors the login lockout window); unlock clears state.
    if (locked) {
      sets.push(`locked_until = now() + interval '15 minutes'`);
    } else {
      sets.push(`locked_until = NULL`);
      sets.push(`failed_login_count = 0`);
    }
  }

  sets.push('updated_at = now()');
  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE users
       SET ${sets.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, institutional_email, full_name, display_name, role, locked_until, reputation, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      email: row.institutional_email,
      name: row.full_name,
      role: row.role,
      lockedUntil: row.locked_until,
      reputation: row.reputation ?? 0,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
});

export default router;
