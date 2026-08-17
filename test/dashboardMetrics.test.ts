import assert from 'node:assert/strict';
import test from 'node:test';
import type { SkuMetrics } from '../src/lib/authApi.ts';
import { buildDashboardView } from '../src/lib/dashboardMetrics.ts';

function sku(sku: string, salesMetrics: SkuMetrics['salesMetrics'], lastSyncedAt?: string): SkuMetrics {
  return {
    sku,
    product: lastSyncedAt ? { lastSyncedAt } : null,
    stock: [],
    channels: [],
    salesMetrics,
  };
}

test('selects the requested window and keeps only the newest snapshot per SKU and market', () => {
  const view = buildDashboardView([
    sku('SKU-1', [
      {
        channel: 'AMAZON',
        country: 'US',
        periodStart: '2026-07-18T00:00:00.000Z',
        periodEnd: '2026-08-17T00:00:00.000Z',
        unitsSold: 12,
        revenue: 120,
        currency: 'USD',
      },
      {
        channel: 'AMAZON',
        country: 'US',
        periodStart: '2026-07-17T00:00:00.000Z',
        periodEnd: '2026-08-16T00:00:00.000Z',
        unitsSold: 99,
        revenue: 990,
        currency: 'USD',
      },
      {
        channel: 'AMAZON',
        country: 'US',
        periodStart: '2026-08-10T00:00:00.000Z',
        periodEnd: '2026-08-17T00:00:00.000Z',
        unitsSold: 7,
        revenue: 70,
        currency: 'USD',
      },
    ], '2026-08-17T01:00:00.000Z'),
  ], '30D');

  assert.equal(view.channelSales.length, 1);
  assert.equal(view.channelSales[0].units, 12);
  assert.deepEqual(view.channelSales[0].revenue, [{ currency: 'USD', amount: 120 }]);
  assert.equal(view.latestPeriodEnd, '2026-08-17T00:00:00.000Z');
  assert.equal(view.latestSyncedAt, '2026-08-17T01:00:00.000Z');
});

test('keeps revenue currencies separate while combining SKU totals', () => {
  const view = buildDashboardView([
    sku('SKU-1', [{
      channel: 'EBAY',
      country: 'US',
      periodStart: '2026-07-18T00:00:00.000Z',
      periodEnd: '2026-08-17T00:00:00.000Z',
      unitsSold: 2,
      revenue: 20,
      currency: 'USD',
    }]),
    sku('SKU-2', [{
      channel: 'EBAY',
      country: 'US',
      periodStart: '2026-07-18T00:00:00.000Z',
      periodEnd: '2026-08-17T00:00:00.000Z',
      unitsSold: 3,
      revenue: 30,
      currency: 'CAD',
    }]),
  ], '30D');

  assert.equal(view.channelSales[0].units, 5);
  assert.deepEqual(view.channelSales[0].revenue, [
    { currency: 'CAD', amount: 30 },
    { currency: 'USD', amount: 20 },
  ]);
});

test('preserves explicit zeroes and ignores invalid dates and numbers', () => {
  const view = buildDashboardView([
    sku('SKU-1', [
      {
        channel: 'WEBSITE',
        periodStart: '2026-07-18T00:00:00.000Z',
        periodEnd: '2026-08-17T00:00:00.000Z',
        unitsSold: 0,
        revenue: 0,
        currency: 'USD',
      },
      {
        channel: 'WEBSITE',
        periodDays: 30,
        periodStart: 'invalid',
        periodEnd: 'invalid',
        unitsSold: 500,
        revenue: 5000,
      },
    ]),
  ], '30D');

  assert.equal(view.channelSales[0].units, 0);
  assert.deepEqual(view.channelSales[0].revenue, [{ currency: 'USD', amount: 0 }]);
});
