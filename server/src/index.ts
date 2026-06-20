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
  // Fail fast instead of hanging the whole serverless invocation (which surfaces as
  // an opaque 504 FUNCTION_INVOCATION_TIMEOUT). If the DB is unreachable, surface the
  // real error within a few seconds so /api/healthz can report db.error.
  connectionTimeoutMillis: 8000,
});

// Which env var actually supplied the connection string, and the host/port it points
// at. Exposed via /api/healthz (host/port only — never user or password) so a misrouted
// connection is visible without log access. The classic failure: APPLICATION_DATABASE_URL
// is set to the IPv6-only direct host (db.<ref>.supabase.co), silently overrides
// DATABASE_URL, and hangs Vercel's IPv4-only serverless egress into a 504. Seeing the
// pooler host here (…pooler.supabase.com) confirms the connection is routed correctly.
function describeConnection(): { source: string; host: string | null; port: string | null } {
  let source = 'none';
  if (process.env.NODE_ENV === 'test' && process.env.APPLICATION_DATABASE_URL_TEST) {
    source = 'APPLICATION_DATABASE_URL_TEST';
  } else if (process.env.APPLICATION_DATABASE_URL) {
    source = 'APPLICATION_DATABASE_URL';
  } else if (process.env.DATABASE_URL) {
    source = 'DATABASE_URL';
  }
  let host: string | null = null;
  let port: string | null = null;
  if (connectionString) {
    try {
      const u = new URL(connectionString);
      host = u.hostname;
      port = u.port || '5432';
    } catch {
      host = 'unparseable';
    }
  }
  return { source, host, port };
}

export const connectionInfo = describeConnection();

// Bootstrap only when run as the server entrypoint. Importing this module from routes
// (for the exported pool) or from the Vercel serverless handler must not bind a port.
// Avoid import.meta here — Jest compiles tests to CommonJS and cannot parse it.
function isServerEntrypoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return /(?:^|[/\\])index\.(?:ts|js)$/.test(entry);
}

if (isServerEntrypoint() && process.env.NODE_ENV !== 'test') {
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
