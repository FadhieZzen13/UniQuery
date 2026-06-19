const mockQuery = jest.fn();
const sendMail = jest.fn().mockResolvedValue(undefined);

describe('digest service', () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    jest.resetModules();
    mockQuery.mockReset();
    sendMail.mockClear();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      SMTP_HOST: 'smtp.test',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      SMTP_FROM: 'noreply@test.edu',
    };

    jest.doMock('../../../src/index.js', () => ({
      pool: { query: (...args: unknown[]) => mockQuery(...args) },
    }));

    jest.doMock('nodemailer', () => ({
      __esModule: true,
      default: {
        createTransport: jest.fn(() => ({ sendMail })),
      },
    }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const { sendDigestEmails } = await import('../../../src/services/digest.js');
    await sendDigestEmails();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('sends grouped digest emails and marks notifications', async () => {
    const { sendDigestEmails } = await import('../../../src/services/digest.js');

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'n1',
            recipient_id: '00000000-0000-4000-8000-000000000001',
            type: 'NEW_REPLY',
            payload: { questionId: 'q1' },
            created_at: '2026-01-01T00:00:00Z',
            institutional_email: 'student@test.edu',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await sendDigestEmails();

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'student@test.edu',
        subject: 'Your UniQuery digest',
      })
    );
    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE notifications'),
      [['n1']]
    );
  });

  it('returns early when there are no stale notifications', async () => {
    const { sendDigestEmails } = await import('../../../src/services/digest.js');
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await sendDigestEmails();
    expect(sendMail).not.toHaveBeenCalled();
  });
});
