import request from 'supertest';
import express from 'express';
import { adminAuth } from '../../helpers/fixtures.js';

const mockQuery = jest.fn();

jest.mock('../../../src/index.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

jest.mock('../../../src/middleware/auth.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as { auth?: typeof adminAuth }).auth = adminAuth;
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import perfRoutes from '../../../src/routes/v1-perf.js';

const app = express();
app.use(express.json());
app.use('/api/v1/admin/perf', perfRoutes);

describe('v1 perf routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns slow queries for admin', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ query: 'SELECT 1', calls: 1, total_time: 10, mean_time: 10, rows: 1 }],
    });

    const res = await request(app).get('/api/v1/admin/perf/slow-queries').query({ limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.queries).toHaveLength(1);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('pg_stat_statements unavailable'));
    const res = await request(app).get('/api/v1/admin/perf/slow-queries');
    expect(res.status).toBe(500);
  });
});
