import express from 'express';
import { pool } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js'; // Fixed import name

const router = express.Router();

// Vote on a question
router.post('/question/:questionId', authenticate, async (req: AuthRequest, res) => {
  const { questionId } = req.params;
  const { value } = req.body;

  if (value !== 1 && value !== -1) {
    return res.status(400).json({ error: 'Vote value must be 1 or -1' });
  }

  try {
    // Check if question exists
    const questionCheck = await pool.query('SELECT id, user_id FROM questions WHERE id = $1', [questionId]);
    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Can't vote on own question
    if (questionCheck.rows[0].user_id === req.auth?.userId) {
      return res.status(400).json({ error: "You can't vote on your own question" });
    }

    // Check if user already voted
    const existingVote = await pool.query(
      'SELECT id, value FROM votes WHERE user_id = $1 AND question_id = $2',
      [req.auth?.userId, questionId]
    );

    if (existingVote.rows.length > 0) {
      if (existingVote.rows[0].value === value) {
        // Remove vote if same value (toggle off)
        await pool.query('DELETE FROM votes WHERE id = $1', [existingVote.rows[0].id]);
        
        // Update question author's reputation
        const reputationChange = value === 1 ? -10 : 2;
        await pool.query(
          'UPDATE users SET reputation = reputation + $1 WHERE id = $2',
          [reputationChange, questionCheck.rows[0].user_id]
        );
        
        return res.json({ message: 'Vote removed', newValue: 0 });
      } else {
        // Update vote
        await pool.query('UPDATE votes SET value = $1 WHERE id = $2', [value, existingVote.rows[0].id]);
        
        // Update reputation (double change for switch)
        const reputationChange = value === 1 ? 20 : -20;
        await pool.query(
          'UPDATE users SET reputation = reputation + $1 WHERE id = $2',
          [reputationChange, questionCheck.rows[0].user_id]
        );
        
        return res.json({ message: 'Vote updated', newValue: value });
      }
    }

    // Insert new vote
    await pool.query(
      'INSERT INTO votes (user_id, question_id, value) VALUES ($1, $2, $3)',
      [req.auth?.userId, questionId, value]
    );

    // Update question author's reputation
    const reputationChange = value === 1 ? 10 : -2;
    await pool.query(
      'UPDATE users SET reputation = reputation + $1 WHERE id = $2',
      [reputationChange, questionCheck.rows[0].user_id]
    );

    res.status(201).json({ message: 'Vote recorded', newValue: value });
  } catch (error) {
    console.error('Error voting on question:', error);
    res.status(500).json({ error: 'Error recording vote' });
  }
});

// Vote on an answer
router.post('/answer/:answerId', authenticate, async (req: AuthRequest, res) => { // Fixed middleware name
  const { answerId } = req.params;
  const { value } = req.body;

  if (value !== 1 && value !== -1) {
    return res.status(400).json({ error: 'Vote value must be 1 or -1' });
  }

  try {
    // Check if answer exists
    const answerCheck = await pool.query('SELECT id, user_id FROM answers WHERE id = $1', [answerId]);
    if (answerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    // Can't vote on own answer
    if (answerCheck.rows[0].user_id === req.auth?.userId) {
      return res.status(400).json({ error: "You can't vote on your own answer" });
    }

    // Check if user already voted
    const existingVote = await pool.query(
      'SELECT id, value FROM votes WHERE user_id = $1 AND answer_id = $2',
      [req.auth?.userId, answerId]
    );

    if (existingVote.rows.length > 0) {
      if (existingVote.rows[0].value === value) {
        // Remove vote if same value (toggle off)
        await pool.query('DELETE FROM votes WHERE id = $1', [existingVote.rows[0].id]);
        
        // Update answer author's reputation
        const reputationChange = value === 1 ? -10 : 2;
        await pool.query(
          'UPDATE users SET reputation = reputation + $1 WHERE id = $2',
          [reputationChange, answerCheck.rows[0].user_id]
        );
        
        return res.json({ message: 'Vote removed', newValue: 0 });
      } else {
        // Update vote
        await pool.query('UPDATE votes SET value = $1 WHERE id = $2', [value, existingVote.rows[0].id]);
        
        // Update reputation (double change for switch)
        const reputationChange = value === 1 ? 20 : -20;
        await pool.query(
          'UPDATE users SET reputation = reputation + $1 WHERE id = $2',
          [reputationChange, answerCheck.rows[0].user_id]
        );
        
        return res.json({ message: 'Vote updated', newValue: value });
      }
    }

    // Insert new vote
    await pool.query(
      'INSERT INTO votes (user_id, answer_id, value) VALUES ($1, $2, $3)',
      [req.auth?.userId, answerId, value]
    );

    // Update answer author's reputation
    const reputationChange = value === 1 ? 10 : -2;
    await pool.query(
      'UPDATE users SET reputation = reputation + $1 WHERE id = $2',
      [reputationChange, answerCheck.rows[0].user_id]
    );

    res.status(201).json({ message: 'Vote recorded', newValue: value });
  } catch (error) {
    console.error('Error voting on answer:', error);
    res.status(500).json({ error: 'Error recording vote' });
  }
});

// Get user's vote status for a question
router.get('/question/:questionId/status', authenticate, async (req: AuthRequest, res) => { // Fixed middleware name
  try {
    const result = await pool.query(
      'SELECT value FROM votes WHERE user_id = $1 AND question_id = $2',
      [req.auth?.userId, req.params.questionId]
    );
    res.json({ value: result.rows[0]?.value || 0 });
  } catch (error) {
    console.error('Error getting vote status:', error);
    res.status(500).json({ error: 'Error getting vote status' });
  }
});

// Get user's vote status for an answer
router.get('/answer/:answerId/status', authenticate, async (req: AuthRequest, res) => { // Fixed middleware name
  try {
    const result = await pool.query(
      'SELECT value FROM votes WHERE user_id = $1 AND answer_id = $2',
      [req.auth?.userId, req.params.answerId]
    );
    res.json({ value: result.rows[0]?.value || 0 });
  } catch (error) {
    console.error('Error getting vote status:', error);
    res.status(500).json({ error: 'Error getting vote status' });
  }
});

export default router;