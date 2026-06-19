import request from 'supertest';
import express from 'express';
import { studentAuth, COURSE_ID, QUESTION_ID } from '../../helpers/fixtures.js';

const mockQuery = jest.fn();

jest.mock('../../../src/index.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

jest.mock('../../../src/middleware/auth.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as { auth?: typeof studentAuth }).auth = studentAuth;
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import searchRoutes from '../../../src/routes/v1-search.js';

const app = express();
app.use(express.json());
app.use('/api/v1/search', searchRoutes);

describe('v1 search routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('requires q parameter', async () => {
    const res = await request(app).get('/api/v1/search');
    expect(res.status).toBe(400);
  });

  it('returns search results', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: QUESTION_ID,
          title: 'Binary search',
          is_anonymous: false,
          author_id: 'author-1',
        },
      ],
    });

    const res = await request(app).get('/api/v1/search').query({ q: 'binary', limit: 10, offset: 0 });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.query).toBe('binary');
  });

  it('returns 500 when anonymous row leaks author_id', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: QUESTION_ID, is_anonymous: true, author_id: 'leaked' }],
    });

    const res = await request(app).get('/api/v1/search').query({ q: 'leak' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Search failed');
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get('/api/v1/search').query({ q: 'error' });
    expect(res.status).toBe(500);
  });
});
