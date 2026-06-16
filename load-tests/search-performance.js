/**
 * k6 Load Test — Search Performance (TC-IDX-02 Stub)
 * 
 * Week 10: Load testing scaffold for the UniQuery search endpoint.
 * Designed to be syntax-ready and functional the moment the staging
 * environment becomes available in Sprint 4.
 * 
 * Run locally:
 *   k6 run load-tests/search-performance.js
 * 
 * Run against staging (when available):
 *   k6 run -e BASE_URL=https://staging.uniquery.app load-tests/search-performance.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Custom Metrics ─────────────────────────────────────────────────
const searchFailureRate = new Rate('search_failures');
const searchDuration = new Trend('search_duration', true);

// ─── Test Configuration ─────────────────────────────────────────────
export const options = {
  // Start with a small pool of 10 users to test script logic locally
  vus: 10,
  duration: '30s',

  // Performance thresholds
  thresholds: {
    // 95th percentile response time must be under 2000ms
    http_req_duration: ['p(95)<2000'],
    // Search-specific duration under 1500ms
    search_duration: ['p(95)<1500'],
    // Failure rate must be under 1%
    search_failures: ['rate<0.01'],
  },
};

// ─── Test Data ──────────────────────────────────────────────────────
const searchQueries = [
  'binary search algorithm',
  'data structures',
  'machine learning',
  'database normalization',
  'operating systems',
  'computer networks',
  'software engineering',
  'calculus integration',
  'linear algebra',
  'statistics probability',
];

// ─── Base URL ───────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// ─── Main Test Function ─────────────────────────────────────────────
export default function () {
  // Pick a random search query
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  const url = `${BASE_URL}/api/v1/search?q=${encodeURIComponent(query)}&limit=20`;

  const startTime = Date.now();

  const response = http.get(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.TOKEN}`,
    },
    tags: { name: 'SearchEndpoint' },
  });

  const duration = Date.now() - startTime;
  searchDuration.add(duration);

  // ─── Assertions ─────────────────────────────────────────────────
  const checkResult = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.results !== undefined;
      } catch {
        return false;
      }
    },
    'response time < 2s': (r) => r.timings.duration < 2000,
    'response has query echo': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.query !== undefined;
      } catch {
        return false;
      }
    },
    'no author_id leak on anon rows': (r) => {
      try {
        const body = JSON.parse(r.body);
        if (!Array.isArray(body.results)) return false;
        return !body.results.some((row) => row.is_anonymous === true && row.author_id !== null);
      } catch { return false; }
    },
  });

  // Track failures
  searchFailureRate.add(!checkResult);

  // Simulate user think time (1-3 seconds between searches)
  sleep(Math.random() * 2 + 1);
}

// ─── Setup Function ─────────────────────────────────────────────────
export function setup() {
  // Verify the target is reachable before running the full test
  const healthCheck = http.get(`${BASE_URL}/health-check`);
  
  if (healthCheck.status !== 200) {
    console.warn(`⚠️  Target ${BASE_URL} may not be reachable (status: ${healthCheck.status})`);
    console.warn('   Tests will continue but may produce failures.');
  } else {
    console.log(`✅ Target ${BASE_URL} is healthy. Starting load test...`);
  }

  return { baseUrl: BASE_URL };
}

// ─── Teardown Function ──────────────────────────────────────────────
export function teardown(data) {
  console.log(`\n📊 Load test complete against ${data.baseUrl}`);
  console.log('   Review the results above for threshold violations.');
}
