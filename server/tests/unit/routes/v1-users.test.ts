import request from 'supertest';
import express from 'express';
import { adminAuth, USER_ID } from '../../helpers/fixtures.js';

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

import usersAdminRoutes from '../../../src/routes/v1-users.js';

const app = express();
app.use(express.json());
app.use('/api/v1/users', usersAdminRoutes);

describe('v1 users admin routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('rejects empty patch body', async () => {
    const res = await request(app).patch(`/api/v1/users/${USER_ID}`).send({});
    expect(res.status).toBe(400);
  });

  it('updates user role', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: USER_ID,
          institutional_email: 'student@test.edu',
          full_name: 'Student',
          display_name: null,
          role: 'FACULTY',
          locked_until: null,
          reputation: 10,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const res = await request(app).patch(`/api/v1/users/${USER_ID}`).send({ role: 'FACULTY' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('FACULTY');
  });

  it('locks and unlocks user accounts', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: USER_ID,
            institutional_email: 'student@test.edu',
            full_name: 'Student',
            display_name: null,
            role: 'STUDENT',
            locked_until: new Date().toISOString(),
            reputation: 0,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: USER_ID,
            institutional_email: 'student@test.edu',
            full_name: 'Student',
            display_name: null,
            role: 'STUDENT',
            locked_until: null,
            reputation: 0,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      });

    const lockRes = await request(app).patch(`/api/v1/users/${USER_ID}`).send({ locked: true });
    expect(lockRes.status).toBe(200);

    const unlockRes = await request(app).patch(`/api/v1/users/${USER_ID}`).send({ locked: false });
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.lockedUntil).toBeNull();
  });

  it('returns 404 when user is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).patch(`/api/v1/users/${USER_ID}`).send({ role: 'FACULTY' });
    expect(res.status).toBe(404);
  });
});
