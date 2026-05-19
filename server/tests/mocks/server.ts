/**
 * MSW Mock Server Instance
 * 
 * This is the server-side MSW setup used in Node.js tests (supertest).
 * It intercepts outgoing HTTP requests and responds with mock data
 * defined in handlers.ts.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

// Create the mock server with all handlers
export const server = setupServer(...handlers);
