import 'dotenv/config';
import serverless from 'serverless-http';

// The Express app and its whole module chain are loaded lazily inside the handler.
// If any module throws at load time (missing dependency, bad env, import cycle),
// we catch it and return the real message instead of an opaque
// FUNCTION_INVOCATION_FAILED, so the cause is visible without Vercel log access.
let cachedHandler: ReturnType<typeof serverless> | null = null;
let initError: Error | null = null;

async function getHandler() {
  if (cachedHandler) return cachedHandler;
  if (initError) throw initError;
  try {
    const { createApp } = await import('../server/src/app.js');
    cachedHandler = serverless(createApp());
    return cachedHandler;
  } catch (error) {
    initError = error instanceof Error ? error : new Error(String(error));
    throw initError;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const h = await getHandler();
    return h(req, res);
  } catch (error: any) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Function initialization failed',
        message: error?.message ?? 'unknown',
        stack: String(error?.stack ?? '').split('\n').slice(0, 6),
      })
    );
  }
}
