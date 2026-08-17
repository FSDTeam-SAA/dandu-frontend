import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getErrorMessage,
  normalizeDashboardMetrics,
  normalizeHistoricalSalesResult,
  normalizeInventoryRefreshResult,
  normalizePaginatedSkus,
  normalizeQueuedJobResult,
} from '../src/lib/authApi.ts';

test('extracts user-safe messages from native and response-shaped errors', () => {
  assert.equal(getErrorMessage(new Error('Network failed'), 'Fallback'), 'Network failed');
  assert.equal(
    getErrorMessage({ response: { data: { message: 'Token expired' } } }, 'Fallback'),
    'Token expired',
  );
  assert.equal(getErrorMessage(null, 'Fallback'), 'Fallback');
});

test('normalizes the checked-in backend queued response without inventing progress', () => {
  assert.deepEqual(normalizeQueuedJobResult({ jobId: '42' }, 'manual'), {
    status: 'QUEUED',
    jobId: '42',
    jobType: 'manual',
    queuedAt: null,
  });
});

test('accepts queued and completed inventory refresh results', () => {
  assert.equal(normalizeInventoryRefreshResult({ jobId: 'inventory-1' }).status, 'QUEUED');

  const completed = normalizeInventoryRefreshResult({
    status: 'COMPLETED',
    remainingSkus: [],
    remainingSkuCount: 0,
    deletedSkus: 2,
    updatedSkus: 10,
    updatedStock: 12,
    updatedListings: 4,
    refreshedAt: '2026-08-17T00:00:00.000Z',
    durationMs: 500,
  });
  assert.equal(completed.status, 'COMPLETED');
  if (completed.status === 'COMPLETED') assert.equal(completed.deletedSkus, 2);
});

test('rejects malformed inventory and historical results', () => {
  assert.throws(() => normalizeInventoryRefreshResult({ status: 'COMPLETED' }), /response/i);
  assert.throws(() => normalizeHistoricalSalesResult({ status: 'COMPLETED' }), /response/i);
});

test('preserves historical failure metadata from the deployed contract', () => {
  const result = normalizeHistoricalSalesResult({
    status: 'FAILED',
    fromDate: '2026-01-01',
    toDate: '2026-08-17',
    chunkDays: 90,
    chunksProcessed: 1,
    pagesProcessed: 2,
    ordersProcessed: 3,
    itemRowsProcessed: 4,
    metricsUpdated: 0,
    skippedItemRows: 1,
    failedRows: 1,
    clearedMetrics: 0,
    syncedAt: '2026-08-17T00:00:00.000Z',
    durationMs: 100,
    errorMessage: 'Provider failed',
    userMessage: 'Try again later',
    failedChunk: { fromDate: '2026-01-01', toDate: '2026-03-31', pageNumber: 3 },
  });
  assert.equal(result.status, 'FAILED');
  assert.equal(result.failedChunk?.pageNumber, 3);
});

test('validates paginated SKU response shape and explicit zero totals', () => {
  const page = normalizePaginatedSkus({ items: [], nextCursor: null, total: 0 });
  assert.equal(page.total, 0);
  assert.throws(() => normalizePaginatedSkus({ items: [], nextCursor: null }), /response/i);
});

test('keeps only validated stored stock distribution from dashboard aggregates', () => {
  const result = normalizeDashboardMetrics({
    salesVelocity: [{ channel: 'Amazon', fba: 999, mfn: 0 }],
    stockDistribution: [{ name: 'US Warehouse', value: 0, fill: '#000000' }],
    revenueTrend: [{ month: 'Jan', revenue: 999 }],
  });
  assert.deepEqual(result, {
    salesVelocity: [],
    stockDistribution: [{ name: 'US Warehouse', value: 0, fill: '#000000' }],
    revenueTrend: [],
  });
});
