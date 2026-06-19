import request from 'supertest';
import express from 'express';
import {
  adminAuth,
  INSTITUTION_ID,
  COURSE_ID,
  ENROLLMENT_ID,
} from '../../helpers/fixtures.js';

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

import adminRoutes from '../../../src/routes/v1-admin.js';

const app = express();
app.use(express.json());
app.use('/api/v1/admin', adminRoutes);

describe('v1 admin routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('lists institutions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: INSTITUTION_ID, name: 'Test U', domain: 'test.edu' }] });
    const res = await request(app).get('/api/v1/admin/institutions');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Test U');
  });

  it('creates institution', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: INSTITUTION_ID, name: 'New U', domain: 'new.edu', created_at: '2026-01-01' }],
    });
    const res = await request(app)
      .post('/api/v1/admin/institutions')
      .send({ name: 'New U', domain: 'new.edu' });
    expect(res.status).toBe(201);
  });

  it('requires institution_id for course listing', async () => {
    const res = await request(app).get('/api/v1/admin/courses');
    expect(res.status).toBe(400);
  });

  it('creates course and handles duplicate code', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: COURSE_ID, institution_id: INSTITUTION_ID, code: 'CS101', title: 'Intro', status: 'ACTIVE' }],
    });

    const ok = await request(app)
      .post('/api/v1/admin/courses')
      .send({ institutionId: INSTITUTION_ID, code: 'CS101', title: 'Intro' });
    expect(ok.status).toBe(201);

    mockQuery.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    const dup = await request(app)
      .post('/api/v1/admin/courses')
      .send({ institutionId: INSTITUTION_ID, code: 'CS101', title: 'Intro' });
    expect(dup.status).toBe(409);
  });

  it('lists and creates enrollments', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ENROLLMENT_ID, role: 'STUDENT' }] });
    const list = await request(app).get('/api/v1/admin/enrollments').query({ course_id: COURSE_ID });
    expect(list.status).toBe(200);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
      .mockResolvedValueOnce({
        rows: [{ id: ENROLLMENT_ID, user_id: 'user-1', course_id: COURSE_ID, role: 'STUDENT' }],
      });

    const create = await request(app)
      .post('/api/v1/admin/enrollments')
      .send({ courseId: COURSE_ID, userEmail: 'student@test.edu', role: 'STUDENT' });
    expect(create.status).toBe(201);
  });

  it('deletes enrollment', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ENROLLMENT_ID }] });
    const res = await request(app).delete(`/api/v1/admin/enrollments/${ENROLLMENT_ID}`);
    expect(res.status).toBe(200);
  });

  it('archives course', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ archived_at: new Date().toISOString() }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post(`/api/v1/admin/courses/${COURSE_ID}/archive`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Course archived');
  });

  it('rejects invalid institution payload', async () => {
    const res = await request(app).post('/api/v1/admin/institutions').send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate institution domain', async () => {
    mockQuery.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    const res = await request(app)
      .post('/api/v1/admin/institutions')
      .send({ name: 'Dup U', domain: 'dup.edu' });
    expect(res.status).toBe(409);
  });

  it('returns 404 when enrollment user is missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/v1/admin/enrollments')
      .send({ courseId: COURSE_ID, userEmail: 'missing@test.edu' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when deleting missing enrollment', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete(`/api/v1/admin/enrollments/${ENROLLMENT_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when archiving unknown course', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post(`/api/v1/admin/courses/${COURSE_ID}/archive`);
    expect(res.status).toBe(404);
  });

  it('returns 500 when listing institutions fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db error'));
    const res = await request(app).get('/api/v1/admin/institutions');
    expect(res.status).toBe(500);
  });

  it('returns 409 for duplicate enrollment', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));

    const res = await request(app)
      .post('/api/v1/admin/enrollments')
      .send({ courseId: COURSE_ID, userEmail: 'student@test.edu', role: 'STUDENT' });
    expect(res.status).toBe(409);
  });
});
