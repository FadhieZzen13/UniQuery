/**
 * MSW Request Handlers — UniQuery Mock API
 * 
 * These handlers simulate the backend API for testing purposes.
 * They use MSW v2 syntax (http.post, http.get, etc.)
 * 
 * Sections:
 * 1. Auth handlers (Week 8: TC-AUTH-*)
 * 2. Anonymity handlers (Week 9: TC-ANON-*)
 * 3. Q&A lifecycle handlers (Week 10: TC-QA-*)
 */

import { http, HttpResponse } from 'msw';
import jwt from 'jsonwebtoken';

// ─── Constants ──────────────────────────────────────────────────────
const MOCK_JWT_SECRET = 'test-secret-key-for-unit-tests';
const BRUTE_FORCE_THRESHOLD = 5;
const FLAG_HIDE_THRESHOLD = 3;

// ─── Stateful Stores ────────────────────────────────────────────────
// These simulate database state across requests within a test suite.

/** Brute-force login attempt counter: email → attempt count */
let loginAttempts: Record<string, number> = {};

/** Locked accounts: email → locked_until ISO string */
let lockedAccounts: Record<string, string> = {};

/** Anonymity alias map: `${userId}-${courseId}` → pseudonym string */
const anonymityMap: Record<string, string> = {};

/** Animal names used for generating pseudonyms */
const ANIMAL_NAMES = [
  'Lion', 'Eagle', 'Dolphin', 'Falcon', 'Wolf', 'Panda',
  'Tiger', 'Hawk', 'Bear', 'Fox', 'Owl', 'Lynx',
  'Raven', 'Cobra', 'Bison', 'Crane', 'Otter', 'Viper',
];

/** Accepted answers set: answerId → boolean */
let acceptedAnswers: Record<string, boolean> = {};

/** Flag counters: questionId → count */
let flagCounters: Record<string, number> = {};

/** Hidden posts: questionId → boolean */
let hiddenPosts: Record<string, boolean> = {};

// ─── Helper Functions ───────────────────────────────────────────────

/**
 * Generate a mock JWT token with role and course metadata
 */
function generateMockToken(userId: number, role: string, courseIds: string[]): string {
  return jwt.sign(
    {
      userId,
      role,
      course_ids: courseIds,
      iat: Math.floor(Date.now() / 1000),
    },
    MOCK_JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Decode and verify a mock JWT token
 */
function verifyMockToken(token: string): any {
  try {
    return jwt.verify(token, MOCK_JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Extract bearer token from Authorization header
 */
function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/**
 * Generate a unique pseudonym for a userId + courseId pair
 */
function getPseudonym(userId: string, courseId: string): string {
  const key = `${userId}-${courseId}`;
  if (!anonymityMap[key]) {
    const animalIndex = Object.keys(anonymityMap).length % ANIMAL_NAMES.length;
    anonymityMap[key] = `Anonymous ${ANIMAL_NAMES[animalIndex]}`;
  }
  return anonymityMap[key];
}

/**
 * Reset all stateful stores — called between test suites
 */
export function resetMockState(): void {
  loginAttempts = {};
  lockedAccounts = {};
  // Note: anonymityMap is intentionally NOT reset to test persistence
  Object.keys(acceptedAnswers).forEach(k => delete acceptedAnswers[k]);
  Object.keys(flagCounters).forEach(k => delete flagCounters[k]);
  Object.keys(hiddenPosts).forEach(k => delete hiddenPosts[k]);
}

/**
 * Reset anonymity map — for tests that need fresh aliases
 */
export function resetAnonymityMap(): void {
  Object.keys(anonymityMap).forEach(k => delete anonymityMap[k]);
}

// ─── Mock Users Database ────────────────────────────────────────────
const mockUsers = [
  {
    id: 1,
    email: 'student@university.edu',
    password: 'correct-password',
    name: 'Test Student',
    role: 'STUDENT',
    course_ids: ['CS101', 'MATH201', 'ENG102'],
  },
  {
    id: 2,
    email: 'moderator@university.edu',
    password: 'mod-password',
    name: 'Test Moderator',
    role: 'MODERATOR',
    course_ids: ['CS101', 'CS201'],
  },
  {
    id: 3,
    email: 'admin@university.edu',
    password: 'admin-password',
    name: 'Test Admin',
    role: 'ADMIN',
    course_ids: [],
  },
];

// ═══════════════════════════════════════════════════════════════════
// 1. AUTH HANDLERS (Week 8)
// ═══════════════════════════════════════════════════════════════════

const authHandlers = [
  // POST /api/auth/register
  http.post('http://localhost:4000/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      return HttpResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if email contains "edu"
    if (!body.email.includes('edu')) {
      return HttpResponse.json(
        { error: 'Email must contain "edu".' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = mockUsers.find(u => u.email === body.email);
    if (existing) {
      return HttpResponse.json(
        { error: 'User with this email already exists.' },
        { status: 400 }
      );
    }

    // Create new user
    const newUser = {
      id: mockUsers.length + 1,
      email: body.email,
      password: body.password,
      name: '',
      role: 'STUDENT',
      course_ids: ['CS101'],
    };

    const token = generateMockToken(newUser.id, newUser.role, newUser.course_ids);

    return HttpResponse.json(
      {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          course_ids: newUser.course_ids,
          onboardingCompleted: false,
        },
      },
      { status: 201 }
    );
  }),

  // POST /api/auth/login (with brute-force protection)
  http.post('http://localhost:4000/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      return HttpResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if account is locked
    if (lockedAccounts[body.email]) {
      const lockedUntil = new Date(lockedAccounts[body.email]);
      if (lockedUntil > new Date()) {
        return HttpResponse.json(
          {
            error: 'Account temporarily locked due to too many failed attempts.',
            locked_until: lockedAccounts[body.email],
          },
          { status: 423 }
        );
      } else {
        // Lock expired
        delete lockedAccounts[body.email];
        loginAttempts[body.email] = 0;
      }
    }

    const user = mockUsers.find(u => u.email === body.email);

    if (!user || user.password !== body.password) {
      // Increment failed attempts
      loginAttempts[body.email] = (loginAttempts[body.email] || 0) + 1;

      // Check brute-force threshold
      if (loginAttempts[body.email] >= BRUTE_FORCE_THRESHOLD) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min
        lockedAccounts[body.email] = lockedUntil;

        return HttpResponse.json(
          {
            error: 'Account temporarily locked due to too many failed attempts.',
            locked_until: lockedUntil,
          },
          { status: 423 }
        );
      }

      return HttpResponse.json(
        { error: 'Invalid credentials.' },
        { status: 401 }
      );
    }

    // Successful login — reset attempts
    loginAttempts[body.email] = 0;

    const token = generateMockToken(user.id, user.role, user.course_ids);

    return HttpResponse.json(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          course_ids: user.course_ids,
          onboardingCompleted: true,
        },
      },
      { status: 200 }
    );
  }),

  // PATCH /api/users/:id (RBAC enforcement)
  http.patch('http://localhost:4000/api/users/:id', async ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return HttpResponse.json(
        { error: 'Access token required' },
        { status: 401 }
      );
    }

    const decoded = verifyMockToken(token);
    if (!decoded) {
      return HttpResponse.json(
        { error: 'Invalid or expired token' },
        { status: 403 }
      );
    }

    // RBAC: Only ADMIN can PATCH other users
    if (decoded.role === 'STUDENT') {
      return HttpResponse.json(
        { error: 'Forbidden: Students cannot modify user records.' },
        { status: 403 }
      );
    }

    return HttpResponse.json(
      { message: 'User updated successfully' },
      { status: 200 }
    );
  }),
];

// ═══════════════════════════════════════════════════════════════════
// 2. ANONYMITY HANDLERS (Week 9)
// ═══════════════════════════════════════════════════════════════════

const anonymityHandlers = [
  // POST /api/questions (with anonymity support)
  http.post('http://localhost:4000/api/questions', async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return HttpResponse.json(
        { error: 'Access token required' },
        { status: 401 }
      );
    }

    const decoded = verifyMockToken(token);
    if (!decoded) {
      return HttpResponse.json(
        { error: 'Invalid or expired token' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      title?: string;
      description?: string;
      category?: string;
      course_id?: string;
      is_anonymous?: boolean;
    };

    if (!body.title || !body.description) {
      return HttpResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    const questionId = `q-${Date.now()}`;
    let authorName = mockUsers.find(u => u.id === decoded.userId)?.name || 'Unknown';
    let authorDisplay = authorName;

    // Anonymity logic
    if (body.is_anonymous && body.course_id) {
      authorDisplay = getPseudonym(String(decoded.userId), body.course_id);
    }

    return HttpResponse.json(
      {
        id: questionId,
        title: body.title,
        description: body.description,
        category: body.category || 'General',
        course_id: body.course_id,
        author: body.is_anonymous
          ? { name: authorDisplay, is_anonymous: true }
          : { id: decoded.userId, name: authorName, is_anonymous: false },
        votes: 0,
        answerCount: 0,
        createdAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // POST /api/moderation/decrypt (role-gated)
  http.post('http://localhost:4000/api/moderation/decrypt', async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return HttpResponse.json(
        { error: 'Access token required' },
        { status: 401 }
      );
    }

    const decoded = verifyMockToken(token);
    if (!decoded) {
      return HttpResponse.json(
        { error: 'Invalid or expired token' },
        { status: 403 }
      );
    }

    // Only MODERATOR and ADMIN can decrypt
    if (decoded.role === 'STUDENT') {
      return HttpResponse.json(
        { error: 'Forbidden: Insufficient permissions to decrypt anonymous identities.' },
        { status: 403 }
      );
    }

    return HttpResponse.json(
      {
        real_author: 'Test Student',
        decrypted_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),
];

// ═══════════════════════════════════════════════════════════════════
// 3. Q&A LIFECYCLE HANDLERS (Week 10)
// ═══════════════════════════════════════════════════════════════════

const qaHandlers = [
  // POST /api/answers/:id/accept (duplicate prevention)
  http.post('http://localhost:4000/api/answers/:id/accept', async ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return HttpResponse.json(
        { error: 'Access token required' },
        { status: 401 }
      );
    }

    const decoded = verifyMockToken(token);
    if (!decoded) {
      return HttpResponse.json(
        { error: 'Invalid or expired token' },
        { status: 403 }
      );
    }

    const answerId = params.id as string;

    // Check if already accepted
    if (acceptedAnswers[answerId]) {
      return HttpResponse.json(
        { error: 'This answer has already been accepted. Cannot accept again.' },
        { status: 409 }
      );
    }

    // Mark as accepted
    acceptedAnswers[answerId] = true;

    return HttpResponse.json(
      {
        message: 'Answer accepted successfully',
        answerId,
        acceptedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // POST /api/questions/:id/flag (auto-hide on threshold)
  http.post('http://localhost:4000/api/questions/:id/flag', async ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return HttpResponse.json(
        { error: 'Access token required' },
        { status: 401 }
      );
    }

    const decoded = verifyMockToken(token);
    if (!decoded) {
      return HttpResponse.json(
        { error: 'Invalid or expired token' },
        { status: 403 }
      );
    }

    const questionId = params.id as string;

    // Already hidden?
    if (hiddenPosts[questionId]) {
      return HttpResponse.json(
        { error: 'This post is already hidden.' },
        { status: 400 }
      );
    }

    // Increment flag counter
    flagCounters[questionId] = (flagCounters[questionId] || 0) + 1;
    const currentCount = flagCounters[questionId];

    // Auto-hide if threshold reached
    if (currentCount >= FLAG_HIDE_THRESHOLD) {
      hiddenPosts[questionId] = true;
      return HttpResponse.json(
        {
          message: 'Post has been automatically hidden due to excessive flags.',
          flagCount: currentCount,
          status: 'HIDDEN',
          hiddenAt: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    return HttpResponse.json(
      {
        message: 'Flag recorded.',
        flagCount: currentCount,
        status: 'VISIBLE',
      },
      { status: 200 }
    );
  }),

  // GET /api/questions/search (echo handler for k6 + test stubs)
  http.get('http://localhost:4000/api/questions/search', async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    return HttpResponse.json(
      {
        query,
        results: [
          {
            id: 'q-1',
            title: `Result for "${query}"`,
            description: 'Mock search result',
            relevanceScore: 0.95,
          },
        ],
        total: 1,
        responseTime: Math.floor(Math.random() * 200) + 50,
      },
      { status: 200 }
    );
  }),
];

// ═══════════════════════════════════════════════════════════════════
// EXPORT ALL HANDLERS
// ═══════════════════════════════════════════════════════════════════

export const handlers = [
  ...authHandlers,
  ...anonymityHandlers,
  ...qaHandlers,
];

// Re-export helpers for use in test files
export { generateMockToken, verifyMockToken, MOCK_JWT_SECRET };
