import assert from 'node:assert/strict';
import test from 'node:test';
import type { SkuMetrics } from '../src/lib/authApi.ts';
import { calculateChannelMargins } from '../src/components/sku/profitCalculation.ts';
import { calculateRestockRows } from '../src/components/sku/restockCalculation.ts';

function metrics(overrides: Partial<SkuMetrics>): SkuMetrics {
  return { sku: 'SKU-1', product: null, stock: [], channels: [], salesMetrics: [], ...overrides };
}

test('calculates profit only when cost, price, and currencies are compatible', () => {
  const rows = calculateChannelMargins(metrics({
    product: { cost: 10, currency: 'USD' },
    channels: [
      { channel: 'AMAZON', country: 'US', price: 30, currency: 'USD', isActive: true },
      { channel: 'AMAZON', country: 'CA', price: 40, currency: 'CAD', isActive: true },
    ],
  }), { referralPercent: 10, pickFee: 1, packFee: 1, shippingFee: 2 });

  assert.equal(rows[0].available, true);
  assert.equal(rows[0].netProfit, 13);
  assert.equal(rows[1].available, false);
  assert.match(rows[1].reason ?? '', /Currency mismatch/);
});

test('does not treat missing product cost as zero profit input', () => {
  const [row] = calculateChannelMargins(metrics({
    product: { cost: null, currency: 'USD' },
    channels: [{ channel: 'EBAY', country: 'US', price: 20, currency: 'USD' }],
  }), { referralPercent: 15, pickFee: 0, packFee: 0, shippingFee: 0 });

  assert.equal(row.available, false);
  assert.match(row.reason ?? '', /cost/i);
});

test('returns N/A restock rows when sales have no explicit fulfillment attribution', () => {
  const [row] = calculateRestockRows(metrics({
    stock: [{ country: 'US', locationType: 'FBA', available: 20 }],
    salesMetrics: [{ channel: 'AMAZON', country: 'US', periodDays: 30, unitsSold: 30 }],
  }), 21, 60);

  assert.equal(row.available, false);
  assert.match(row.reason ?? '', /fulfillment/i);
});

test('calculates restock values from explicit 30-day FBA sales', () => {
  const [row] = calculateRestockRows(metrics({
    stock: [{ country: 'US', locationType: 'FBA', available: 30 }],
    salesMetrics: [{
      channel: 'AMAZON',
      country: 'US',
      fulfillmentType: 'FBA',
      periodDays: 30,
      periodEnd: '2026-08-17T00:00:00.000Z',
      unitsSold: 60,
    }],
  }), 21, 60);

  assert.equal(row.available, true);
  assert.equal(row.dailySalesRate, 2);
  assert.equal(row.daysOfCover, 15);
  assert.equal(row.suggestedOrderQty, 90);
});
