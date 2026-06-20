import crypto from 'crypto';
import { USER_ID, COURSE_ID } from '../../helpers/fixtures.js';

const mockQuery = jest.fn();

jest.mock('../../../src/index.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

jest.mock('../../../src/services/notifications.js', () => ({
  emitNotificationToAdmins: jest.fn(),
}));

import { emitNotificationToAdmins } from '../../../src/services/notifications.js';
import {
  generateAlias,
  encryptIdentity,
  decryptIdentity,
  decryptThresholdCheck,
} from '../../../src/services/anonymity.js';

describe('anonymity service', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    jest.clearAllMocks();
  });

  describe('generateAlias', () => {
    it('returns a deterministic alias for user and course', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const alias = await generateAlias(USER_ID, COURSE_ID);
      expect(alias).toMatch(/^(Anonymous|Curious|Silent|Hidden|Quiet|Witty|Brave|Clever|Swift|Bright) (Owl|Phoenix|Fox|Sparrow|Tiger|Otter|Raven|Hawk|Dolphin|Lynx)$/);
    });

    it('appends a suffix when alias already exists in course', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const baseAlias = await generateAlias(USER_ID, COURSE_ID);

      mockQuery.mockResolvedValueOnce({ rows: [{ pseudonymous_alias: baseAlias }] });
      const alias = await generateAlias(USER_ID, COURSE_ID);
      expect(alias).toBe(`${baseAlias} 2`);
    });
  });

  describe('encryptIdentity', () => {
    it('inserts an encrypted identity marker', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await encryptIdentity(USER_ID, 'QUESTION', 'question-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO identity_markers'),
        expect.arrayContaining(['QUESTION', 'question-1'])
      );
    });
  });

  describe('decryptIdentity', () => {
    it('denies students and logs audit entry', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(decryptIdentity('marker-1', USER_ID, 'STUDENT')).rejects.toThrow(
        'Role not permitted'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DECRYPT_IDENTITY_DENIED'),
        [USER_ID, 'marker-1']
      );
    });

    it('decrypts identity for faculty when marker exists', async () => {
      const dek = crypto.randomBytes(32);
      const masterKey = Buffer.from(process.env.ANONYMITY_MASTER_KEY!, 'hex');

      const encrypt = (key: Buffer, plaintext: Buffer) => {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]);
      };

      const wrappedDek = encrypt(masterKey, dek);
      const encryptedUserId = encrypt(dek, Buffer.from(USER_ID, 'utf8'));

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              encrypted_user_id: encryptedUserId,
              data_key_id: `local:${wrappedDek.toString('base64')}`,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ total: 1 }] });

      const userId = await decryptIdentity('marker-1', 'faculty-1', 'FACULTY');
      expect(userId).toBe(USER_ID);
    });

    it('throws when marker is missing', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      await expect(decryptIdentity('missing', 'faculty-1', 'FACULTY')).rejects.toThrow(
        'Identity marker not found'
      );
    });

    it('throws for unsupported data key format', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ encrypted_user_id: Buffer.from('x'), data_key_id: 'kms:abc' }],
        });

      await expect(decryptIdentity('marker-1', 'faculty-1', 'FACULTY')).rejects.toThrow(
        'Unsupported data key format'
      );
    });
  });

  describe('decryptThresholdCheck', () => {
    it('notifies admins when threshold exceeded', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 4 }] });
      await decryptThresholdCheck('faculty-1');
      expect(emitNotificationToAdmins).toHaveBeenCalledWith('DECRYPT_THRESHOLD', {
        actorId: 'faculty-1',
      });
    });

    it('does not notify admins below threshold', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
      await decryptThresholdCheck('faculty-1');
      expect(emitNotificationToAdmins).not.toHaveBeenCalled();
    });
  });
});
