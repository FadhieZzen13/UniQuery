/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // Use Node.js test environment for backend API tests
  testEnvironment: 'node',

  // Transform TypeScript AND JavaScript (including .mjs) files
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          target: 'ES2020',
          esModuleInterop: true,
          allowJs: true,
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
    '^.+\\.mjs$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          target: 'ES2020',
          esModuleInterop: true,
          allowJs: true,
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
  },

  // Transform all node_modules (MSW v2 and deps are ESM-only)
  transformIgnorePatterns: [],

  // Global test setup — initializes the MSW mock server
  setupFilesAfterEnv: ['./tests/setup.ts'],

  // Map .js imports to their .ts sources (ESM → CJS compatibility)
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Collect coverage from source files only
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
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
  testMatch: ['<rootDir>/tests/**/*.test.ts'],

  // Verbose output for clear test reporting
  verbose: true,
};
