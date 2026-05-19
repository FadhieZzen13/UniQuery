/**
 * Auth Test Suite — TC-AUTH-01 to TC-AUTH-06
 * 
 * Week 8: Tests written against MSW mock server handlers.
 * No real backend required.
 * 
 * Coverage:
 *   TC-AUTH-01: SAML2 SSO assertion (placeholder)
 *   TC-AUTH-02: Token schema validation (JWT decode + assert)
 *   TC-AUTH-05: Brute-force lockout after 5 failed attempts
 *   TC-AUTH-06: RBAC — STUDENT cannot PATCH user records
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { generateMockToken, MOCK_JWT_SECRET } from '../mocks/handlers.js';

const app = createApp();

// ─── Helper: make requests through the MSW-intercepted layer ───────
// We use the base URL approach with supertest
const BASE_URL = 'http://localhost:4000';

describe('TC-AUTH: Authentication Test Suite', () => {
  // ─────────────────────────────────────────────────────────────────
  // TC-AUTH-01: SAML2 SSO (Future Implementation)
  // ─────────────────────────────────────────────────────────────────
  test.todo('TC-AUTH-01: SAML2 SSO assertion verification');

  // ─────────────────────────────────────────────────────────────────
  // TC-AUTH-02: Token Schema Validation
  // ─────────────────────────────────────────────────────────────────
  describe('TC-AUTH-02: Token Schema Validation', () => {
    it('should return a valid JWT on successful registration', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@university.edu',
          password: 'securepassword123',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.token).toBeDefined();
      expect(typeof data.token).toBe('string');

      // Decode the JWT and verify its payload structure
      const decoded = jwt.verify(data.token, MOCK_JWT_SECRET) as any;

      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('role');
      expect(decoded).toHaveProperty('course_ids');
      expect(decoded.role).toBe('STUDENT');
      expect(Array.isArray(decoded.course_ids)).toBe(true);
      expect(decoded.course_ids.length).toBeGreaterThan(0);
    });

    it('should return a valid JWT on successful login with correct metadata', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'student@university.edu',
          password: 'correct-password',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBeDefined();

      // Verify JWT payload contains role and course_ids
      const decoded = jwt.verify(data.token, MOCK_JWT_SECRET) as any;

      expect(decoded.role).toBe('STUDENT');
      expect(decoded.course_ids).toEqual(
        expect.arrayContaining(['CS101', 'MATH201', 'ENG102'])
      );
      expect(decoded.userId).toBe(1);
    });

    it('should reject registration with non-edu email', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@gmail.com',
          password: 'password123',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('edu');
    });

    it('should reject registration with missing fields', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@test.edu' }),
      });

      expect(response.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-AUTH-03: Session Expiry (placeholder)
  // ─────────────────────────────────────────────────────────────────
  test.todo('TC-AUTH-03: Session token expiry after 7 days');

  // ─────────────────────────────────────────────────────────────────
  // TC-AUTH-04: Password Hashing (placeholder)
  // ─────────────────────────────────────────────────────────────────
  test.todo('TC-AUTH-04: Password stored as bcrypt hash, never plaintext');

  // ─────────────────────────────────────────────────────────────────
  // TC-AUTH-05: Brute-Force Lockout
  // ─────────────────────────────────────────────────────────────────
  describe('TC-AUTH-05: Brute-Force Security', () => {
    it('should lock account after 5 failed login attempts', async () => {
      const email = 'student@university.edu';
      const wrongPassword = 'wrong-password';

      // Make 5 failed login attempts sequentially
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: wrongPassword }),
        });

        if (i < 4) {
          // First 4 attempts should return 401 (bad creds)
          expect(response.status).toBe(401);
        } else {
          // 5th attempt triggers the lock
          expect(response.status).toBe(423);
          const data = await response.json();
          expect(data).toHaveProperty('locked_until');
          expect(new Date(data.locked_until).getTime()).toBeGreaterThan(Date.now());
        }
      }

      // 6th attempt — account should still be locked
      const lockedResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: wrongPassword }),
      });

      expect(lockedResponse.status).toBe(423);
      const lockedData = await lockedResponse.json();
      expect(lockedData).toHaveProperty('locked_until');
      expect(lockedData.error).toContain('locked');
    });

    it('should return 401 for invalid credentials before lockout threshold', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'student@university.edu',
          password: 'wrong-password',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Invalid');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-AUTH-06: Role-Based Access Control
  // ─────────────────────────────────────────────────────────────────
  describe('TC-AUTH-06: Role-Based Access Control (RBAC)', () => {
    it('should deny STUDENT from PATCHing user records with 403', async () => {
      // Generate a STUDENT token
      const studentToken = generateMockToken(1, 'STUDENT', ['CS101']);

      const response = await fetch(`${BASE_URL}/api/users/999`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ name: 'Hacked Name' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Forbidden');
    });

    it('should allow ADMIN to PATCH user records', async () => {
      const adminToken = generateMockToken(3, 'ADMIN', []);

      const response = await fetch(`${BASE_URL}/api/users/1`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      expect(response.status).toBe(200);
    });

    it('should reject requests with no authorization token', async () => {
      const response = await fetch(`${BASE_URL}/api/users/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'No Auth' }),
      });

      expect(response.status).toBe(401);
    });
  });
});
