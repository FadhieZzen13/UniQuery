/**
 * Runs before test modules load so src code that reads process.env at import time
 * (e.g. services/anonymity.ts, middleware/auth.ts) sees stable test values.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'unit-test-jwt-secret-key-min-32-chars!';
process.env.ANONYMITY_MASTER_KEY = 'a'.repeat(64);
process.env.ANONYMITY_TENANT_SALT = 'unit-test-tenant-salt';
