import express from 'express';
import { pool } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js'; // Fixed import name
import { supabaseAnon } from '../lib/supabase.js';

const router = express.Router();

// Supabase RPC for full-text search
router.get('/search', async (req, res) => {
  try {
    const { data } = await supabaseAnon.rpc('search_questions_ranked', { search_query: req.query.q });
    res.json(data);
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get all questions with filtering and sorting
router.get('/', async (req, res) => {
  try {
    const { category, sort = 'newest', search, limit, offset } = req.query;
    const parsedLimit = Math.max(1, Math.min(parseInt(limit as string) || 10, 50));
    const parsedOffset = Math.max(0, parseInt(offset as string) || 0);

    // Build WHERE conditions
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;
    if (category && category !== 'all') {
      conditions.push(`q.category = $${paramCount++}`);
      values.push(category);
    }
    if (search) {
      conditions.push(`(q.title ILIKE $${paramCount} OR q.description ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT q.id) AS total
       FROM questions q
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Main query with pagination
    let query = `
      SELECT 
        q.id, q.title, q.description, q.category, q.created_at, q.is_resolved,
        u.id as author_id, u.name as author_name, u.avatar as author_avatar, u.reputation as author_reputation,
        COALESCE(SUM(v.value), 0) as votes,
        COUNT(DISTINCT a.id) as answer_count,
        EXISTS(SELECT 1 FROM answers WHERE question_id = q.id AND is_verified = TRUE) as has_verified_answer,
        ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
      FROM questions q
      LEFT JOIN users u ON q.user_id = u.id
      LEFT JOIN votes v ON v.question_id = q.id
      LEFT JOIN answers a ON a.question_id = q.id
      LEFT JOIN question_tags qt ON qt.question_id = q.id
      LEFT JOIN tags t ON t.id = qt.tag_id
      ${whereClause}
      GROUP BY q.id, u.id
    `;
    // Sorting
    switch (sort) {
      case 'votes':
        query += ' ORDER BY votes DESC, q.created_at DESC';
        break;
      case 'unanswered':
        query += ' HAVING COUNT(DISTINCT a.id) = 0 ORDER BY q.created_at DESC';
        break;
      default: // newest
        query += ' ORDER BY q.created_at DESC';
    }
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(parsedLimit, parsedOffset);

    const result = await pool.query(query, values);
    const questions = result.rows.map(row => ({
      id: row.id.toString(),
      title: row.title,
      description: row.description,
      category: row.category,
      tags: row.tags || [],
      author: {
        id: row.author_id?.toString(),
        name: row.author_name,
        avatar: row.author_avatar,
        reputation: row.author_reputation
      },
      votes: parseInt(row.votes) || 0,
      answerCount: parseInt(row.answer_count) || 0,
      createdAt: row.created_at,
      hasVerifiedAnswer: row.has_verified_answer,
      isResolved: row.is_resolved || false
    }));
    res.json({ questions, total });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Error fetching questions' });
  }
});

// Get single question by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const questionResult = await pool.query(`
      SELECT 
        q.id, q.title, q.description, q.category, q.created_at, q.is_resolved,
        u.id as author_id, u.name as author_name, u.avatar as author_avatar, u.reputation as author_reputation, u.created_at as author_joined,
        COALESCE(SUM(v.value), 0) as votes,
        COUNT(DISTINCT a.id) as answer_count,
        ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
      FROM questions q
      LEFT JOIN users u ON q.user_id = u.id
      LEFT JOIN votes v ON v.question_id = q.id
      LEFT JOIN answers a ON a.question_id = q.id
      LEFT JOIN question_tags qt ON qt.question_id = q.id
      LEFT JOIN tags t ON t.id = qt.tag_id
      WHERE q.id = $1
      GROUP BY q.id, u.id
    `, [id]);

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const row = questionResult.rows[0];
    const question = {
      id: row.id.toString(),
      title: row.title,
      description: row.description,
      category: row.category,
      tags: row.tags || [],
      author: {
        id: row.author_id?.toString(),
        name: row.author_name,
        avatar: row.author_avatar,
        reputation: row.author_reputation,
        joinedAt: row.author_joined
      },
      votes: parseInt(row.votes) || 0,
      answerCount: parseInt(row.answer_count) || 0,
      createdAt: row.created_at,
      isResolved: row.is_resolved || false
    };

    res.json(question);
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ error: 'Error fetching question' });
  }
});

// Create a new question
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { title, description, category, tags } = req.body;

  if (!title || !description || !category) {
    return res.status(400).json({ error: 'Title, description, and category are required' });
  }

  try {
    // Start transaction
    await pool.query('BEGIN');

    // Insert question - updated req.userId path
    const questionResult = await pool.query(
      'INSERT INTO questions (user_id, title, description, category) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.auth?.userId, title, description, category]
    );
    const questionId = questionResult.rows[0].id;

    // Handle tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        // Insert tag if it doesn't exist
        const tagResult = await pool.query(
          'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
          [tagName.trim().toLowerCase()]
        );
        const tagId = tagResult.rows[0].id;

        // Link tag to question
        await pool.query(
          'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
          [questionId, tagId]
        );
      }
    }

    await pool.query('COMMIT');

    // Fetch the created question with all details
    const result = await pool.query(`
      SELECT 
        q.id, q.title, q.description, q.category, q.created_at,
        u.id as author_id, u.name as author_name, u.avatar as author_avatar, u.reputation as author_reputation,
        ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
      FROM questions q
      LEFT JOIN users u ON q.user_id = u.id
      LEFT JOIN question_tags qt ON qt.question_id = q.id
      LEFT JOIN tags t ON t.id = qt.tag_id
      WHERE q.id = $1
      GROUP BY q.id, u.id
    `, [questionId]);

    const row = result.rows[0];
    res.status(201).json({
      id: row.id.toString(),
      title: row.title,
      description: row.description,
      category: row.category,
      tags: row.tags || [],
      author: {
        id: row.author_id?.toString(),
        name: row.author_name,
        avatar: row.author_avatar,
        reputation: row.author_reputation
      },
      votes: 0,
      answerCount: 0,
      createdAt: row.created_at
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error creating question:', error);
    res.status(500).json({ error: 'Error creating question' });
  }
});

// Delete a question (only by author)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if user is the author
    const question = await pool.query('SELECT user_id FROM questions WHERE id = $1', [id]);
    
    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Updated req.userId path
    if (question.rows[0].user_id !== req.auth?.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this question' });
    }

    await pool.query('DELETE FROM questions WHERE id = $1', [id]);
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Error deleting question' });
  }
});

// Mark question as resolved (only by author)
router.put('/:id/resolve', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if user is the author
    const question = await pool.query('SELECT user_id, is_resolved FROM questions WHERE id = $1', [id]);
    
    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Updated req.userId path
    if (question.rows[0].user_id !== req.auth?.userId) {
      return res.status(403).json({ error: 'Only the question author can mark it as resolved' });
    }

    const newResolvedStatus = !question.rows[0].is_resolved;
    await pool.query('UPDATE questions SET is_resolved = $1 WHERE id = $2', [newResolvedStatus, id]);
    
    res.json({ 
      message: newResolvedStatus ? 'Question marked as resolved' : 'Question marked as unresolved',
      isResolved: newResolvedStatus
    });
  } catch (error) {
    console.error('Error updating question status:', error);
    res.status(500).json({ error: 'Error updating question status' });
  }
});

export default router;