/**
 * Q&A Lifecycle Test Suite — TC-QA-01 to TC-QA-11
 * 
 * Week 10: Core interaction scenarios including duplicate answer
 * acceptance prevention, auto-hide on flag threshold, and search.
 * 
 * Coverage:
 *   TC-QA-01: Question creation flow
 *   TC-QA-02: Answer submission flow
 *   TC-QA-03: Duplicate answer acceptance (409 Conflict)
 *   TC-QA-04: Auto-hide on flag threshold
 *   TC-QA-05: Search endpoint response
 *   TC-QA-06 to TC-QA-11: Placeholders
 */

import { generateMockToken } from '../mocks/handlers.js';

const BASE_URL = 'http://localhost:4000';

describe('TC-QA: Q&A Lifecycle Test Suite', () => {
  const studentToken = generateMockToken(1, 'STUDENT', ['CS101']);

  // ─────────────────────────────────────────────────────────────────
  // TC-QA-01: Question Creation
  // ─────────────────────────────────────────────────────────────────
  describe('TC-QA-01: Question Creation', () => {
    it('should create a question successfully with valid data', async () => {
      const response = await fetch(`${BASE_URL}/api/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          title: 'How do I implement binary search?',
          description: 'I need help understanding the algorithm step by step.',
          category: 'Academic',
          course_id: 'CS101',
          is_anonymous: false,
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.title).toBe('How do I implement binary search?');
      expect(data.votes).toBe(0);
      expect(data.answerCount).toBe(0);
    });

    it('should reject question creation without auth token', async () => {
      const response = await fetch(`${BASE_URL}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Unauthorized question',
          description: 'Should fail',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject question creation with missing required fields', async () => {
      const response = await fetch(`${BASE_URL}/api/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          title: 'Only title, no description',
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-QA-03: Duplicate Answer Acceptance Prevention
  // ─────────────────────────────────────────────────────────────────
  describe('TC-QA-03: Duplicate Answer Acceptance', () => {
    it('should accept an answer the first time', async () => {
      const response = await fetch(`${BASE_URL}/api/answers/answer-1/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toContain('accepted');
    });

    it('should return 409 Conflict when accepting an already-accepted answer', async () => {
      // First acceptance
      await fetch(`${BASE_URL}/api/answers/answer-2/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
      });

      // Second acceptance attempt (should conflict)
      const response = await fetch(`${BASE_URL}/api/answers/answer-2/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('already been accepted');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-QA-04: Auto-Hide on Flag Threshold
  // ─────────────────────────────────────────────────────────────────
  describe('TC-QA-04: Auto-Hide on Flag Threshold', () => {
    it('should increment flag count and auto-hide at threshold (3 flags)', async () => {
      const questionId = 'q-flagtest-1';

      // Flag 1
      const flag1 = await fetch(`${BASE_URL}/api/questions/${questionId}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
      });
      const flag1Data = await flag1.json();
      expect(flag1.status).toBe(200);
      expect(flag1Data.flagCount).toBe(1);
      expect(flag1Data.status).toBe('VISIBLE');

      // Flag 2
      const flag2 = await fetch(`${BASE_URL}/api/questions/${questionId}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
      });
      const flag2Data = await flag2.json();
      expect(flag2Data.flagCount).toBe(2);
      expect(flag2Data.status).toBe('VISIBLE');

      // Flag 3 — should trigger auto-hide
      const flag3 = await fetch(`${BASE_URL}/api/questions/${questionId}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
      });
      const flag3Data = await flag3.json();
      expect(flag3.status).toBe(200);
      expect(flag3Data.flagCount).toBe(3);
      expect(flag3Data.status).toBe('HIDDEN');
      expect(flag3Data.message).toContain('automatically hidden');
      expect(flag3Data).toHaveProperty('hiddenAt');
    });

    it('should return error when flagging an already-hidden post', async () => {
      const questionId = 'q-flagtest-2';

      // Flag 3 times to trigger hide
      for (let i = 0; i < 3; i++) {
        await fetch(`${BASE_URL}/api/questions/${questionId}/flag`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${studentToken}`,
          },
        });
      }

      // 4th flag on already-hidden post
      const response = await fetch(`${BASE_URL}/api/questions/${questionId}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('already hidden');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-QA-05: Search Endpoint
  // ─────────────────────────────────────────────────────────────────
  describe('TC-QA-05: Search Endpoint', () => {
    it('should return search results for a valid query', async () => {
      const response = await fetch(`${BASE_URL}/api/questions/search?q=binary+search`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('query', 'binary search');
      expect(data).toHaveProperty('results');
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results[0]).toHaveProperty('relevanceScore');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Remaining Q&A Test Cases (Placeholders for future sprints)
  // ─────────────────────────────────────────────────────────────────
  test.todo('TC-QA-02: Answer submission and voting flow');
  test.todo('TC-QA-06: Question edit by author');
  test.todo('TC-QA-07: Answer edit by author');
  test.todo('TC-QA-08: Question deletion cascade');
  test.todo('TC-QA-09: Vote toggle (upvote/downvote/remove)');
  test.todo('TC-QA-10: Reputation calculation accuracy');
  test.todo('TC-QA-11: Pagination and sorting verification');
});
