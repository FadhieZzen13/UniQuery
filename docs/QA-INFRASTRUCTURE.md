# UniQuery — QA Test Infrastructure Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Test Pyramid Strategy](#test-pyramid-strategy)
3. [Running Tests Locally](#running-tests-locally)
4. [MSW Mock Server Architecture](#msw-mock-server-architecture)
5. [GitHub Actions CI Pipeline](#github-actions-ci-pipeline)
6. [Coverage Thresholds & Enforcement](#coverage-thresholds--enforcement)
7. [Requirements Traceability Matrix (RTM)](#requirements-traceability-matrix-rtm)
8. [k6 Load Testing Guide](#k6-load-testing-guide)
9. [Progress Dashboard](#progress-dashboard)

---

## Architecture Overview

```
UniQuery Test Infrastructure
├── Frontend (React + Vite + TypeScript)
│   ├── Jest + jsdom + React Testing Library
│   ├── Component rendering tests
│   └── Coverage: 80% stmt / 75% branch enforced
│
├── Backend (Express + TypeScript)
│   ├── Jest + Node + Supertest + MSW v2
│   ├── API endpoint tests via mock handlers
│   └── Coverage: 80% stmt / 75% branch enforced
│
├── Load Testing (k6)
│   └── Search performance scripts (10 VUs, 30s)
│
└── CI/CD (GitHub Actions)
    └── PR-triggered quality gate
```

### Technology Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit/Integration (Backend) | Jest + Supertest | API endpoint testing |
| Unit/Integration (Frontend) | Jest + React Testing Library | Component rendering |
| Mock Server | MSW v2 (Mock Service Worker) | HTTP request interception |
| Load Testing | k6 | Performance & stress testing |
| CI/CD | GitHub Actions | Automated quality gates |
| Test Data | @faker-js/faker | Realistic mock data generation |

---

## Test Pyramid Strategy

```
          ╱╲
         ╱  ╲          Load / Performance Tests
        ╱ k6 ╲         (Week 10 — search-performance.js)
       ╱──────╲
      ╱        ╲        Integration Tests
     ╱  MSW +   ╲       (Weeks 8-10 — auth, anonymity, Q&A)
    ╱  Supertest  ╲
   ╱──────────────╲
  ╱                ╲     Unit / Component Tests
 ╱  React Testing   ╲    (Week 7 — smoke tests, component renders)
╱    Library + Jest   ╲
╱══════════════════════╲
```

---

## Running Tests Locally

### Backend Tests

```bash
# Navigate to server directory
cd server

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (re-runs on file changes)
npm run test:watch
```

### Frontend Tests

```bash
# From project root
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Running a Specific Test File

```bash
# Backend - specific file
cd server && npx jest tests/auth/auth.test.ts --config jest.config.cjs

# Frontend - specific file
npx jest src/tests/smoke/AuthPage.test.tsx
```

---

## MSW Mock Server Architecture

### How It Works

MSW (Mock Service Worker) v2 intercepts HTTP requests at the network level. Tests make real `fetch()` calls, and MSW responds with mock data defined in handler files. This eliminates the need for a running backend.

```
Test File                    MSW Mock Server               Real Backend
   │                              │                             │
   ├─ fetch('/api/auth/login') ──►│                             │
   │                              ├─ Match handler              │
   │                              ├─ Execute mock logic          │
   │◄─────── Mock Response ───────┤                             │
   │                              │                    (NOT CALLED)
```

### Handler Files

**Location:** `server/tests/mocks/handlers.ts`

The handler file contains three sections:

1. **Auth Handlers** — Register, login, brute-force lockout, RBAC
2. **Anonymity Handlers** — Pseudonym generation, moderation access control
3. **Q&A Lifecycle Handlers** — Answer acceptance, flagging, search

### Stateful Mock Stores

The handlers maintain internal state to simulate database behavior:

| Store | Purpose | Reset Behavior |
|-------|---------|----------------|
| `loginAttempts` | Tracks failed login attempts per email | Reset after each test |
| `lockedAccounts` | Tracks locked accounts with expiry | Reset after each test |
| `anonymityMap` | Maps userId+courseId to pseudonyms | Reset after each test |
| `acceptedAnswers` | Tracks accepted answer IDs | Reset after each test |
| `flagCounters` | Tracks flag count per question | Reset after each test |
| `hiddenPosts` | Tracks auto-hidden posts | Reset after each test |

### Setup File

**Location:** `server/tests/setup.ts`

```javascript
beforeAll(() => server.listen());    // Start intercepting
afterEach(() => {
  server.resetHandlers();            // Clear handler overrides
  resetMockState();                  // Clear stateful stores
  resetAnonymityMap();               // Clear pseudonym map
});
afterAll(() => server.close());      // Stop intercepting
```

---

## GitHub Actions CI Pipeline

### Workflow File

**Location:** `.github/workflows/test.yml`

### Pipeline Architecture

```
Pull Request Created/Updated
         │
         ├─────────────────────┐
         ▼                     ▼
  Backend Tests          Frontend Tests
  (server/ dir)          (root dir)
         │                     │
         ├─ npm ci             ├─ npm ci
         ├─ npm run            ├─ npm run
         │  test:coverage      │  test:coverage
         │                     │
         ▼                     ▼
  Coverage Check         Coverage Check
  (80/75/80/80)          (80/75/80/80)
         │                     │
         └──────────┬──────────┘
                    ▼
            Quality Gate ✅
            (All checks pass)
```

### Trigger

The pipeline runs on every `pull_request` event. If any test fails or coverage drops below thresholds, the PR is blocked.

---

## Coverage Thresholds & Enforcement

### Thresholds (from SDD NFRs)

| Metric | Threshold | Enforced In |
|--------|-----------|-------------|
| Statements | 80% | jest.config.cjs (both) |
| Branches | 75% | jest.config.cjs (both) |
| Functions | 80% | jest.config.cjs (both) |
| Lines | 80% | jest.config.cjs (both) |

### How Enforcement Works

1. The `coverageThreshold` field in `jest.config.cjs` causes Jest to exit with a non-zero code if thresholds are not met.
2. GitHub Actions runs `npm run test:coverage`, which invokes Jest with `--coverage`.
3. If Jest exits non-zero, the GitHub Actions step fails, blocking the PR.

### Excluded Files

**Backend:**
- `src/**/index.ts` — Server entry point with side effects
- `*.d.ts` — Type declaration files

**Frontend:**
- `src/main.tsx` — Application entry point
- `src/vite-env.d.ts` — Vite type declarations
- `src/tests/**/*` — Test files themselves
- `src/components/ui/**/*` — ShadCN UI primitives (third-party)

---

## Requirements Traceability Matrix (RTM)

### Auth Test Suite (TC-AUTH)

| Test Case | Description | Status | File |
|-----------|-------------|--------|------|
| TC-AUTH-01 | SAML2 SSO assertion verification | 📋 TODO | `tests/auth/auth.test.ts` |
| TC-AUTH-02 | Token schema validation (JWT decode) | ✅ PASS | `tests/auth/auth.test.ts` |
| TC-AUTH-03 | Session token expiry after 7 days | 📋 TODO | `tests/auth/auth.test.ts` |
| TC-AUTH-04 | Password bcrypt hash verification | 📋 TODO | `tests/auth/auth.test.ts` |
| TC-AUTH-05 | Brute-force lockout (5 attempts → 423) | ✅ PASS | `tests/auth/auth.test.ts` |
| TC-AUTH-06 | RBAC — STUDENT cannot PATCH users (403) | ✅ PASS | `tests/auth/auth.test.ts` |

### Anonymity Engine Test Suite (TC-ANON)

| Test Case | Description | Status | File |
|-----------|-------------|--------|------|
| TC-ANON-01 | KMS integration verification | 📋 TODO | `tests/anonymity/anonymity.test.ts` |
| TC-ANON-02 | Cross-course alias isolation | ✅ PASS | `tests/anonymity/anonymity.test.ts` |
| TC-ANON-03 | Moderator de-anonymization flow | 📋 TODO | `tests/anonymity/anonymity.test.ts` |
| TC-ANON-04 | Leak prevention (student → 403) | ✅ PASS | `tests/anonymity/anonymity.test.ts` |
| TC-ANON-05 | Anonymity toggle persistence | 📋 TODO | `tests/anonymity/anonymity.test.ts` |

### Q&A Lifecycle Test Suite (TC-QA)

| Test Case | Description | Status | File |
|-----------|-------------|--------|------|
| TC-QA-01 | Question creation flow | ✅ PASS | `tests/qa/qa-lifecycle.test.ts` |
| TC-QA-02 | Answer submission and voting | 📋 TODO | `tests/qa/qa-lifecycle.test.ts` |
| TC-QA-03 | Duplicate answer acceptance (409) | ✅ PASS | `tests/qa/qa-lifecycle.test.ts` |
| TC-QA-04 | Auto-hide on flag threshold | ✅ PASS | `tests/qa/qa-lifecycle.test.ts` |
| TC-QA-05 | Search endpoint response | ✅ PASS | `tests/qa/qa-lifecycle.test.ts` |
| TC-QA-06 | Question edit by author | 📋 TODO | `tests/qa/qa-lifecycle.test.ts` |
| TC-QA-07 | Answer edit by author | 📋 TODO | `tests/qa/qa-lifecycle.test.ts` |
| TC-QA-08 | Question deletion cascade | 📋 TODO | `tests/qa/qa-lifecycle.test.ts` |
| TC-QA-09 | Vote toggle (upvote/downvote/remove) | 📋 TODO | `tests/qa/qa-lifecycle.test.ts` |
| TC-QA-10 | Reputation calculation accuracy | 📋 TODO | `tests/qa/qa-lifecycle.test.ts` |
| TC-QA-11 | Pagination and sorting verification | 📋 TODO | `tests/qa/qa-lifecycle.test.ts` |

### Performance Test Suite (TC-IDX)

| Test Case | Description | Status | File |
|-----------|-------------|--------|------|
| TC-IDX-02 | Search performance under load | 🔧 SCAFFOLD | `load-tests/search-performance.js` |

### Smoke Tests

| Test | Description | Status | File |
|------|-------------|--------|------|
| Health Check | GET /health-check returns 200 | ✅ PASS | `tests/smoke/health.test.ts` |
| AuthPage Render | Login form renders correctly | ✅ PASS | `src/tests/smoke/AuthPage.test.tsx` |

---

## k6 Load Testing Guide

### Installation

See `load-tests/README.md` for platform-specific installation instructions.

### Running Locally

```bash
# Against local dev server (must be running on port 4000)
k6 run load-tests/search-performance.js

# Against staging
k6 run -e BASE_URL=https://staging.uniquery.app load-tests/search-performance.js
```

### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| VUs | 10 | Number of virtual concurrent users |
| Duration | 30s | Test duration |
| p(95) response time | < 2000ms | 95th percentile threshold |
| Failure rate | < 1% | Maximum acceptable error rate |

---

## Progress Dashboard

### Current Status (End of Week 10 Scaffold)

| Week | Cumulative RTM Code Written | Infrastructure Status | Target Code Coverage |
|------|---------------------------|----------------------|---------------------|
| **Week 7** | 0 / 39 cases (Infrastructure) | ✅ GitHub Actions CI Active | 80% Stmt / 75% Branch Enforced |
| **Week 8** | 6 / 39 cases (Auth) | ✅ MSW Mock Integration | ≥ 90% on Auth stubs |
| **Week 9** | 11 / 39 cases (Anonymity) | ✅ KMS Mock Integration | 100% Student Block Verification |
| **Week 10** | 26 / 39 cases (Core/Search) | ✅ k6 Local Runner Ready | ≥ 85% on Q&A/Search stubs |

### Test Execution Summary

```
Backend:  26 passed | 13 todo | 39 total | 4 suites ✅
Frontend:  7 passed |  0 todo |  7 total | 1 suite  ✅
──────────────────────────────────────────────────────
Total:    33 passed | 13 todo | 46 total | 5 suites
```

---

## Directory Structure

```
campus-connect-main/
├── .github/
│   └── workflows/
│       └── test.yml              # CI pipeline definition
├── load-tests/
│   ├── search-performance.js     # k6 load test script
│   └── README.md                 # k6 installation & usage
├── server/
│   ├── jest.config.cjs           # Backend Jest configuration
│   └── tests/
│       ├── setup.ts              # MSW server lifecycle management
│       ├── app.ts                # Testable Express app factory
│       ├── mocks/
│       │   ├── handlers.ts       # All MSW request handlers
│       │   └── server.ts         # MSW server instance
│       ├── smoke/
│       │   └── health.test.ts    # Health check smoke test
│       ├── auth/
│       │   └── auth.test.ts      # TC-AUTH-01 to TC-AUTH-06
│       ├── anonymity/
│       │   └── anonymity.test.ts # TC-ANON-01 to TC-ANON-05
│       └── qa/
│           └── qa-lifecycle.test.ts  # TC-QA-01 to TC-QA-11
├── src/
│   └── tests/
│       ├── setup.ts              # Frontend Jest setup (jest-dom)
│       ├── __mocks__/
│       │   └── fileMock.js       # Static asset mock
│       └── smoke/
│           └── AuthPage.test.tsx # AuthPage component smoke test
├── jest.config.cjs               # Frontend Jest configuration
└── docs/
    └── QA-INFRASTRUCTURE.md      # This file
```
