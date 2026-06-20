import crypto from 'crypto';
import { pool } from '../index.js';
import { emitNotificationToAdmins } from './notifications.js';

const aliasAdjectives = [
  'Anonymous',
  'Curious',
  'Silent',
  'Hidden',
  'Quiet',
  'Witty',
  'Brave',
  'Clever',
  'Swift',
  'Bright',
];

const aliasNouns = [
  'Owl',
  'Phoenix',
  'Fox',
  'Sparrow',
  'Tiger',
  'Otter',
  'Raven',
  'Hawk',
  'Dolphin',
  'Lynx',
];

// tenantSalt and masterKey are read lazily (inside functions) so that dotenv has
// already run before these values are consumed. Reading them at module load time
// causes a crash in ESM because static imports are resolved before dotenv.config()
// executes in index.ts.

const decodeKey = (value: string) => {
  if (!value) {
    throw new Error('ANONYMITY_MASTER_KEY is required');
  }
  const trimmed = value.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  return Buffer.from(trimmed, 'base64');
};

const getTenantSalt = () => process.env.ANONYMITY_TENANT_SALT || '';
const getMasterKey = () => decodeKey(process.env.ANONYMITY_MASTER_KEY || '');

const aesEncrypt = (key: Buffer, plaintext: Buffer) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
};

const aesDecrypt = (key: Buffer, payload: Buffer) => {
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

const hashUserId = (userId: string) => {
  return crypto
    .createHash('sha256')
    .update(`${userId}${getTenantSalt()}`)
    .digest('hex');
};

export const generateAlias = async (userId: string, courseId: string) => {
  const hash = crypto.createHash('sha256').update(`${userId}:${courseId}`).digest();
  const adj = aliasAdjectives[hash[0] % aliasAdjectives.length];
  const noun = aliasNouns[hash[1] % aliasNouns.length];
  let alias = `${adj} ${noun}`;

  const existing = await pool.query(
    'SELECT pseudonymous_alias FROM enrollments WHERE course_id = $1',
    [courseId]
  );
  const existingSet = new Set(existing.rows.map((row) => row.pseudonymous_alias));

  let suffix = 1;
  while (existingSet.has(alias)) {
    suffix += 1;
    alias = `${adj} ${noun} ${suffix}`;
  }

  return alias;
};

export const encryptIdentity = async (
  userId: string,
  targetType: 'QUESTION' | 'ANSWER',
  targetId: string
) => {
  const dek = crypto.randomBytes(32);
  const encryptedUserId = aesEncrypt(dek, Buffer.from(userId, 'utf8'));
  const wrappedDek = aesEncrypt(getMasterKey(), dek);
  const dataKeyId = `local:${wrappedDek.toString('base64')}`;
  const hashedUserId = hashUserId(userId);

  await pool.query(
    `INSERT INTO identity_markers (target_type, target_id, encrypted_user_id, data_key_id, hashed_user_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [targetType, targetId, encryptedUserId, dataKeyId, hashedUserId]
  );
};

export const decryptIdentity = async (
  markerId: string,
  actorId: string,
  actorRole: string
) => {
  if (!['FACULTY', 'ADMIN'].includes(actorRole)) {
    await pool.query(
      `INSERT INTO moderation_audit_log (actor_id, action, target_type, target_id, justification)
       VALUES ($1, 'DECRYPT_IDENTITY_DENIED', 'IDENTITY_MARKER', $2, 'Role not permitted')`,
      [actorId, markerId]
    );
    throw new Error('Role not permitted');
  }

  await pool.query(
    `INSERT INTO moderation_audit_log (actor_id, action, target_type, target_id)
     VALUES ($1, 'DECRYPT_IDENTITY', 'IDENTITY_MARKER', $2)`,
    [actorId, markerId]
  );

  const result = await pool.query(
    'SELECT encrypted_user_id, data_key_id FROM identity_markers WHERE id = $1',
    [markerId]
  );

  if (result.rows.length === 0) {
    throw new Error('Identity marker not found');
  }

  const row = result.rows[0];
  const dataKeyId = row.data_key_id as string;
  if (!dataKeyId.startsWith('local:')) {
    throw new Error('Unsupported data key format');
  }

  const wrappedDek = Buffer.from(dataKeyId.replace('local:', ''), 'base64');
  const dek = aesDecrypt(getMasterKey(), wrappedDek);
  const decrypted = aesDecrypt(dek, row.encrypted_user_id);
  const userId = decrypted.toString('utf8');

  await decryptThresholdCheck(actorId);

  return userId;
};

export const decryptThresholdCheck = async (actorId: string) => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM moderation_audit_log
     WHERE actor_id = $1
       AND action = 'DECRYPT_IDENTITY'
       AND created_at > now() - interval '24 hours'`,
    [actorId]
  );

  if ((result.rows[0]?.total || 0) > 3) {
    await emitNotificationToAdmins('DECRYPT_THRESHOLD', { actorId });
  }
};
