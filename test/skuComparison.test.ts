import assert from 'node:assert/strict';
import test from 'node:test';
import type { SkuMetrics } from '../src/lib/authApi.ts';
import {
  buildSkuComparison,
  PRIMARY_TABLE_HEADERS,
  PRIMARY_TABLE_SECTIONS,
  SALES_WINDOWS,
} from '../src/components/sku/skuComparison.ts';

function metrics(overrides: Partial<SkuMetrics> = {}): SkuMetrics {
  return {
    sku: '2024988',
    product: null,
    stock: [],
    channels: [],
    salesMetrics: [],
    ...overrides,
  };
}

test('preserves explicit zero stock and prefers warehouse rows for shared MFN stock', () => {
  const comparison = buildSkuComparison(
    metrics({
      stock: [
        { country: 'US', locationType: 'FBA', available: 0 },
        { country: 'US', locationType: 'WAREHOUSE', available: 0 },
        { country: 'US', locationType: 'FBM', available: 9 },
        { country: 'US', locationType: 'THIRD_PARTY', available: 20 },
      ],
    }),
  );

  assert.equal(comparison.amazonUS.fbaQty, 0);
  assert.equal(comparison.amazonCA.fbaQty, null);
  assert.deepEqual(
    comparison.columns.map((column) => column.mfnStock),
    [0, 0, 0, 0],
  );
});

test('falls back to FBM rows when no managed warehouse rows exist', () => {
  const comparison = buildSkuComparison(
    metrics({
      stock: [
        { country: 'US', locationType: 'FBM', available: 4 },
        { country: 'CA', locationType: 'FBM', available: 6 },
        { country: 'US', locationType: 'THIRD_PARTY', available: 100 },
      ],
    }),
  );

  assert.deepEqual(
    comparison.columns.map((column) => column.mfnStock),
    [10, 10, 10, 10],
  );
});

test('maps identifiers and channel prices from independent rows without inventing Amazon prices', () => {
  const comparison = buildSkuComparison(
    metrics({
      product: { productUrl: 'https://distinctandunique.com/products/du-42' },
      channels: [
        { channel: 'AMAZON', country: 'US', asin: 'B012345678', price: 29.99, isActive: true },
        { channel: 'EBAY', country: 'US', listingId: '123456789012', price: null, isActive: true },
        { channel: 'EBAY', country: 'US', listingId: 'EBAY-US', price: 19.99, isActive: true },
        { channel: 'WEBSITE', country: 'US', listingId: 'DU-42', price: 14.5, isActive: true },
      ],
    }),
  );

  assert.equal(comparison.amazonUS.identifier, 'B012345678');
  assert.equal(comparison.amazonUS.fbaPrice, null);
  assert.equal(comparison.amazonUS.price, null);
  assert.equal(comparison.ebay.identifier, '123456789012');
  assert.equal(comparison.ebay.price, 19.99);
  assert.equal(comparison.distinctAndUnique.identifier, 'DU-42');
  assert.equal(comparison.distinctAndUnique.price, 14.5);
  assert.equal(
    comparison.distinctAndUnique.identifierUrl,
    'https://distinctandunique.com/products/du-42',
  );
});

test('keeps listing data from the SKU response visible with direct marketplace links', () => {
  const comparison = buildSkuComparison(
    metrics({
      stock: [
        { country: 'US', locationType: 'FBA', available: 0 },
        { country: 'CA', locationType: 'FBA', available: 0 },
        { country: 'US', locationType: 'WAREHOUSE', available: 0 },
      ],
      channels: [
        { channel: 'AMAZON', country: 'US', asin: 'B07G7GYKYZ', price: 19.99, isActive: true },
        { channel: 'AMAZON', country: 'US', asin: 'B07DNG56PL', price: 19.99, isActive: true },
        { channel: 'AMAZON', country: 'CA', asin: 'B07DNG56PL', price: 29.99, isActive: true },
        { channel: 'AMAZON', country: 'CA', asin: 'B07CJJCHQP', price: 29.99, isActive: true },
        { channel: 'EBAY', asin: '334547009182', listingId: '9bbe8c90-4b75-43f6-ad38-96da12d54a7d', price: 24.89, isActive: true },
        { channel: 'EBAY', country: 'US', listingId: 'EBAY1_US', price: 19.99, isActive: true },
        { channel: 'WEBSITE', asin: 'ProductId:240|VariantId:2755', listingId: 'f425936b-4096-47d2-8323-36fcc77281a8', price: 29.99, isActive: true },
      ],
      salesMetrics: [
        { channel: 'EBAY', fulfillmentType: 'ALL', periodStart: '2025-08-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z', unitsSold: 3 },
        { channel: 'EBAY', fulfillmentType: 'ALL', periodStart: '2025-08-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z', unitsSold: 1 },
        { channel: 'WEBSITE', fulfillmentType: 'ALL', periodStart: '2025-08-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z', unitsSold: 1 },
      ],
    }),
  );

  assert.deepEqual(
    comparison.amazonUS.identifiers.map((identifier) => identifier.value),
    ['B07G7GYKYZ', 'B07DNG56PL'],
  );
  assert.deepEqual(
    comparison.amazonCA.identifiers.map((identifier) => identifier.url),
    [
      'https://www.amazon.ca/dp/B07DNG56PL',
      'https://www.amazon.ca/dp/B07CJJCHQP',
    ],
  );
  assert.deepEqual(comparison.ebay.identifiers, [
    { value: '334547009182', url: 'https://www.ebay.com/itm/334547009182' },
  ]);
  assert.equal(comparison.ebay.price, 24.89);
  assert.deepEqual(comparison.distinctAndUnique.identifiers, [
    { value: 'ProductId:240|VariantId:2755', url: null },
  ]);
  assert.equal(comparison.distinctAndUnique.price, 29.99);
  assert.equal(comparison.ebay.sales.channel[365], 4);
  assert.equal(comparison.distinctAndUnique.sales.channel[365], 1);
});

test('returns missing values for conflicting identifiers and prices', () => {
  const comparison = buildSkuComparison(
    metrics({
      channels: [
        { channel: 'EBAY', listingId: '111111111111', price: 10, isActive: true },
        { channel: 'EBAY', listingId: '222222222222', price: 12, isActive: true },
      ],
    }),
  );

  assert.equal(comparison.ebay.identifier, null);
  assert.equal(comparison.ebay.identifierUrl, null);
  assert.equal(comparison.ebay.price, null);
});

test('maps channel sales by window, preserves zero, and leaves Amazon fulfillment sales unavailable', () => {
  const comparison = buildSkuComparison(
    metrics({
      salesMetrics: [
        {
          channel: 'EBAY',
          country: 'US',
          periodStart: '2026-08-01T00:00:00.000Z',
          periodEnd: '2026-08-08T00:00:00.000Z',
          unitsSold: 3,
        },
        {
          channel: 'EBAY',
          country: 'CA',
          periodStart: '2026-08-01T00:00:00.000Z',
          periodEnd: '2026-08-08T00:00:00.000Z',
          unitsSold: 2,
        },
        {
          channel: 'WEBSITE',
          periodStart: '2026-08-01T00:00:00.000Z',
          periodEnd: '2026-08-08T00:00:00.000Z',
          unitsSold: 0,
        },
        {
          channel: 'AMAZON',
          country: 'US',
          periodStart: '2026-08-01T00:00:00.000Z',
          periodEnd: '2026-08-08T00:00:00.000Z',
          unitsSold: 99,
        },
      ],
    }),
  );

  assert.equal(comparison.ebay.sales.channel[7], 5);
  assert.equal(comparison.distinctAndUnique.sales.channel[7], 0);
  assert.equal(comparison.ebay.sales.channel[30], null);
  assert.equal(comparison.amazonUS.sales.fba[7], null);
  assert.equal(comparison.amazonUS.sales.mfn[7], null);
  assert.equal(comparison.amazonUS.sales.channel[7], null);
});

test('uses explicit Amazon fulfillment prices and sales when the response provides them', () => {
  const comparison = buildSkuComparison(
    metrics({
      channels: [
        {
          channel: 'AMAZON',
          country: 'US',
          asin: 'B012345678',
          fbaPrice: 0,
          mfnPrice: 18.5,
          isActive: true,
        },
      ],
      salesMetrics: [
        {
          channel: 'AMAZON',
          country: 'US',
          fulfillmentType: 'FBA',
          periodStart: '2026-08-01T00:00:00.000Z',
          periodEnd: '2026-08-08T00:00:00.000Z',
          unitsSold: 0,
        },
        {
          channel: 'AMAZON',
          country: 'US',
          fulfillmentType: 'MFN',
          periodStart: '2026-08-01T00:00:00.000Z',
          periodEnd: '2026-08-08T00:00:00.000Z',
          unitsSold: 2,
        },
      ],
    }),
  );

  assert.equal(comparison.amazonUS.fbaPrice, 0);
  assert.equal(comparison.amazonUS.price, 18.5);
  assert.equal(comparison.amazonUS.sales.fba[7], 0);
  assert.equal(comparison.amazonUS.sales.mfn[7], 2);
});

test('defines the complete client-reference SKU decision matrix', () => {
  assert.deepEqual(PRIMARY_TABLE_HEADERS, [
    'Field',
    'Product',
    'Amazon US',
    'Amazon CA',
    'eBay',
    'DistinctAndUnique',
  ]);

  assert.deepEqual(
    PRIMARY_TABLE_SECTIONS.map((section) => section.label),
    [
      'Marketplace / Listing',
      'Inventory',
      'Pricing',
      'Product Information',
      'FBA Sales',
      'MFN Sales',
      'Marketplace Sales',
    ],
  );

  const rows = PRIMARY_TABLE_SECTIONS.flatMap((section) => section.rows);
  assert.equal(rows.length, 10);
  assert.deepEqual(
    rows.map((row) => row.label),
    [
      'ASIN / Listing ID',
      'FBA Qty',
      'MFN Stock',
      'FBA Price',
      'MFN Price / Price',
      'Product Overview',
      'Dimensions',
      'FBA Sales',
      'MFN Sales',
      'Marketplace Sales',
    ],
  );

  const productRows = rows.filter((row) => row.kind === 'product');
  assert.deepEqual(
    productRows.flatMap((row) => row.fields),
    ['category', 'cost', 'material', 'packQty', 'weight', 'length', 'width', 'height', 'thickness'],
  );

  const salesRows = rows.filter((row) => row.kind === 'sales');
  assert.deepEqual(
    salesRows.flatMap((row) => row.windows),
    [...SALES_WINDOWS, ...SALES_WINDOWS, ...SALES_WINDOWS],
  );
});
