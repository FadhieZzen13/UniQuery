/**
 * Integration — Search (real routes + real Postgres).
 * Seeds 5 matching questions (3 anonymous) and asserts GET /api/v1/search returns rows
 * with author_id === null for every anonymous row (the anonymity invariant).
 * Self-skips unless APPLICATION_DATABASE_URL_TEST is set.
 */
import request from 'supertest';
import type { Application } from 'express';
import type { TestContext } from './setup.js';

const RUN = !!process.env.APPLICATION_DATABASE_URL_TEST;
const d = RUN ? describe : describe.skip;

// Distinctive term so the query matches only this suite's seeded rows.
const TERM = 'photosynthesis';

d('Integration — Search', () => {
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

    const seeds = [
      { anon: true }, { anon: true }, { anon: true },
      { anon: false }, { anon: false },
    ];
    for (let i = 0; i < seeds.length; i++) {
      await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${ctx.student.token}`)
        .send({
          title: `${TERM} study group ${i}`,
          body: `Notes about ${TERM} and the Calvin cycle, entry ${i}.`,
          isAnonymous: seeds[i].anon,
          courseId: ctx.courseId,
        })
        .expect(201);
    }
  });

  afterAll(async () => {
    if (ctx) await teardown(ctx);
    if (close) await close();
  });

  it('returns ranked rows and never exposes author_id on anonymous rows', async () => {
    const res = await request(app)
      .get(`/api/v1/search?q=${TERM}&limit=100`)
      .set('Authorization', `Bearer ${ctx.student.token}`)
      .expect(200);

    expect(res.body.query).toBe(TERM);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThanOrEqual(5);

    const anon = res.body.results.filter((r: any) => r.is_anonymous === true);
    const named = res.body.results.filter((r: any) => r.is_anonymous === false);
    expect(anon.length).toBeGreaterThanOrEqual(3);
    expect(named.length).toBeGreaterThanOrEqual(2);

    for (const row of res.body.results) {
      if (row.is_anonymous === true) {
        expect(row.author_id).toBeNull();
      } else {
        expect(row.author_id).toBe(ctx.student.id);
      }
    }
  });
});
