import request from 'supertest';
import express from 'express';
import { studentAuth, USER_ID, COURSE_ID } from '../../helpers/fixtures.js';

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

import usersRoutes from '../../../src/routes/users.js';

const app = express();
app.use(express.json());
app.use('/api/users', usersRoutes);

describe('users routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns current user profile', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: USER_ID,
            institutional_email: 'student@test.edu',
            full_name: 'Student',
            display_name: 'CS|2026',
            reputation: 5,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('student@test.edu');
    expect(res.body.major).toBe('CS');
  });

  it('completes onboarding for new profile', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ institution_id: 'inst-1', full_name: null, display_name: null }],
      })
      .mockResolvedValueOnce({ rows: [{ id: COURSE_ID }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: USER_ID,
            institutional_email: 'student@test.edu',
            full_name: 'Student',
            display_name: 'CS|2026',
            reputation: 0,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/users/onboarding').send({
      name: 'Student',
      major: 'CS',
      year: '2026',
      courseId: COURSE_ID,
    });

    expect(res.status).toBe(200);
    expect(res.body.onboardingCompleted).toBe(true);
  });

  it('updates profile', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ full_name: 'Student', display_name: 'CS|2026' }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: USER_ID,
            institutional_email: 'student@test.edu',
            full_name: 'Updated',
            display_name: 'Math|2027',
            reputation: 1,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const res = await request(app)
      .put('/api/users/profile')
      .send({ name: 'Updated', major: 'Math', year: '2027' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('returns public profile by id', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: USER_ID,
          institutional_email: 'student@test.edu',
          full_name: 'Student',
          display_name: 'CS|2026',
          reputation: 3,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const res = await request(app).get(`/api/users/${USER_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Student');
  });

  it('returns 404 for missing profile', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get(`/api/users/${USER_ID}`);
    expect(res.status).toBe(404);
  });

  it('requires course on onboarding', async () => {
    const res = await request(app).post('/api/users/onboarding').send({ name: 'Student' });
    expect(res.status).toBe(400);
  });

  it('requires profile fields for first-time onboarding', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ institution_id: 'inst-1', full_name: null, display_name: null }],
    });
    const res = await request(app).post('/api/users/onboarding').send({ courseId: COURSE_ID });
    expect(res.status).toBe(400);
  });

  it('rejects invalid course on onboarding', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ institution_id: 'inst-1', full_name: null, display_name: null }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/users/onboarding')
      .send({ name: 'Student', major: 'CS', year: '2026', courseId: COURSE_ID });
    expect(res.status).toBe(400);
  });

  it('enrolls an already-onboarded user without rewriting profile', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ institution_id: 'inst-1', full_name: 'Student', display_name: 'CS|2026' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: COURSE_ID }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: USER_ID,
            institutional_email: 'student@test.edu',
            full_name: 'Student',
            display_name: 'CS|2026',
            reputation: 0,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/users/onboarding').send({ courseId: COURSE_ID });
    expect(res.status).toBe(200);
    expect(res.body.needsCourseEnrollment).toBe(false);
  });

  it('maps public profile without display metadata', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: USER_ID,
          institutional_email: 'student@test.edu',
          full_name: null,
          display_name: null,
          reputation: 0,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const res = await request(app).get(`/api/users/${USER_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.major).toBeNull();
  });
});
