import type { IncomingMessage, ServerResponse } from 'node:http';

// Vercel invokes this file as a Node (req, res) function. An Express application is
// itself a (req, res) handler, so the request is handed straight to it.
//
// We deliberately do NOT use serverless-http here. That adapter targets AWS Lambda's
// (event, context) calling convention: when Vercel calls the export as (req, res),
// serverless-http treats Vercel's real `res` as the Lambda "context" and writes the
// response to an internal object instead. Vercel's `res` is never ended, so every
// request — even ones that don't touch the database — hangs until maxDuration (30s)
// and returns 504 FUNCTION_INVOCATION_TIMEOUT. Passing (req, res) to Express directly
// is the supported Vercel pattern and lets Express end the response itself.
//
// The app and its whole module chain are imported lazily so a load-time failure
// (missing dependency, bad env, import cycle) surfaces as a real 500 JSON body
// instead of an opaque FUNCTION_INVOCATION_FAILED.
type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

let appPromise: Promise<NodeHandler> | null = null;

async function getApp(): Promise<NodeHandler> {
  if (!appPromise) {
    appPromise = import('../server/src/app.js')
      .then((mod) => mod.createApp() as unknown as NodeHandler)
      .catch((error) => {
        // Don't cache the rejection — let a later invocation retry the import.
        appPromise = null;
        throw error instanceof Error ? error : new Error(String(error));
      });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    app(req, res);
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
