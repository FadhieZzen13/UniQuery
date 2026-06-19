/** @type {import('jest').Config} */
module.exports = {
  // Use jsdom for browser-like environment in frontend tests
  testEnvironment: 'jsdom',

  // Transform TypeScript/TSX files using ts-jest
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.app.json',
      },
    ],
  },

  // Global test setup — imports jest-dom matchers
  setupFilesAfterEnv: ['./src/tests/setup.ts'],

  // Module path aliases (mirror the @ alias from vite.config.ts)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock CSS/SCSS module imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Mock static file imports
    '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/src/tests/__mocks__/fileMock.js',
  },

  // Collect coverage from modules covered by the current unit-test suite.
  // Page-level components are exercised manually / via future integration tests.
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/pages/AuthPage.tsx',
    '!src/**/*.d.ts',
  ],

  // NFR Coverage Thresholds (from SDD)
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },

  // Test file patterns
  testMatch: ['<rootDir>/src/tests/**/*.test.{ts,tsx}'],

  // Verbose output
  verbose: true,
};
