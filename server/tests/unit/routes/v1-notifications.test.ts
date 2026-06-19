import request from 'supertest';
import express from 'express';
import { studentAuth, NOTIFICATION_ID } from '../../helpers/fixtures.js';

const mockQuery = jest.fn();

jest.mock('../../../src/index.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

jest.mock('../../../src/middleware/auth.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as { auth?: typeof studentAuth }).auth = studentAuth;
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import notificationsRoutes from '../../../src/routes/v1-notifications.js';

const app = express();
app.use(express.json());
app.use('/api/v1/notifications', notificationsRoutes);

describe('v1 notifications routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('lists notifications for user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: NOTIFICATION_ID,
          type: 'NEW_REPLY',
          payload: {},
          delivery_channel: 'IN_APP',
          read_at: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
  });

  it('marks notification as read', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: NOTIFICATION_ID, read_at: '2026-01-02T00:00:00Z' }],
    });

    const res = await request(app).patch(`/api/v1/notifications/${NOTIFICATION_ID}/read`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(NOTIFICATION_ID);
  });

  it('returns 404 when notification is missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).patch(`/api/v1/notifications/${NOTIFICATION_ID}/read`);
    expect(res.status).toBe(404);
  });

  it('returns 500 when listing notifications fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db error'));
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(500);
  });
});
