import request from 'supertest';
import express from 'express';
import { studentAuth, FLAG_TARGET_ID, COURSE_ID } from '../../helpers/fixtures.js';

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

jest.mock('../../../src/services/notifications.js', () => ({
  emitNotification: jest.fn(),
}));

import { emitNotification } from '../../../src/services/notifications.js';
import flagsRoutes from '../../../src/routes/v1-flags.js';

const app = express();
app.use(express.json());
app.use('/api/v1/flags', flagsRoutes);

describe('v1 flags routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    jest.clearAllMocks();
  });

  it('rejects invalid flag payload', async () => {
    const res = await request(app).post('/api/v1/flags').send({ targetType: 'BAD' });
    expect(res.status).toBe(400);
  });

  it('creates a flag and notifies faculty', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: FLAG_TARGET_ID, course_id: COURSE_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: 'faculty-1' }] });

    const res = await request(app).post('/api/v1/flags').send({
      targetType: 'QUESTION',
      targetId: FLAG_TARGET_ID,
    });

    expect(res.status).toBe(201);
    expect(emitNotification).toHaveBeenCalled();
  });

  it('returns 404 when target is missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/v1/flags').send({
      targetType: 'QUESTION',
      targetId: FLAG_TARGET_ID,
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 for duplicate flag', async () => {
    const duplicateError = Object.assign(new Error('duplicate'), { code: '23505' });
    mockQuery.mockRejectedValueOnce(duplicateError);

    const res = await request(app).post('/api/v1/flags').send({
      targetType: 'QUESTION',
      targetId: FLAG_TARGET_ID,
    });
    expect(res.status).toBe(409);
  });

  it('flags an answer target and resolves course via join', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'answer-1', course_id: COURSE_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: 'faculty-1' }] });

    const res = await request(app).post('/api/v1/flags').send({
      targetType: 'ANSWER',
      targetId: '00000000-0000-4000-8000-000000000040',
    });

    expect(res.status).toBe(201);
    expect(emitNotification).toHaveBeenCalled();
  });

  it('returns 500 on unexpected flag error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db error'));
    const res = await request(app).post('/api/v1/flags').send({
      targetType: 'QUESTION',
      targetId: FLAG_TARGET_ID,
    });
    expect(res.status).toBe(500);
  });
});
