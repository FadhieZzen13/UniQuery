/**
 * Smoke Test: Health Check Endpoint
 * 
 * Week 7 — Proves the test pipeline works end-to-end.
 * Verifies the /health-check endpoint returns HTTP 200 with { status: 'ok' }.
 */

import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

describe('Smoke Test — Health Check', () => {
  it('GET /health-check should return 200 with status ok', async () => {
    const response = await request(app)
      .get('/health-check')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /health-check should respond within 200ms', async () => {
    const start = Date.now();
    await request(app).get('/health-check');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(200);
  });
});
