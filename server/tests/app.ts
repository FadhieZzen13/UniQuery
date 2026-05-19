/**
 * Testable Express App Factory
 * 
 * Creates an Express application instance WITHOUT:
 * - Calling app.listen() (no port binding)
 * - Connecting to a real PostgreSQL database
 * 
 * This allows supertest to drive requests through the Express router
 * while MSW intercepts any outbound HTTP calls.
 */

import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // ─── Health Check Endpoint ───────────────────────────────────────
  // Used by smoke tests and CI to verify the pipeline works end-to-end
  app.get('/health-check', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // ─── Mock API Routes ─────────────────────────────────────────────
  // These route stubs simulate the real API surface for test purposes.
  // In production, these are replaced by the actual route handlers in src/routes/

  // Auth routes
  app.post('/api/auth/register', (req, res) => {
    // Forwarded to MSW mock handler via supertest
    res.status(501).json({ error: 'Not implemented — use MSW handler' });
  });

  app.post('/api/auth/login', (req, res) => {
    res.status(501).json({ error: 'Not implemented — use MSW handler' });
  });

  app.get('/api/auth/verify', (req, res) => {
    res.status(501).json({ error: 'Not implemented — use MSW handler' });
  });

  // User routes
  app.patch('/api/users/:id', (req, res) => {
    res.status(501).json({ error: 'Not implemented — use MSW handler' });
  });

  // Question routes (with anonymity support)
  app.post('/api/questions', (req, res) => {
    res.status(501).json({ error: 'Not implemented — use MSW handler' });
  });

  app.get('/api/questions/search', (req, res) => {
    res.status(501).json({ error: 'Not implemented — use MSW handler' });
  });

  // Answer acceptance
  app.post('/api/answers/:id/accept', (req, res) => {
    res.status(501).json({ error: 'Not implemented — use MSW handler' });
  });

  // Flagging
  app.post('/api/questions/:id/flag', (req, res) => {
    res.status(501).json({ error: 'Not implemented — use MSW handler' });
  });

  // Moderation (decrypt — for anonymity tests)
  app.post('/api/moderation/decrypt', (req, res) => {
    res.status(501).json({ error: 'Not implemented — use MSW handler' });
  });

  return app;
}
