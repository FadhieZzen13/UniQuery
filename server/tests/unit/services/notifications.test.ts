const mockQuery = jest.fn();

jest.mock('../../../src/index.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { emitNotification, emitNotificationToAdmins } from '../../../src/services/notifications.js';
import { USER_ID, ADMIN_ID } from '../../helpers/fixtures.js';

describe('notifications service', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('inserts in-app notification when under rate limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] });

    await emitNotification(USER_ID, 'NEW_REPLY', { questionId: 'q1' });

    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      [USER_ID, 'NEW_REPLY', { questionId: 'q1' }, 'IN_APP']
    );
  });

  it('routes to digest channel when rate limited', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 60 }] }).mockResolvedValueOnce({ rows: [] });

    await emitNotification(USER_ID, 'UPVOTE', { targetId: 't1' });

    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      [USER_ID, 'UPVOTE', { targetId: 't1' }, 'DIGEST']
    );
  });

  it('emits to all admins', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: ADMIN_ID }] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await emitNotificationToAdmins('FLAG_TRIAGE', { courseId: 'c1' });

    expect(mockQuery).toHaveBeenCalledWith(`SELECT id FROM users WHERE role = 'ADMIN'`);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      [ADMIN_ID, 'FLAG_TRIAGE', { courseId: 'c1' }, 'IN_APP']
    );
  });
});
