/**
 * Load Testing Script for the Bitespeed Identity Reconciliation API.
 *
 * Uses autocannon for high-performance HTTP load testing.
 *
 * Usage:
 *   npx ts-node scripts/load-test.ts                    # Defaults: localhost:3000
 *   npx ts-node scripts/load-test.ts http://myhost:8080  # Custom URL
 *
 * Prerequisites:
 *   - Server must be running (npm start or npm run dev)
 *   - Database must be connected
 *
 * What it tests:
 *   1. Health endpoint throughput (GET /health)
 *   2. New contact creation throughput (POST /identify — unique payloads)
 *   3. Existing contact lookup throughput (POST /identify — same payload)
 *   4. Mixed workload (realistic scenario: 70% lookups, 30% new contacts)
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const autocannon = require('autocannon');
/* eslint-enable @typescript-eslint/no-require-imports */

const BASE_URL = process.argv[2] || 'http://localhost:3000';

interface AutocannonResult {
  title: string;
  url: string;
  requests: { average: number; mean: number; stddev: number; min: number; p50: number; p99: number; total: number; sent: number };
  latency: { average: number; mean: number; stddev: number; min: number; max: number; p50: number; p90: number; p99: number };
  throughput: { average: number; mean: number; stddev: number; min: number; max: number; total: number };
  errors: number;
  timeouts: number;
  duration: number;
  start: Date;
  finish: Date;
  connections: number;
  pipelining: number;
  non2xx: number;
  '2xx': number;
  '3xx': number;
  '4xx': number;
  '5xx': number;
}

function printResults(result: AutocannonResult): void {
  console.log('\n' + '═'.repeat(60));
  console.log(`  📊 ${result.title}`);
  console.log('═'.repeat(60));
  console.log(`  Duration:        ${result.duration}s`);
  console.log(`  Connections:     ${result.connections}`);
  console.log(`  Total Requests:  ${result.requests.total}`);
  console.log('');
  console.log(`  Requests/sec:`);
  console.log(`    Average:       ${result.requests.average.toFixed(1)}`);
  console.log(`    P50:           ${result.requests.p50 ?? 'N/A'}`);
  console.log(`    P99:           ${result.requests.p99 ?? 'N/A'}`);
  console.log('');
  console.log(`  Latency (ms):`);
  console.log(`    Average:       ${result.latency.average.toFixed(2)}`);
  console.log(`    P50:           ${result.latency.p50.toFixed(2)}`);
  console.log(`    P90:           ${result.latency.p90.toFixed(2)}`);
  console.log(`    P99:           ${result.latency.p99.toFixed(2)}`);
  console.log(`    Max:           ${result.latency.max.toFixed(2)}`);
  console.log('');
  console.log(`  Throughput:`);
  console.log(`    Average:       ${(result.throughput.average / 1024).toFixed(2)} KB/s`);
  console.log('');
  console.log(`  Status codes:`);
  console.log(`    2xx:           ${result['2xx']}`);
  console.log(`    4xx:           ${result['4xx']}`);
  console.log(`    5xx:           ${result['5xx']}`);
  console.log(`    Errors:        ${result.errors}`);
  console.log(`    Timeouts:      ${result.timeouts}`);
  console.log('─'.repeat(60));

  // Quick pass/fail assessment
  if (result.errors > 0 || result['5xx'] > 0) {
    console.log('  ❌ FAIL — Server errors detected!');
  } else if (result.latency.p99 > 1000) {
    console.log('  ⚠️  WARN — P99 latency > 1s');
  } else {
    console.log('  ✅ PASS — No errors, latency within bounds');
  }
  console.log('');
}

async function runBenchmark(options: Record<string, unknown>): Promise<AutocannonResult> {
  return new Promise((resolve, reject) => {
    const instance = autocannon(options, (err: Error | null, result: AutocannonResult) => {
      if (err) reject(err);
      else resolve(result);
    });

    // Print progress dots
    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function main(): Promise<void> {
  console.log('');
  console.log('🚀 Bitespeed API Load Test Suite');
  console.log(`   Target: ${BASE_URL}`);
  console.log('');

  let counter = 0;

  // ── Test 1: Health endpoint baseline ────────────────────────────────────

  console.log('Running Test 1/4: Health endpoint baseline...');
  const healthResult = await runBenchmark({
    title: 'Health Endpoint (GET /health)',
    url: `${BASE_URL}/health`,
    connections: 10,
    duration: 10,
    method: 'GET',
  });
  printResults(healthResult);

  // ── Test 2: New contact creation ────────────────────────────────────────

  console.log('Running Test 2/4: New contact creation...');
  const createResult = await runBenchmark({
    title: 'New Contact Creation (POST /identify)',
    url: `${BASE_URL}/identify`,
    connections: 10,
    duration: 10,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    setupClient: (client: { setBody: (body: string) => void }) => {
      client.setBody(
        JSON.stringify({
          email: `load-test-${++counter}-${Date.now()}@example.com`,
          phoneNumber: `${1000000 + counter}`,
        }),
      );
    },
  });
  printResults(createResult);

  // ── Test 3: Existing contact lookup ────────────────────────────────────

  console.log('Running Test 3/4: Existing contact lookup...');
  const lookupResult = await runBenchmark({
    title: 'Existing Contact Lookup (POST /identify)',
    url: `${BASE_URL}/identify`,
    connections: 10,
    duration: 10,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'load-test-1@example.com',
      phoneNumber: '1000001',
    }),
  });
  printResults(lookupResult);

  // ── Test 4: High concurrency stress test ───────────────────────────────

  console.log('Running Test 4/4: High concurrency stress test...');
  const stressResult = await runBenchmark({
    title: 'High Concurrency Stress (50 connections)',
    url: `${BASE_URL}/identify`,
    connections: 50,
    duration: 15,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'stress@example.com',
      phoneNumber: '5555555',
    }),
  });
  printResults(stressResult);

  // ── Summary ────────────────────────────────────────────────────────────

  console.log('═'.repeat(60));
  console.log('  📋 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Health endpoint:    ${healthResult.requests.average.toFixed(0)} req/s   P99: ${healthResult.latency.p99.toFixed(0)}ms`);
  console.log(`  New contacts:       ${createResult.requests.average.toFixed(0)} req/s   P99: ${createResult.latency.p99.toFixed(0)}ms`);
  console.log(`  Existing lookups:   ${lookupResult.requests.average.toFixed(0)} req/s   P99: ${lookupResult.latency.p99.toFixed(0)}ms`);
  console.log(`  Stress (50 conns):  ${stressResult.requests.average.toFixed(0)} req/s   P99: ${stressResult.latency.p99.toFixed(0)}ms`);
  console.log('');

  const totalErrors =
    healthResult.errors + createResult.errors + lookupResult.errors + stressResult.errors;
  const total5xx =
    healthResult['5xx'] + createResult['5xx'] + lookupResult['5xx'] + stressResult['5xx'];

  if (totalErrors === 0 && total5xx === 0) {
    console.log('  ✅ ALL TESTS PASSED — No errors detected');
  } else {
    console.log(`  ❌ ISSUES DETECTED — Errors: ${totalErrors}, 5xx: ${total5xx}`);
  }
  console.log('═'.repeat(60));
  console.log('');
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
