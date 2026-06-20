import express from 'express';
import cors from 'cors';
import usersRoutes from './routes/users.js';
import v1Routes from './routes/v1.js';
import searchRoutes from './routes/v1-search.js';

// Express application factory. Builds and wires the app WITHOUT binding a port,
// so supertest (tests/integration/*) can drive requests in-process. index.ts owns
// the lifecycle (pool, app.listen, cron); see tests/integration for real-route coverage.
export function createApp(): express.Application {
  const app = express();

  const staticOrigins = [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:5173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081',
    'https://uniquery.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || staticOrigins.includes(origin) || /\.vercel\.app$/i.test(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.send('Campus Connect API is running');
  });

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Working API surface: /api/v1/* (auth, Q&A, votes, moderation), /api/users for
  // profiles, and /api/v1/search (Karthik's full-text RPC, HTTP-exposed in Task A).
  app.use('/api/users', usersRoutes);
  app.use('/api/v1', v1Routes);
  app.use('/api/v1/search', searchRoutes);

  return app;
}
