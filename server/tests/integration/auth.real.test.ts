/**
 * Integration — Auth (real routes + real Postgres).
 * Verifies login JWT claims/TTL and the brute-force lockout (Karthik's fix).
 * Self-skips unless APPLICATION_DATABASE_URL_TEST is set.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Application } from 'express';
import type { TestContext } from './setup.js';

const RUN = !!process.env.APPLICATION_DATABASE_URL_TEST;
const d = RUN ? describe : describe.skip;

d('Integration — Auth', () => {
  let app: Application;
  let ctx: TestContext;
  let teardown: (c: TestContext) => Promise<void>;
  let close: () => Promise<void>;
  const TEST_PASSWORD = 'Password123!';

  beforeAll(async () => {
    const setup = await import('./setup.js');
    const { createApp } = await import('../../src/app.js');
    app = createApp();
    ctx = await setup.setupTestData();
    teardown = setup.teardownTestData;
    close = setup.closePool;
  });

  afterAll(async () => {
    if (ctx) await teardown(ctx);
    if (close) await close();
  });

  it('login returns a JWT carrying sub/role/institution_id/course_enrollments/jti/exp with a 24h TTL', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ institutionalEmail: ctx.student.email, password: TEST_PASSWORD })
      .expect(200);

    expect(typeof res.body.token).toBe('string');
    const decoded = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(decoded.sub).toBe(ctx.student.id);
    expect(decoded.role).toBe('STUDENT');
    expect(decoded.institution_id).toBe(ctx.institutionId);
    expect(Array.isArray(decoded.course_enrollments)).toBe(true);
    expect(typeof decoded.jti).toBe('string');
    expect(typeof decoded.exp).toBe('number');
    expect(typeof decoded.iat).toBe('number');
    // 24h TTL (allow a few seconds of slack)
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(24 * 60 * 60);
  });

  it('locks the account on the 6th strike: returns 423 with locked_until', async () => {
    // Five wrong-password attempts arm the lock (count reaches 5 on the 5th, still 401).
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ institutionalEmail: ctx.student.email, password: 'wrong-password' })
        .expect(401);
    }
    // The 6th attempt is rejected by the lock gate before password comparison.
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ institutionalEmail: ctx.student.email, password: 'wrong-password' })
      .expect(423);

    expect(res.body.locked_until).toBeDefined();
    expect(new Date(res.body.locked_until).getTime()).toBeGreaterThan(Date.now());
  });
});
