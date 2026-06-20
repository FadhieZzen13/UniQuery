/**
 * Integration — Anonymity (real routes + real Postgres).
 * Posts an anonymous question, asserts the identity_markers row holds an encrypted
 * BYTEA payload, FACULTY can decrypt it, and STUDENT is denied (403).
 * Self-skips unless APPLICATION_DATABASE_URL_TEST is set.
 */
import request from 'supertest';
import type { Application } from 'express';
import type { Pool } from 'pg';
import type { TestContext } from './setup.js';

const RUN = !!process.env.APPLICATION_DATABASE_URL_TEST;
const d = RUN ? describe : describe.skip;

d('Integration — Anonymity', () => {
  let app: Application;
  let pool: Pool;
  let ctx: TestContext;
  let teardown: (c: TestContext) => Promise<void>;
  let close: () => Promise<void>;
  let markerId: string;

  beforeAll(async () => {
    const setup = await import('./setup.js');
    const { createApp } = await import('../../src/app.js');
    ({ pool } = await import('../../src/index.js'));
    app = createApp();
    ctx = await setup.setupTestData();
    teardown = setup.teardownTestData;
    close = setup.closePool;
  });

  afterAll(async () => {
    if (ctx) await teardown(ctx);
    if (close) await close();
  });

  it('stores an encrypted BYTEA identity marker for an anonymous question', async () => {
    const res = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ctx.student.token}`)
      .send({
        title: 'Anonymous integration question',
        body: 'Posted with is_anonymous true to exercise the anonymity engine.',
        isAnonymous: true,
        courseId: ctx.courseId,
      })
      .expect(201);

    const questionId = res.body.id as string;
    const marker = await pool.query(
      `SELECT id, encrypted_user_id FROM identity_markers WHERE target_type = 'QUESTION' AND target_id = $1`,
      [questionId]
    );
    expect(marker.rows).toHaveLength(1);
    expect(Buffer.isBuffer(marker.rows[0].encrypted_user_id)).toBe(true);
    expect(marker.rows[0].encrypted_user_id.length).toBeGreaterThan(0);
    markerId = marker.rows[0].id;
  });

  it('lets FACULTY decrypt the marker back to the real author id', async () => {
    const res = await request(app)
      .post('/api/v1/moderation/decrypt')
      .set('Authorization', `Bearer ${ctx.faculty.token}`)
      .send({ markerId })
      .expect(200);

    expect(res.body.userId).toBe(ctx.student.id);
  });

  it('denies STUDENT the decrypt route with 403', async () => {
    await request(app)
      .post('/api/v1/moderation/decrypt')
      .set('Authorization', `Bearer ${ctx.student.token}`)
      .send({ markerId })
      .expect(403);
  });
});
