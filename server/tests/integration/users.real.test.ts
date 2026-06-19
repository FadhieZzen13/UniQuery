/**
 * Integration — User admin (real routes + real Postgres).
 * PATCH /api/v1/users/:id is ADMIN-only: STUDENT -> 403, ADMIN -> 200 with the
 * updated role echoed back. Self-skips unless APPLICATION_DATABASE_URL_TEST is set.
 */
import request from 'supertest';
import type { Application } from 'express';
import type { TestContext } from './setup.js';

const RUN = !!process.env.APPLICATION_DATABASE_URL_TEST;
const d = RUN ? describe : describe.skip;

d('Integration — User admin', () => {
  let app: Application;
  let ctx: TestContext;
  let teardown: (c: TestContext) => Promise<void>;
  let close: () => Promise<void>;

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

  it('rejects a STUDENT with 403', async () => {
    await request(app)
      .patch(`/api/v1/users/${ctx.faculty.id}`)
      .set('Authorization', `Bearer ${ctx.student.token}`)
      .send({ role: 'ADMIN' })
      .expect(403);
  });

  it('lets an ADMIN update a role and echoes it back', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${ctx.faculty.id}`)
      .set('Authorization', `Bearer ${ctx.admin.token}`)
      .send({ role: 'ADMIN' })
      .expect(200);

    expect(res.body.id).toBe(ctx.faculty.id);
    expect(res.body.role).toBe('ADMIN');
  });
});
