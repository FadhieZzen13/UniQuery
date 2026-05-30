import cron from 'node-cron';
import { sendDigestEmails } from './digest.js';

export const startDigestCron = () => {
  // Run daily at 08:00 server time
  cron.schedule('0 8 * * *', async () => {
    try {
      await sendDigestEmails();
    } catch (error) {
      console.error('Digest cron failed:', error);
    }
  });

  console.log('Digest cron scheduled (0 8 * * *)');
};
