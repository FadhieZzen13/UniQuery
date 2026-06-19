import request from 'supertest';
import { createApp } from '../../src/app.js';

describe('src/app — smoke', () => {
  const app = createApp();

  it('GET / returns API running message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Campus Connect API');
  });

  it('GET /healthz returns ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
