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

  it('allows CORS for localhost and vercel.app origins', async () => {
    const localhost = await request(app)
      .get('/healthz')
      .set('Origin', 'http://localhost:8080');
    expect(localhost.headers['access-control-allow-origin']).toBe('http://localhost:8080');

    const vercelPreview = await request(app)
      .get('/healthz')
      .set('Origin', 'https://uniquery-git-dev-team.vercel.app');
    expect(vercelPreview.headers['access-control-allow-origin']).toBe(
      'https://uniquery-git-dev-team.vercel.app'
    );

    const production = await request(app)
      .get('/healthz')
      .set('Origin', 'https://uniquery.vercel.app');
    expect(production.headers['access-control-allow-origin']).toBe('https://uniquery.vercel.app');
  });

  it('rejects disallowed CORS origins', async () => {
    const res = await request(app)
      .get('/healthz')
      .set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(500);
  });
});
