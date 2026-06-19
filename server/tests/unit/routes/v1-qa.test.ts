import request from 'supertest';
import express from 'express';
import {
  studentAuth,
  facultyAuth,
  USER_ID,
  OTHER_USER_ID,
  COURSE_ID,
  QUESTION_ID,
  ANSWER_ID,
} from '../../helpers/fixtures.js';

const mockQuery = jest.fn();
let currentAuth = studentAuth;

jest.mock('../../../src/index.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

jest.mock('../../../src/middleware/auth.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as { auth?: typeof studentAuth }).auth = currentAuth;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const role = (req as { auth?: typeof studentAuth }).auth?.role;
      if (!role || !roles.includes(role)) {
        return res.status(403).json({ error: 'Insufficient role' });
      }
      next();
    },
}));

jest.mock('../../../src/services/anonymity.js', () => ({
  encryptIdentity: jest.fn().mockResolvedValue(undefined),
  generateAlias: jest.fn(),
}));

jest.mock('../../../src/services/notifications.js', () => ({
  emitNotification: jest.fn().mockResolvedValue(undefined),
}));

import qaRoutes from '../../../src/routes/v1-qa.js';

const app = express();
app.use(express.json());
app.use('/api/v1', qaRoutes);

describe('v1 qa routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    currentAuth = studentAuth;
    jest.clearAllMocks();
  });

  it('lists questions', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: QUESTION_ID,
            title: 'Help',
            body: 'Need help',
            category: 'Academic',
            created_at: '2026-01-01',
            is_resolved: false,
            is_anonymous: false,
            author_id: USER_ID,
            author_name: 'Student',
            author_reputation: 1,
            votes: '2',
            answer_count: '1',
            has_verified_answer: false,
            tags: ['cs'],
          },
        ],
      });

    const res = await request(app).get('/api/v1/questions').query({ sort: 'votes', search: 'help' });
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('rejects invalid question payload', async () => {
    const res = await request(app).post('/api/v1/questions').send({ title: 'x' });
    expect(res.status).toBe(400);
  });

  it('creates a question for enrolled active course', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'ACTIVE' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'enrollment-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: QUESTION_ID,
            course_id: COURSE_ID,
            title: 'How to test?',
            body: 'Need examples',
            category: 'Academic',
            is_anonymous: false,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/v1/questions').send({
      courseId: COURSE_ID,
      title: 'How to test?',
      body: 'Need examples',
      tags: [],
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(QUESTION_ID);
  });

  it('returns 403 when user is not enrolled', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'ACTIVE' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/v1/questions').send({
      courseId: COURSE_ID,
      title: 'Blocked question',
      body: 'Should fail',
    });
    expect(res.status).toBe(403);
  });

  it('gets question detail', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: QUESTION_ID,
          title: 'Detail',
          body: 'Body',
          category: 'Academic',
          is_anonymous: false,
          status: 'OPEN',
          created_at: '2026-01-01',
          is_resolved: false,
          author_id: USER_ID,
          author_name: 'Student',
          author_reputation: 1,
          votes: '0',
          user_vote: '0',
          answer_count: '0',
          has_verified_answer: false,
          tags: [],
          is_bookmarked: false,
        },
      ],
    });

    const res = await request(app).get(`/api/v1/questions/${QUESTION_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Detail');
  });

  it('lists answers for question', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: ANSWER_ID,
          body: 'Answer body',
          is_verified: false,
          created_at: '2026-01-01',
          is_anonymous: false,
          author_id: USER_ID,
          author_name: 'Student',
          author_reputation: 1,
          votes: '1',
        },
      ],
    });

    const res = await request(app).get(`/api/v1/questions/${QUESTION_ID}/answers`);
    expect(res.status).toBe(200);
    expect(res.body[0].content).toBe('Answer body');
  });

  it('creates an answer and notifies question author', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: QUESTION_ID, author_id: OTHER_USER_ID, status: 'OPEN' }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: ANSWER_ID,
            question_id: QUESTION_ID,
            body: 'Try supertest',
            is_anonymous: false,
            is_verified: false,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      });

    const res = await request(app).post('/api/v1/answers').send({
      questionId: QUESTION_ID,
      body: 'Try supertest',
    });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Try supertest');
  });

  it('records and removes votes', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'OPEN' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ author_id: OTHER_USER_ID }] });

    const vote = await request(app).post('/api/v1/votes').send({
      targetType: 'QUESTION',
      targetId: QUESTION_ID,
      value: 1,
    });
    expect(vote.status).toBe(201);

    mockQuery.mockResolvedValueOnce({ rows: [] });
    const remove = await request(app).delete(`/api/v1/votes/QUESTION/${QUESTION_ID}`);
    expect(remove.status).toBe(200);
  });

  it('returns vote status endpoints', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ value: 1 }] });
    const questionStatus = await request(app).get(`/api/v1/votes/question/${QUESTION_ID}/status`);
    expect(questionStatus.status).toBe(200);
    expect(questionStatus.body.value).toBe(1);

    mockQuery.mockResolvedValueOnce({ rows: [] });
    const answerStatus = await request(app).get(`/api/v1/votes/answer/${ANSWER_ID}/status`);
    expect(answerStatus.status).toBe(200);
    expect(answerStatus.body.value).toBe(0);
  });

  it('accepts answer when requester is question author', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ author_id: USER_ID }] })
      .mockResolvedValueOnce({ rows: [{ status: 'OPEN' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ author_id: OTHER_USER_ID }] });

    const res = await request(app).patch(`/api/v1/questions/${QUESTION_ID}/accept-answer/${ANSWER_ID}`);
    expect(res.status).toBe(200);
  });

  it('toggles question resolved state', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ author_id: USER_ID, is_resolved: false }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).patch(`/api/v1/questions/${QUESTION_ID}/resolve`);
    expect(res.status).toBe(200);
    expect(res.body.isResolved).toBe(true);
  });

  it('verifies answer as faculty', async () => {
    currentAuth = facultyAuth;
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'OPEN' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).patch(`/api/v1/answers/${ANSWER_ID}/verify`);
    expect(res.status).toBe(200);
  });

  it('deletes own question and answer', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ author_id: USER_ID }] }).mockResolvedValueOnce({ rows: [] });
    const question = await request(app).delete(`/api/v1/questions/${QUESTION_ID}`);
    expect(question.status).toBe(200);

    mockQuery.mockResolvedValueOnce({ rows: [{ author_id: USER_ID }] }).mockResolvedValueOnce({ rows: [] });
    const answer = await request(app).delete(`/api/v1/answers/${ANSWER_ID}`);
    expect(answer.status).toBe(200);
  });

  it('bookmarks and removes bookmark', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const bookmark = await request(app).post('/api/v1/bookmarks').send({ questionId: QUESTION_ID });
    expect(bookmark.status).toBe(201);

    mockQuery.mockResolvedValueOnce({ rows: [] });
    const remove = await request(app).delete(`/api/v1/questions/${QUESTION_ID}/bookmarks`);
    expect(remove.status).toBe(200);
  });

  it('lists unanswered questions with sort=unanswered', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/v1/questions').query({ sort: 'unanswered' });
    expect(res.status).toBe(200);
    expect(res.body.questions).toEqual([]);
  });

  it('uses first enrollment when courseId is omitted', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ course_id: COURSE_ID }] })
      .mockResolvedValueOnce({ rows: [{ status: 'ACTIVE' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'enrollment-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: QUESTION_ID,
            course_id: COURSE_ID,
            title: 'No course id',
            body: 'Uses enrollment fallback',
            category: null,
            is_anonymous: false,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/v1/questions').send({
      title: 'No course id',
      body: 'Uses enrollment fallback',
    });
    expect(res.status).toBe(201);
  });

  it('returns 422 for unknown course', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/v1/questions').send({
      courseId: COURSE_ID,
      title: 'Bad course',
      body: 'Should fail validation',
    });
    expect(res.status).toBe(422);
  });

  it('returns 423 for archived course', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'ARCHIVED' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'enrollment-1' }] });

    const res = await request(app).post('/api/v1/questions').send({
      courseId: COURSE_ID,
      title: 'Archived course',
      body: 'Should be locked',
    });
    expect(res.status).toBe(423);
  });

  it('returns 404 for missing question detail', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get(`/api/v1/questions/${QUESTION_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when answering missing question', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/v1/answers').send({
      questionId: QUESTION_ID,
      body: 'Too late',
    });
    expect(res.status).toBe(404);
  });

  it('returns 423 when answering closed question', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: QUESTION_ID, author_id: OTHER_USER_ID, status: 'LOCKED' }],
    });
    const res = await request(app).post('/api/v1/answers').send({
      questionId: QUESTION_ID,
      body: 'Closed',
    });
    expect(res.status).toBe(423);
  });

  it('returns 409 for duplicate vote', async () => {
    const duplicateError = Object.assign(new Error('dup'), { code: '23505' });
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'OPEN' }] }).mockRejectedValueOnce(duplicateError);

    const res = await request(app).post('/api/v1/votes').send({
      targetType: 'QUESTION',
      targetId: QUESTION_ID,
      value: 1,
    });
    expect(res.status).toBe(409);
  });

  it('returns 403 when non-author accepts answer', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ author_id: OTHER_USER_ID }] })
      .mockResolvedValueOnce({ rows: [{ status: 'OPEN' }] });
    const res = await request(app).patch(`/api/v1/questions/${QUESTION_ID}/accept-answer/${ANSWER_ID}`);
    expect(res.status).toBe(403);
  });

  it('returns 409 when answer already accepted', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ author_id: USER_ID }] })
      .mockResolvedValueOnce({ rows: [{ status: 'OPEN' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'existing-accepted' }] });

    const res = await request(app).patch(`/api/v1/questions/${QUESTION_ID}/accept-answer/${ANSWER_ID}`);
    expect(res.status).toBe(409);
  });

  it('returns 403 when non-author resolves question', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ author_id: OTHER_USER_ID, is_resolved: false }] });
    const res = await request(app).patch(`/api/v1/questions/${QUESTION_ID}/resolve`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when faculty verifies missing answer', async () => {
    currentAuth = facultyAuth;
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).patch(`/api/v1/answers/${ANSWER_ID}/verify`);
    expect(res.status).toBe(404);
  });

  it('returns 403 when deleting another users question', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ author_id: OTHER_USER_ID }] });
    const res = await request(app).delete(`/api/v1/questions/${QUESTION_ID}`);
    expect(res.status).toBe(403);
  });

  it('returns 409 for duplicate bookmark', async () => {
    const duplicateError = Object.assign(new Error('dup'), { code: '23505' });
    mockQuery.mockRejectedValueOnce(duplicateError);
    const res = await request(app).post('/api/v1/bookmarks').send({ questionId: QUESTION_ID });
    expect(res.status).toBe(409);
  });

  it('maps anonymous authors in question list', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: QUESTION_ID,
            title: 'Anonymous post',
            body: 'Hidden author',
            category: 'Academic',
            created_at: '2026-01-01',
            is_resolved: false,
            is_anonymous: true,
            author_id: USER_ID,
            author_name: 'Student',
            author_reputation: 1,
            votes: '0',
            answer_count: '0',
            has_verified_answer: false,
            tags: [],
          },
        ],
      });

    const res = await request(app).get('/api/v1/questions').query({ category: 'Academic' });
    expect(res.status).toBe(200);
    expect(res.body.questions[0].author.name).toBe('Anonymous');
    expect(res.body.questions[0].author.id).toBeNull();
  });

  it('returns 423 when voting on archived target', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'ARCHIVED' }] });
    const res = await request(app).post('/api/v1/votes').send({
      targetType: 'ANSWER',
      targetId: ANSWER_ID,
      value: -1,
    });
    expect(res.status).toBe(423);
  });

  it('returns 400 for invalid vote delete params', async () => {
    const res = await request(app).delete('/api/v1/votes/BAD/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('creates anonymous answer content', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: QUESTION_ID, author_id: USER_ID, status: 'OPEN' }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: ANSWER_ID,
            question_id: QUESTION_ID,
            body: 'Anonymous tip',
            is_anonymous: true,
            is_verified: false,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      });

    const res = await request(app).post('/api/v1/answers').send({
      questionId: QUESTION_ID,
      body: 'Anonymous tip',
      isAnonymous: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.author.name).toBe('Anonymous');
  });
});
