import assert from 'node:assert/strict';
import test from 'node:test';
import { authApi, type SkuMetrics } from '../src/lib/authApi.ts';

function sku(value: string): SkuMetrics {
  return { sku: value, product: null, stock: [], channels: [], salesMetrics: [] };
}

function apiResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, message: 'Success', data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('loads every SKU cursor before returning dashboard input', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const requestedCursors: Array<string | null> = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const cursor = url.searchParams.get('cursor');
    requestedCursors.push(cursor);
    return cursor === null
      ? apiResponse({ items: [sku('SKU-1')], nextCursor: 'page-2', total: 2 })
      : apiResponse({ items: [sku('SKU-2')], nextCursor: null, total: 2 });
  };

  const result = await authApi.browseAllSkus('token');
  assert.deepEqual(result.map((item) => item.sku), ['SKU-1', 'SKU-2']);
  assert.deepEqual(requestedCursors, [null, 'page-2']);
});

test('rejects a completed cursor chain when records are missing', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => apiResponse({ items: [sku('SKU-1')], nextCursor: null, total: 2 });

  await assert.rejects(authApi.browseAllSkus('token'), /Incomplete SKU response/);
});

test('submits the existing sync route as an explicitly queued job', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let requestBody: string | null = null;
  globalThis.fetch = async (_input, init) => {
    requestBody = typeof init?.body === 'string' ? init.body : null;
    return apiResponse({ status: 'QUEUED', jobId: 'job-1' });
  };

  const result = await authApi.triggerLinnworksSync('token');
  assert.equal(requestBody, JSON.stringify({ queued: true }));
  assert.equal(result.data.jobId, 'job-1');
});
