import express from 'express';
import { pool } from '../index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get current user profile
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, major, year, avatar, reputation, onboarding_completed, created_at 
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

// Complete onboarding (set profile details)
router.post('/onboarding', authenticateToken, async (req: AuthRequest, res) => {
  const { name, major, year } = req.body;

  if (!name || !major || !year) {
    return res.status(400).json({ error: 'Name, major, and year are required' });
  }

  try {
    // Generate avatar URL based on name
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

    const result = await pool.query(
      `UPDATE users 
       SET name = $1, major = $2, year = $3, avatar = $4, onboarding_completed = TRUE 
       WHERE id = $5 
       RETURNING id, email, name, major, year, avatar, reputation, onboarding_completed, created_at`,
      [name, major, year, avatar, req.userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Error completing onboarding' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  const { name, major, year } = req.body;

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
      // Update avatar when name changes
      updates.push(`avatar = $${paramCount++}`);
      values.push(`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`);
    }
    if (major) {
      updates.push(`major = $${paramCount++}`);
      values.push(major);
    }
    if (year) {
      updates.push(`year = $${paramCount++}`);
      values.push(year);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.userId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} 
       RETURNING id, email, name, major, year, avatar, reputation, onboarding_completed, created_at`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Get user by ID (public profile)
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, major, year, avatar, reputation, created_at 
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user' });
  }
});

export default router;
