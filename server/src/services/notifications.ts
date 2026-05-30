import { pool } from '../index.js';

export type NotificationType =
  | 'NEW_REPLY'
  | 'ACCEPTED'
  | 'UPVOTE'
  | 'FLAG_TRIAGE'
  | 'DECRYPT_THRESHOLD';

export const emitNotification = async (
  recipientId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
  deliveryChannel: string = 'IN_APP'
) => {
  const recent = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM notifications
     WHERE recipient_id = $1
       AND created_at > now() - interval '60 minutes'`,
    [recipientId]
  );

  const recentCount = recent.rows[0]?.total || 0;
  const rateLimited = recentCount >= 60;

  const finalChannel = rateLimited ? 'DIGEST' : deliveryChannel;
  await pool.query(
    `INSERT INTO notifications (recipient_id, type, payload, delivery_channel)
     VALUES ($1, $2, $3, $4)`,
    [recipientId, type, payload, finalChannel]
  );
};

export const emitNotificationToAdmins = async (
  type: NotificationType,
  payload: Record<string, unknown>
) => {
  const admins = await pool.query(`SELECT id FROM users WHERE role = 'ADMIN'`);
  for (const row of admins.rows) {
    await emitNotification(row.id, type, payload);
  }
};
