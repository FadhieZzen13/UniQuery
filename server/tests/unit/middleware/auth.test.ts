import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { USER_ID, INSTITUTION_ID, COURSE_ID } from '../../helpers/fixtures.js';

const mockQuery = jest.fn();

jest.mock('../../../src/index.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { authenticate, requireRole, type AuthRequest } from '../../../src/middleware/auth.js';

const jwtSecret = process.env.JWT_SECRET!;

const fingerprint = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const makeToken = (overrides: Record<string, unknown> = {}) => {
  const jti = 'test-session-id';
  return jwt.sign(
    {
      sub: USER_ID,
      role: 'STUDENT',
      institution_id: INSTITUTION_ID,
      course_enrollments: [COURSE_ID],
      jti,
      ...overrides,
    },
    jwtSecret,
    { expiresIn: '1h' }
  );
};

const runMiddleware = async (
  middleware: (req: AuthRequest, res: Response, next: NextFunction) => unknown,
  headers: Record<string, string> = {}
) => {
  const req = { headers } as AuthRequest;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as Response & { statusCode: number; body: unknown };
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  return { req, res, nextCalled };
};

describe('authenticate middleware', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns 401 when no token is provided', async () => {
    const { res, nextCalled } = await runMiddleware(authenticate);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Access token required' });
    expect(nextCalled).toBe(false);
  });

  it('returns 401 when session is missing', async () => {
    const token = makeToken();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { res, nextCalled } = await runMiddleware(authenticate, {
      authorization: `Bearer ${token}`,
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Session not found' });
    expect(nextCalled).toBe(false);
  });

  it('returns 401 when session is revoked', async () => {
    const token = makeToken();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          session_id: 'test-session-id',
          user_id: USER_ID,
          revoked_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
      ],
    });

    const { res } = await runMiddleware(authenticate, {
      authorization: `Bearer ${token}`,
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Session revoked' });
  });

  it('returns 401 when session is stale', async () => {
    const token = makeToken();
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          session_id: 'test-session-id',
          user_id: USER_ID,
          revoked_at: null,
          last_seen_at: stale,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
      ],
    });

    const { res } = await runMiddleware(authenticate, {
      authorization: `Bearer ${token}`,
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Session expired' });
  });

  it('attaches auth context and updates last_seen_at for valid sessions', async () => {
    const token = makeToken();
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            session_id: 'test-session-id',
            user_id: USER_ID,
            revoked_at: null,
            last_seen_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const { req, res, nextCalled } = await runMiddleware(authenticate, {
      authorization: `Bearer ${token}`,
    });

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(req.auth).toMatchObject({
      userId: USER_ID,
      role: 'STUDENT',
      institutionId: INSTITUTION_ID,
      courseEnrollments: [COURSE_ID],
      sessionId: 'test-session-id',
    });
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE sessions SET last_seen_at = now() WHERE session_id = $1',
      ['test-session-id']
    );
    expect(fingerprint(token)).toHaveLength(64);
  });

  it('returns 401 for invalid tokens', async () => {
    const { res } = await runMiddleware(authenticate, {
      authorization: 'Bearer not-a-valid-jwt',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });
});

describe('requireRole middleware', () => {
  it('returns 403 when role is not allowed', () => {
    const req = { auth: { role: 'STUDENT' } } as AuthRequest;
    const res = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    } as Response & { statusCode: number; body: unknown };
    let nextCalled = false;

    requireRole('ADMIN')(req, res, () => {
      nextCalled = true;
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Insufficient role' });
    expect(nextCalled).toBe(false);
  });

  it('calls next when role is allowed', () => {
    const req = { auth: { role: 'ADMIN' } } as AuthRequest;
    const res = {} as Response;
    let nextCalled = false;

    requireRole('ADMIN')(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});
