import nodemailer from 'nodemailer';
import { pool } from '../index.js';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || 'noreply@uniquery.local';

const buildTransport = () => {
  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
};

export const sendDigestEmails = async () => {
  const transporter = buildTransport();
  if (!transporter) {
    console.warn('Digest skipped: SMTP config missing');
    return;
  }

  const result = await pool.query(
    `SELECT n.id, n.recipient_id, n.type, n.payload, n.created_at, u.institutional_email
     FROM notifications n
     JOIN users u ON u.id = n.recipient_id
     WHERE n.read_at IS NULL
       AND n.created_at < now() - interval '24 hours'`,
  );

  if (result.rows.length === 0) {
    return;
  }

  const grouped: Record<string, { email: string; items: typeof result.rows }> = {};
  for (const row of result.rows) {
    if (!grouped[row.recipient_id]) {
      grouped[row.recipient_id] = { email: row.institutional_email, items: [] };
    }
    grouped[row.recipient_id].items.push(row);
  }

  for (const [recipientId, group] of Object.entries(grouped)) {
    const lines = group.items.map((item: any) => {
      const payload = JSON.stringify(item.payload);
      return `- ${item.type} (${item.created_at}): ${payload}`;
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: group.email,
      subject: 'Your UniQuery digest',
      text: `You have ${group.items.length} unread notifications:\n\n${lines.join('\n')}`,
    });

    const ids = group.items.map((item: any) => item.id);
    await pool.query(
      `UPDATE notifications
       SET delivery_channel = 'EMAIL'
       WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    console.log(`Digest sent to ${group.email} (${recipientId})`);
  }
};
