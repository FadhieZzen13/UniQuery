import express from 'express';
import { pool } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js'; // Fixed import name

const router = express.Router();

// Get answers for a question
router.get('/question/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;

    const result = await pool.query(`
      SELECT 
        a.id, a.content, a.is_verified, a.created_at,
        u.id as author_id, u.name as author_name, u.avatar as author_avatar, u.reputation as author_reputation,
        COALESCE(SUM(v.value), 0) as votes
      FROM answers a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN votes v ON v.answer_id = a.id
      WHERE a.question_id = $1
      GROUP BY a.id, u.id
      ORDER BY a.is_verified DESC, votes DESC, a.created_at ASC
    `, [questionId]);

    const answers = result.rows.map(row => ({
      id: row.id.toString(),
      content: row.content,
      isVerified: row.is_verified,
      author: {
        id: row.author_id?.toString(),
        name: row.author_name,
        avatar: row.author_avatar,
        reputation: row.author_reputation
      },
      votes: parseInt(row.votes) || 0,
      createdAt: row.created_at
    }));

    res.json(answers);
  } catch (error) {
    console.error('Error fetching answers:', error);
    res.status(500).json({ error: 'Error fetching answers' });
  }
});

// Post an answer to a question
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { questionId, content } = req.body;

  if (!questionId || !content) {
    return res.status(400).json({ error: 'Question ID and content are required' });
  }

  try {
    // Check if question exists and is not resolved
    const questionCheck = await pool.query('SELECT id, is_resolved FROM questions WHERE id = $1', [questionId]);
    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (questionCheck.rows[0].is_resolved) {
      return res.status(403).json({ error: 'Cannot answer a resolved question' });
    }

    // Insert answer - updated context path
    const result = await pool.query(
      'INSERT INTO answers (question_id, user_id, content) VALUES ($1, $2, $3) RETURNING id, content, is_verified, created_at',
      [questionId, req.auth?.userId, content]
    );

    // Get user info - updated context path
    const userResult = await pool.query(
      'SELECT id, name, avatar, reputation FROM users WHERE id = $1',
      [req.auth?.userId]
    );

    const answer = result.rows[0];
    const user = userResult.rows[0];

    res.status(201).json({
      id: answer.id.toString(),
      content: answer.content,
      isVerified: answer.is_verified,
      author: {
        id: user.id.toString(),
        name: user.name,
        avatar: user.avatar,
        reputation: user.reputation
      },
      votes: 0,
      createdAt: answer.created_at
    });
  } catch (error) {
    console.error('Error creating answer:', error);
    res.status(500).json({ error: 'Error creating answer' });
  }
});

// Mark answer as verified (only question author can do this)
router.put('/:id/verify', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Get the answer and check if user is question author
    const answerResult = await pool.query(`
      SELECT a.id, a.question_id, q.user_id as question_author_id
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      WHERE a.id = $1
    `, [id]);

    if (answerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    const answer = answerResult.rows[0];
    // updated context path
    if (answer.question_author_id !== req.auth?.userId) {
      return res.status(403).json({ error: 'Only question author can verify answers' });
    }

    // Unverify all other answers for this question first
    await pool.query('UPDATE answers SET is_verified = FALSE WHERE question_id = $1', [answer.question_id]);

    // Verify this answer
    await pool.query('UPDATE answers SET is_verified = TRUE WHERE id = $1', [id]);

    // Award reputation to answer author
    const reputationBonus = 15;
    await pool.query(`
      UPDATE users SET reputation = reputation + $1 
      WHERE id = (SELECT user_id FROM answers WHERE id = $2)
    `, [reputationBonus, id]);

    res.json({ message: 'Answer verified successfully' });
  } catch (error) {
    console.error('Error verifying answer:', error);
    res.status(500).json({ error: 'Error verifying answer' });
  }
});

// Delete an answer (only by author)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const answer = await pool.query('SELECT user_id FROM answers WHERE id = $1', [id]);
    
    if (answer.rows.length === 0) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    // updated context path
    if (answer.rows[0].user_id !== req.auth?.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this answer' });
    }

    await pool.query('DELETE FROM answers WHERE id = $1', [id]);
    res.json({ message: 'Answer deleted successfully' });
  } catch (error) {
    console.error('Error deleting answer:', error);
    res.status(500).json({ error: 'Error deleting answer' });
  }
});

export default router;