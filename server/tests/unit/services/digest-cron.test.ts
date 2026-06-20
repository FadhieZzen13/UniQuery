const schedule = jest.fn();

jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule },
}));

jest.mock('../../../src/services/digest.js', () => ({
  sendDigestEmails: jest.fn().mockResolvedValue(undefined),
}));

import { sendDigestEmails } from '../../../src/services/digest.js';
import { startDigestCron } from '../../../src/services/digest-cron.js';

describe('digest-cron', () => {
  it('schedules daily digest job', () => {
    startDigestCron();
    expect(schedule).toHaveBeenCalledWith('0 8 * * *', expect.any(Function));
  });

  it('runs sendDigestEmails from scheduled callback', async () => {
    startDigestCron();
    const callback = schedule.mock.calls[0][1] as () => Promise<void>;
    await callback();
    expect(sendDigestEmails).toHaveBeenCalled();
  });
});
