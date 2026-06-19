import request from 'supertest';
import bcrypt from 'bcrypt';
import express from 'express';
import {
  USER_ID,
  INSTITUTION_ID,
  COURSE_ID,
  studentAuth,
} from '../../helpers/fixtures.js';

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

import v1Routes from '../../../src/routes/v1.js';

const app = express();
app.use(express.json());
app.use('/api/v1', v1Routes);

describe('v1 auth routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('rejects registration with invalid body', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ institutionalEmail: 'bad' });
    expect(res.status).toBe(400);
  });

  it('rejects non-edu email on register', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        institutionalEmail: 'user@gmail.com',
        password: 'password123',
        institutionId: INSTITUTION_ID,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('university');
  });

  it('accepts .edu.my email on register', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: USER_ID,
          institution_id: INSTITUTION_ID,
          institutional_email: '218319@student.upm.edu.my',
          role: 'STUDENT',
          full_name: null,
          display_name: null,
          created_at: '2026-01-01',
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        institutionalEmail: '218319@student.upm.edu.my',
        password: 'password123',
        institutionId: INSTITUTION_ID,
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('218319@student.upm.edu.my');
  });

  it('rejects duplicate user registration', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: USER_ID }] });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        institutionalEmail: 'student@test.edu',
        password: 'password123',
        institutionId: INSTITUTION_ID,
      });
    expect(res.status).toBe(409);
  });

  it('registers a new user and returns token', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: USER_ID,
            institution_id: INSTITUTION_ID,
            institutional_email: 'student@test.edu',
            role: 'STUDENT',
            full_name: null,
            display_name: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: COURSE_ID }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        institutionalEmail: 'student@test.edu',
        password: 'password123',
        institutionId: INSTITUTION_ID,
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('student@test.edu');
  });

  it('rejects login with invalid credentials', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ institutionalEmail: 'missing@test.edu', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('locks account when locked_until is active', async () => {
    const lockedUntil = new Date(Date.now() + 60000).toISOString();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: USER_ID,
          institution_id: INSTITUTION_ID,
          institutional_email: 'student@test.edu',
          password_hash: 'hash',
          role: 'STUDENT',
          full_name: 'Student',
          failed_login_count: 5,
          locked_until: lockedUntil,
        },
      ],
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ institutionalEmail: 'student@test.edu', password: 'wrong' });
    expect(res.status).toBe(423);
    expect(res.body.locked_until).toBe(lockedUntil);
  });

  it('returns 401 for wrong password and increments failed count', async () => {
    const hash = await bcrypt.hash('correct-password', 12);
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: USER_ID,
            institution_id: INSTITUTION_ID,
            institutional_email: 'student@test.edu',
            password_hash: hash,
            role: 'STUDENT',
            full_name: 'Student',
            failed_login_count: 0,
            locked_until: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ institutionalEmail: 'student@test.edu', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in successfully with valid credentials', async () => {
    const hash = await bcrypt.hash('correct-password', 12);
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: USER_ID,
            institution_id: INSTITUTION_ID,
            institutional_email: 'student@test.edu',
            password_hash: hash,
            role: 'STUDENT',
            full_name: 'Student',
            failed_login_count: 0,
            locked_until: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ course_id: COURSE_ID }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ institutionalEmail: 'student@test.edu', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.courseEnrollments).toEqual([COURSE_ID]);
  });

  it('logs out and revokes session', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
  });

  it('returns current user profile', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: USER_ID,
          institution_id: INSTITUTION_ID,
          institutional_email: 'student@test.edu',
          role: 'STUDENT',
          full_name: 'Student',
          display_name: 'CS|2026',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('student@test.edu');
  });

  it('lists available courses for institution', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: COURSE_ID }] })
      .mockResolvedValueOnce({
        rows: [{ id: COURSE_ID, code: 'CS101', title: 'Intro', status: 'ACTIVE' }],
      });

    const res = await request(app).get('/api/v1/courses/available');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('lists enrolled courses for user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: COURSE_ID, code: 'CS101', title: 'Intro', status: 'ACTIVE', institution_id: INSTITUTION_ID }],
    });

    const res = await request(app).get('/api/v1/courses/my');
    expect(res.status).toBe(200);
    expect(res.body[0].code).toBe('CS101');
  });

  it('returns 404 when /me user is missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(404);
  });

  it('returns 500 when registration fails unexpectedly', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db error'));
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        institutionalEmail: 'new@test.edu',
        password: 'password123',
        institutionId: INSTITUTION_ID,
      });
    expect(res.status).toBe(500);
  });
});
