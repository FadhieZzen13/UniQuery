import request from 'supertest';
import express from 'express';
import { facultyAuth, COURSE_ID, MARKER_ID } from '../../helpers/fixtures.js';

const mockQuery = jest.fn();

jest.mock('../../../src/index.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

jest.mock('../../../src/middleware/auth.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as { auth?: typeof facultyAuth }).auth = facultyAuth;
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../src/services/anonymity.js', () => ({
  decryptIdentity: jest.fn().mockResolvedValue('user-1'),
}));

import { decryptIdentity } from '../../../src/services/anonymity.js';
import moderationRoutes from '../../../src/routes/v1-moderation.js';

const app = express();
app.use(express.json());
app.use('/api/v1/moderation', moderationRoutes);

describe('v1 moderation routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    jest.clearAllMocks();
  });

  it('requires course_id for flag listing', async () => {
    const res = await request(app).get('/api/v1/moderation/flags');
    expect(res.status).toBe(400);
  });

  it('lists open flags for a course', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'flag-1' }] });
    const res = await request(app).get('/api/v1/moderation/flags').query({ course_id: COURSE_ID });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('rejects invalid moderation action payload', async () => {
    const res = await request(app).post('/api/v1/moderation/actions').send({ action: 'HIDE' });
    expect(res.status).toBe(400);
  });

  it('records moderation action on question', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/v1/moderation/actions').send({
      targetType: 'QUESTION',
      targetId: '00000000-0000-4000-8000-000000000030',
      action: 'HIDE',
      justification: 'Violates community guidelines',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Moderation action recorded');
  });

  it('decrypts identity for faculty', async () => {
    const res = await request(app).post('/api/v1/moderation/decrypt').send({ markerId: MARKER_ID });
    expect(res.status).toBe(200);
    expect(decryptIdentity).toHaveBeenCalledWith(MARKER_ID, facultyAuth.userId, facultyAuth.role);
    expect(res.body.userId).toBe('user-1');
  });

  it('returns 403 when decrypt fails authorization', async () => {
    (decryptIdentity as jest.Mock).mockRejectedValueOnce(new Error('Role not permitted'));
    const res = await request(app).post('/api/v1/moderation/decrypt').send({ markerId: MARKER_ID });
    expect(res.status).toBe(403);
  });

  it('records moderation action on answer target', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/v1/moderation/actions').send({
      targetType: 'ANSWER',
      targetId: '00000000-0000-4000-8000-000000000040',
      action: 'LOCK',
      justification: 'Answer needs review by faculty',
    });

    expect(res.status).toBe(200);
  });

  it('returns 500 when moderation action fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db error')).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/v1/moderation/actions').send({
      targetType: 'QUESTION',
      targetId: '00000000-0000-4000-8000-000000000030',
      action: 'HIDE',
      justification: 'Violates community guidelines',
    });
    expect(res.status).toBe(500);
  });

  it('returns 500 when listing flags fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db error'));
    const res = await request(app).get('/api/v1/moderation/flags').query({ course_id: COURSE_ID });
    expect(res.status).toBe(500);
  });
});
