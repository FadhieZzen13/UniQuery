/**
 * Jest Global Setup — Backend Tests
 * 
 * This file is loaded by Jest via `setupFilesAfterEnv` in jest.config.ts.
 * It initializes the MSW mock server before any tests run, resets handlers
 * between tests, and shuts down after all tests complete.
 */

import { server } from './mocks/server.js';
import { resetMockState, resetAnonymityMap } from './mocks/handlers.js';

// Start the MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handler state and any runtime request overrides after each test
afterEach(() => {
  server.resetHandlers();
  resetMockState();
  resetAnonymityMap();
});

// Clean up after all tests are done
afterAll(() => {
  server.close();
});
