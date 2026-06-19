// Load environment variables before any other import is evaluated.
// In ESM, imported modules run their top-level code before this file's body,
// so dotenv must be a side-effect import placed first (several modules read
// process.env at load time, e.g. services/anonymity.ts).
import 'dotenv/config';
import { Pool } from 'pg';
import { createApp } from './app.js';
import { startDigestCron } from './services/digest-cron.js';

const port = process.env.PORT || 4000;

// PostgreSQL connection.
// Runtime connects as application_role via APPLICATION_DATABASE_URL (§2.2 activation):
// unlike postgres/service_role it does NOT bypass RLS, so the identity_markers policy
// applies. DATABASE_URL (postgres-role) stays available as a fallback for migrations.
// Under NODE_ENV=test we prefer APPLICATION_DATABASE_URL_TEST so the integration suite
// targets the disposable test branch.
const connectionString =
  (process.env.NODE_ENV === 'test' && process.env.APPLICATION_DATABASE_URL_TEST) ||
  process.env.APPLICATION_DATABASE_URL ||
  process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
});

// Bootstrap only when run as the server entrypoint. Importing this module from tests
// (for the exported pool) must not connect, bind a port, or start the cron.
if (process.env.NODE_ENV !== 'test') {
  pool.query('SELECT NOW()', (err) => {
    if (err) {
      console.error('Database connection error:', err.message);
    } else {
      console.log('Database connected successfully');
    }
  });

  const app = createApp();

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  if (process.env.ENABLE_DIGEST_CRON === 'true') {
    startDigestCron();
  }
}
