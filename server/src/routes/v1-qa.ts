import express from 'express';
import { z } from 'zod';
import { pool } from '../index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { encryptIdentity } from '../services/anonymity.js';
import { emitNotification } from '../services/notifications.js';

const router = express.Router();

const formatValidationError = (error: z.ZodError) => {
  const flattened = error.flatten();
  for (const messages of Object.values(flattened.fieldErrors)) {
    if (messages?.[0]) return messages[0];
  }
  return flattened.formErrors[0] || 'Invalid request';
};

const questionSchema = z.preprocess(
  (input) => {
    if (!input || typeof input !== 'object') return input;
    const data = { ...(input as Record<string, unknown>) };
    if (typeof data.body !== 'string' && typeof data.description === 'string') {
      data.body = data.description;
    }
    if (data.courseId === '') delete data.courseId;
    if (data.tags == null) {
      data.tags = [];
    } else if (typeof data.tags === 'string') {
      data.tags = data.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    return data;
  },
  z.object({
    courseId: z.string().uuid().optional(),
    title: z.coerce.string().trim().min(3, 'Title must be at least 3 characters'),
    body: z.coerce.string().trim().min(3, 'Description must be at least 3 characters'),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    isAnonymous: z.boolean().default(false),
  })
);

const answerSchema = z.object({
  questionId: z.string().uuid(),
  body: z.string().min(1),
  isAnonymous: z.boolean().optional().default(false),
});

const voteSchema = z.object({
  targetType: z.enum(['QUESTION', 'ANSWER']),
  targetId: z.string().uuid(),
  value: z.number().int().refine((value) => value === 1 || value === -1),
});

const bookmarkSchema = z.object({
  questionId: z.string().uuid(),
});

router.get('/questions', authenticate, async (req: AuthRequest, res) => {
  const { category, sort = 'newest', search, limit, offset } = req.query;
  const parsedLimit = Math.max(1, Math.min(parseInt(limit as string) || 10, 50));
  const parsedOffset = Math.max(0, parseInt(offset as string) || 0);

  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (category) {
      conditions.push(`q.category = $${paramCount++}`);
      values.push(category);
    }
    if (search) {
      conditions.push(`(q.title ILIKE $${paramCount} OR q.body ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT q.id) AS total
       FROM questions q
       ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0]?.total || '0');

    let query = `
      SELECT
        q.id, q.title, q.body, q.category, q.created_at, q.is_resolved,
        q.is_anonymous,
        u.id as author_id,
        COALESCE(u.display_name, u.full_name, split_part(u.institutional_email, '@', 1)) as author_name,
        u.reputation as author_reputation,
        COALESCE(SUM(v.value), 0) as votes,
        COUNT(DISTINCT a.id) as answer_count,
        EXISTS(SELECT 1 FROM answers WHERE question_id = q.id AND is_verified = TRUE) as has_verified_answer,
        ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
      FROM questions q
      JOIN users u ON q.author_id = u.id
      LEFT JOIN votes v ON v.target_type = 'QUESTION' AND v.target_id = q.id
      LEFT JOIN answers a ON a.question_id = q.id
      LEFT JOIN question_tags qt ON qt.question_id = q.id
      LEFT JOIN tags t ON t.id = qt.tag_id
      ${whereClause}
      GROUP BY q.id, u.id
    `;

    switch (sort) {
      case 'votes':
        query += ' ORDER BY votes DESC, q.created_at DESC';
        break;
      case 'unanswered':
        query += ' HAVING COUNT(DISTINCT a.id) = 0 ORDER BY q.created_at DESC';
        break;
      default:
        query += ' ORDER BY q.created_at DESC';
    }

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(parsedLimit, parsedOffset);

    const result = await pool.query(query, values);
    const questions = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.body,
      category: row.category,
      tags: row.tags || [],
      author: {
        id: row.is_anonymous ? null : row.author_id,
        name: row.is_anonymous ? 'Anonymous' : row.author_name,
        avatar: null,
        reputation: row.author_reputation || 0,
      },
      votes: parseInt(row.votes) || 0,
      answerCount: parseInt(row.answer_count) || 0,
      createdAt: row.created_at,
      hasVerifiedAnswer: row.has_verified_answer,
      isResolved: row.is_resolved || false,
    }));

    res.json({ questions, total });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Error fetching questions' });
  }
});

router.post('/questions', authenticate, async (req: AuthRequest, res) => {
  const parseResult = questionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: formatValidationError(parseResult.error),
      details: parseResult.error.flatten(),
    });
  }

  const { courseId, title, body, category, tags, isAnonymous } = parseResult.data;
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let finalCourseId = courseId;
    if (!finalCourseId) {
      const fallback = await pool.query(
        'SELECT course_id FROM enrollments WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
        [userId]
      );
      if (fallback.rows.length === 0) {
        return res.status(403).json({ error: 'No course enrollment found' });
      }
      finalCourseId = fallback.rows[0].course_id;
    }

    const courseStatus = await pool.query(
      'SELECT status FROM courses WHERE id = $1',
      [finalCourseId]
    );
    // §6.2 — a well-formed UUID that names no real course is unprocessable, not forbidden.
    if (courseStatus.rows.length === 0) {
      return res.status(422).json({ error: 'Invalid course' });
    }

    const enrollment = await pool.query(
      'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [userId, finalCourseId]
    );
    if (enrollment.rows.length === 0) {
      return res.status(403).json({ error: 'Not enrolled in course' });
    }

    if (courseStatus.rows[0].status === 'ARCHIVED') {
      return res.status(423).json({ error: 'Course is archived' });
    }

    await pool.query('BEGIN');

    const result = await pool.query(
      `INSERT INTO questions (course_id, author_id, title, body, category, is_anonymous)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, course_id, title, body, category, is_anonymous, created_at`,
      [finalCourseId, userId, title, body, category || null, isAnonymous]
    );

    const question = result.rows[0];

    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const tagResult = await pool.query(
          `INSERT INTO tags (name)
           VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [tagName.trim().toLowerCase()]
        );

        await pool.query(
          'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
          [question.id, tagResult.rows[0].id]
        );
      }
    }

    await encryptIdentity(userId, 'QUESTION', question.id);
    await pool.query('COMMIT');

    res.status(201).json({
      id: question.id,
      courseId: question.course_id,
      title: question.title,
      description: question.body,
      category: question.category,
      tags: tags || [],
      createdAt: question.created_at,
      isResolved: false,
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error creating question:', error);
    res.status(500).json({ error: 'Error creating question' });
  }
});

router.get('/questions/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT q.id, q.title, q.body, q.category, q.is_anonymous, q.status, q.created_at, q.is_resolved,
              u.id as author_id,
              COALESCE(u.display_name, u.full_name, split_part(u.institutional_email, '@', 1)) as author_name,
              u.reputation as author_reputation,
              COALESCE(SUM(v.value), 0) as votes,
              COUNT(DISTINCT a.id) as answer_count,
              EXISTS(SELECT 1 FROM answers WHERE question_id = q.id AND is_verified = TRUE) as has_verified_answer,
              ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
       FROM questions q
       JOIN users u ON q.author_id = u.id
       LEFT JOIN votes v ON v.target_type = 'QUESTION' AND v.target_id = q.id
       LEFT JOIN answers a ON a.question_id = q.id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       WHERE q.id = $1
       GROUP BY q.id, u.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      title: row.title,
      description: row.body,
      category: row.category,
      tags: row.tags || [],
      status: row.status,
      createdAt: row.created_at,
      votes: parseInt(row.votes) || 0,
      answerCount: parseInt(row.answer_count) || 0,
      hasVerifiedAnswer: row.has_verified_answer,
      isResolved: row.is_resolved || false,
      author: row.is_anonymous
        ? { id: null, name: 'Anonymous', avatar: null, reputation: 0 }
        : {
            id: row.author_id,
            name: row.author_name,
            avatar: null,
            reputation: row.author_reputation || 0,
          },
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ error: 'Error fetching question' });
  }
});

router.get('/questions/:id/answers', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT a.id, a.body, a.is_verified, a.created_at, a.is_anonymous,
              u.id as author_id,
              COALESCE(u.display_name, u.full_name, split_part(u.institutional_email, '@', 1)) as author_name,
              u.reputation as author_reputation,
              COALESCE(SUM(v.value), 0) as votes
       FROM answers a
       JOIN users u ON a.author_id = u.id
       LEFT JOIN votes v ON v.target_type = 'ANSWER' AND v.target_id = a.id
       WHERE a.question_id = $1
       GROUP BY a.id, u.id
       ORDER BY a.is_verified DESC, votes DESC, a.created_at ASC`,
      [id]
    );

    const answers = result.rows.map((row) => ({
      id: row.id,
      content: row.body,
      isVerified: row.is_verified,
      createdAt: row.created_at,
      votes: parseInt(row.votes) || 0,
      author: row.is_anonymous
        ? { id: null, name: 'Anonymous', avatar: null, reputation: 0 }
        : {
            id: row.author_id,
            name: row.author_name,
            avatar: null,
            reputation: row.author_reputation || 0,
          },
    }));

    res.json(answers);
  } catch (error) {
    console.error('Error fetching answers:', error);
    res.status(500).json({ error: 'Error fetching answers' });
  }
});

router.post('/answers', authenticate, async (req: AuthRequest, res) => {
  const parseResult = answerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const { questionId, body, isAnonymous } = parseResult.data;
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const question = await pool.query(
      'SELECT id, author_id, status FROM questions WHERE id = $1',
      [questionId]
    );

    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.rows[0].status !== 'OPEN') {
      return res.status(423).json({ error: 'Question is not open' });
    }

    const result = await pool.query(
      `INSERT INTO answers (question_id, author_id, body, is_anonymous)
       VALUES ($1, $2, $3, $4)
       RETURNING id, question_id, body, is_anonymous, created_at`,
      [questionId, userId, body, isAnonymous]
    );

    const answer = result.rows[0];
    await encryptIdentity(userId, 'ANSWER', answer.id);

    if (question.rows[0].author_id !== userId) {
      await emitNotification(question.rows[0].author_id, 'NEW_REPLY', {
        questionId,
        answerId: answer.id,
      });
    }

    res.status(201).json({
      id: answer.id,
      content: answer.body,
      isVerified: answer.is_verified,
      createdAt: answer.created_at,
      votes: 0,
      author: isAnonymous
        ? { id: null, name: 'Anonymous', avatar: null, reputation: 0 }
        : { id: userId, name: null, avatar: null, reputation: 0 },
    });
  } catch (error) {
    console.error('Error creating answer:', error);
    res.status(500).json({ error: 'Error creating answer' });
  }
});

router.post('/votes', authenticate, async (req: AuthRequest, res) => {
  const parseResult = voteSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const { targetType, targetId, value } = parseResult.data;
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const targetStatus = await pool.query(
      targetType === 'QUESTION'
        ? 'SELECT status FROM questions WHERE id = $1'
        : 'SELECT status FROM answers WHERE id = $1',
      [targetId]
    );

    if (targetStatus.rows.length === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }

    if (targetStatus.rows[0].status === 'ARCHIVED') {
      return res.status(423).json({ error: 'Target is archived' });
    }

    // §6.3 — one vote per (voter, target). A second vote surfaces the UNIQUE
    // constraint as 409. To change or remove a vote, callers DELETE first.
    try {
      await pool.query(
        `INSERT INTO votes (voter_id, target_type, target_id, value)
         VALUES ($1, $2, $3, $4)`,
        [userId, targetType, targetId, value]
      );
    } catch (insertError: any) {
      if (insertError?.code === '23505') {
        return res.status(409).json({ error: 'You have already voted on this target' });
      }
      throw insertError;
    }

    if (value === 1) {
      const target = await pool.query(
        targetType === 'QUESTION'
          ? 'SELECT author_id FROM questions WHERE id = $1'
          : 'SELECT author_id FROM answers WHERE id = $1',
        [targetId]
      );
      if (target.rows.length > 0 && target.rows[0].author_id !== userId) {
        await emitNotification(target.rows[0].author_id, 'UPVOTE', {
          targetType,
          targetId,
        });
      }
    }

    res.status(201).json({ message: 'Vote recorded', value });
  } catch (error: any) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Error recording vote' });
  }
});

// Remove the caller's own vote on a target. Lets the client toggle/change a vote
// without violating the one-vote-per-target rule enforced on POST.
router.delete('/votes/:targetType/:targetId', authenticate, async (req: AuthRequest, res) => {
  const parseResult = voteSchema
    .pick({ targetType: true, targetId: true })
    .safeParse({ targetType: req.params.targetType, targetId: req.params.targetId });
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const { targetType, targetId } = parseResult.data;
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await pool.query(
      'DELETE FROM votes WHERE voter_id = $1 AND target_type = $2 AND target_id = $3',
      [userId, targetType, targetId]
    );
    res.json({ message: 'Vote removed', value: 0 });
  } catch (error) {
    console.error('Error removing vote:', error);
    res.status(500).json({ error: 'Error removing vote' });
  }
});

router.get('/votes/question/:id/status', authenticate, async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      'SELECT value FROM votes WHERE voter_id = $1 AND target_type = $2 AND target_id = $3',
      [userId, 'QUESTION', req.params.id]
    );
    res.json({ value: result.rows[0]?.value || 0 });
  } catch (error) {
    console.error('Error getting vote status:', error);
    res.status(500).json({ error: 'Error getting vote status' });
  }
});

router.get('/votes/answer/:id/status', authenticate, async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      'SELECT value FROM votes WHERE voter_id = $1 AND target_type = $2 AND target_id = $3',
      [userId, 'ANSWER', req.params.id]
    );
    res.json({ value: result.rows[0]?.value || 0 });
  } catch (error) {
    console.error('Error getting vote status:', error);
    res.status(500).json({ error: 'Error getting vote status' });
  }
});

router.patch('/questions/:id/accept-answer/:answerId', authenticate, async (req: AuthRequest, res) => {
  const { id, answerId } = req.params;
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const question = await pool.query('SELECT author_id FROM questions WHERE id = $1', [id]);
    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const questionStatus = await pool.query('SELECT status FROM questions WHERE id = $1', [id]);
    if (questionStatus.rows[0]?.status === 'ARCHIVED') {
      return res.status(423).json({ error: 'Question is archived' });
    }

    if (question.rows[0].author_id !== userId) {
      return res.status(403).json({ error: 'Only OP can accept an answer' });
    }

    const existing = await pool.query(
      'SELECT id FROM answers WHERE question_id = $1 AND is_accepted = TRUE',
      [id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Answer already accepted' });
    }

    await pool.query('UPDATE answers SET is_verified = FALSE WHERE question_id = $1', [id]);
    await pool.query(
      'UPDATE answers SET is_accepted = TRUE, is_verified = TRUE WHERE id = $1 AND question_id = $2',
      [answerId, id]
    );

    const answerAuthor = await pool.query('SELECT author_id FROM answers WHERE id = $1', [answerId]);
    if (answerAuthor.rows.length > 0) {
      await emitNotification(answerAuthor.rows[0].author_id, 'ACCEPTED', {
        questionId: id,
        answerId,
      });
    }

    res.json({ message: 'Answer accepted' });
  } catch (error) {
    console.error('Error accepting answer:', error);
    res.status(500).json({ error: 'Error accepting answer' });
  }
});

router.patch('/questions/:id/resolve', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const question = await pool.query('SELECT author_id, is_resolved FROM questions WHERE id = $1', [id]);
    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.rows[0].author_id !== userId) {
      return res.status(403).json({ error: 'Only the author can resolve' });
    }

    const newResolved = !question.rows[0].is_resolved;
    const newStatus = newResolved ? 'LOCKED' : 'OPEN';

    await pool.query('UPDATE questions SET is_resolved = $1, status = $2 WHERE id = $3', [newResolved, newStatus, id]);
    res.json({ isResolved: newResolved });
  } catch (error) {
    console.error('Error resolving question:', error);
    res.status(500).json({ error: 'Error resolving question' });
  }
});

router.patch('/answers/:id/verify', authenticate, requireRole('FACULTY'), async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const answerStatus = await pool.query('SELECT status FROM answers WHERE id = $1', [id]);
    if (answerStatus.rows.length === 0) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    if (answerStatus.rows[0].status === 'ARCHIVED') {
      return res.status(423).json({ error: 'Answer is archived' });
    }

    await pool.query('UPDATE answers SET is_verified = TRUE WHERE id = $1', [id]);
    res.json({ message: 'Answer verified' });
  } catch (error) {
    console.error('Error verifying answer:', error);
    res.status(500).json({ error: 'Error verifying answer' });
  }
});

router.delete('/questions/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const question = await pool.query('SELECT author_id FROM questions WHERE id = $1', [id]);
    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.rows[0].author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete' });
    }

    await pool.query('DELETE FROM questions WHERE id = $1', [id]);
    res.json({ message: 'Question deleted' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Error deleting question' });
  }
});

router.delete('/answers/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const answer = await pool.query('SELECT author_id FROM answers WHERE id = $1', [id]);
    if (answer.rows.length === 0) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    if (answer.rows[0].author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete' });
    }

    await pool.query('DELETE FROM answers WHERE id = $1', [id]);
    res.json({ message: 'Answer deleted' });
  } catch (error) {
    console.error('Error deleting answer:', error);
    res.status(500).json({ error: 'Error deleting answer' });
  }
});

router.post('/bookmarks', authenticate, async (req: AuthRequest, res) => {
  const parseResult = bookmarkSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await pool.query(
      'INSERT INTO bookmarks (user_id, question_id) VALUES ($1, $2)',
      [userId, parseResult.data.questionId]
    );
    res.status(201).json({ message: 'Bookmarked' });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Already bookmarked' });
    }
    console.error('Error bookmarking:', error);
    res.status(500).json({ error: 'Error bookmarking' });
  }
});

router.delete('/bookmarks/:id', authenticate, async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await pool.query('DELETE FROM bookmarks WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
    res.json({ message: 'Bookmark removed' });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    res.status(500).json({ error: 'Error deleting bookmark' });
  }
});

export default router;
