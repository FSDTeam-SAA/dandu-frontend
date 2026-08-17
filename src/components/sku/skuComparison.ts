import type {
  SkuChannel,
  SkuMetrics,
  SkuSalesMetric,
  SkuStock,
} from '../../lib/authApi';

export const SALES_WINDOWS = [7, 30, 90, 365] as const;

export type SalesWindow = (typeof SALES_WINDOWS)[number];
export type MarketplaceKey = 'amazonUS' | 'amazonCA' | 'ebay' | 'distinctAndUnique';
export type WindowValues = Record<SalesWindow, number | null>;

export type MarketplaceIdentifier = {
  value: string;
  url: string | null;
};

export const PRIMARY_TABLE_HEADERS = [
  'Field',
  'Product',
  'Amazon US',
  'Amazon CA',
  'eBay',
  'DistinctAndUnique',
] as const;

type MarketplaceField = 'identifier' | 'fbaQty' | 'mfnStock' | 'fbaPrice' | 'price';
export type ProductFieldKey =
  | 'category'
  | 'cost'
  | 'weight'
  | 'length'
  | 'width'
  | 'height'
  | 'material'
  | 'thickness'
  | 'packQty';

export type PrimaryTableRow =
  | { label: string; kind: 'marketplace'; field: MarketplaceField }
  | { label: string; kind: 'product'; fields: readonly ProductFieldKey[] }
  | { label: string; kind: 'sales'; field: 'fba' | 'mfn' | 'channel'; windows: readonly SalesWindow[] };

export type PrimaryTableSection = {
  label: string;
  rows: readonly PrimaryTableRow[];
};

export const PRIMARY_TABLE_SECTIONS = [
  {
    label: 'Marketplace / Listing',
    rows: [{ label: 'ASIN / Listing ID', kind: 'marketplace', field: 'identifier' }],
  },
  {
    label: 'Inventory',
    rows: [
      { label: 'FBA Qty', kind: 'marketplace', field: 'fbaQty' },
      { label: 'MFN Stock', kind: 'marketplace', field: 'mfnStock' },
    ],
  },
  {
    label: 'Pricing',
    rows: [
      { label: 'FBA Price', kind: 'marketplace', field: 'fbaPrice' },
      { label: 'MFN Price / Price', kind: 'marketplace', field: 'price' },
    ],
  },
  {
    label: 'Product Information',
    rows: [
      {
        label: 'Product Overview',
        kind: 'product',
        fields: ['category', 'cost', 'material', 'packQty'],
      },
      {
        label: 'Dimensions',
        kind: 'product',
        fields: ['weight', 'length', 'width', 'height', 'thickness'],
      },
    ],
  },
  {
    label: 'FBA Sales',
    rows: [{ label: 'FBA Sales', kind: 'sales', field: 'fba', windows: SALES_WINDOWS }],
  },
  {
    label: 'MFN Sales',
    rows: [{ label: 'MFN Sales', kind: 'sales', field: 'mfn', windows: SALES_WINDOWS }],
  },
  {
    label: 'Marketplace Sales',
    rows: [{ label: 'Marketplace Sales', kind: 'sales', field: 'channel', windows: SALES_WINDOWS }],
  },
] as const satisfies readonly PrimaryTableSection[];

export type MarketplaceComparisonColumn = {
  key: MarketplaceKey;
  label: string;
  identifier: string | null;
  identifierUrl: string | null;
  identifiers: MarketplaceIdentifier[];
  fbaQty: number | null;
  mfnStock: number | null;
  fbaPrice: number | null;
  price: number | null;
  sales: {
    fba: WindowValues;
    mfn: WindowValues;
    channel: WindowValues;
  };
};

export type SkuComparison = {
  amazonUS: MarketplaceComparisonColumn;
  amazonCA: MarketplaceComparisonColumn;
  ebay: MarketplaceComparisonColumn;
  distinctAndUnique: MarketplaceComparisonColumn;
  columns: MarketplaceComparisonColumn[];
};

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCountry(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return null;
  if (['US', 'USA', 'U.S.', 'U.S.A.', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(normalized)) {
    return 'US';
  }
  if (['CA', 'CAN', 'CANADA'].includes(normalized)) return 'CA';
  if (normalized.includes('CANADA') || normalized.includes('CAFBA') || normalized.includes('CAFBM')) return 'CA';
  if (normalized.includes('UNITED STATES') || normalized.includes('USFBA') || normalized.includes('USFBM')) return 'US';
  return normalized;
}

function normalizeChannel(value: unknown): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized.includes('AMAZON')) return 'AMAZON';
  if (normalized.includes('EBAY')) return 'EBAY';
  if (
    normalized.includes('WEBSITE') ||
    normalized.includes('DANDU') ||
    normalized.includes('DISTINCT') ||
    normalized.includes('BIGCOMMERCE')
  ) {
    return 'WEBSITE';
  }
  return normalized;
}

function isLinnworksUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function cleanIdentifier(value: unknown, allowComposite = false): string | null {
  const identifier = String(value ?? '').trim();
  if (!identifier || identifier === '-' || (!allowComposite && (identifier.includes(':') || identifier.includes('|')))) return null;
  return isLinnworksUuid(identifier) ? null : identifier;
}

function uniqueValue<T>(values: T[]): T | null {
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : null;
}

function sumAvailable(rows: SkuStock[]): number | null {
  const values = rows
    .map((row) => toNumber(row.available))
    .filter((value): value is number => value !== null);

  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

function fbaStock(metrics: SkuMetrics, country: 'US' | 'CA'): number | null {
  return sumAvailable(
    metrics.stock.filter(
      (row) =>
        String(row.locationType ?? '').trim().toUpperCase() === 'FBA' &&
        normalizeCountry(row.country) === country,
    ),
  );
}

function warehouseStock(metrics: SkuMetrics): number | null {
  const warehouseRows = metrics.stock.filter(
    (row) => String(row.locationType ?? '').trim().toUpperCase() === 'WAREHOUSE',
  );
  if (warehouseRows.length > 0) return sumAvailable(warehouseRows);

  return sumAvailable(
    metrics.stock.filter(
      (row) => String(row.locationType ?? '').trim().toUpperCase() === 'FBM',
    ),
  );
}

function channelRows(metrics: SkuMetrics, channel: string, country?: 'US' | 'CA'): SkuChannel[] {
  return metrics.channels.filter((row) => {
    if (row.isActive === false || normalizeChannel(row.channel) !== channel) return false;
    return country ? normalizeCountry(row.country) === country : true;
  });
}

type IdentifierCandidate = {
  value: string;
  row: SkuChannel;
};

function uniqueIdentifiers(candidates: IdentifierCandidate[]): IdentifierCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.value)) return false;
    seen.add(candidate.value);
    return true;
  });
}

function amazonIdentifierCandidates(rows: SkuChannel[]): IdentifierCandidate[] {
  return uniqueIdentifiers(rows
    .map((row) => ({ row, value: cleanIdentifier(row.asin) }))
    .filter((candidate): candidate is { row: SkuChannel; value: string } => candidate.value !== null && /^[A-Z0-9]{10}$/i.test(candidate.value)));
}

function ebayIdentifierCandidates(rows: SkuChannel[]): IdentifierCandidate[] {
  const listingIds = rows
    .map((row) => ({ row, value: cleanIdentifier(row.listingId) }))
    .filter((candidate): candidate is { row: SkuChannel; value: string } => candidate.value !== null && /^\d+$/.test(candidate.value));

  if (listingIds.length > 0) return uniqueIdentifiers(listingIds);

  return uniqueIdentifiers(rows
    .map((row) => ({ row, value: cleanIdentifier(row.asin) }))
    .filter((candidate): candidate is { row: SkuChannel; value: string } => candidate.value !== null && /^\d+$/.test(candidate.value)));
}

function websiteIdentifierCandidates(rows: SkuChannel[]): IdentifierCandidate[] {
  const listingIds = rows
    .map((row) => ({ row, value: cleanIdentifier(row.listingId) }))
    .filter((candidate): candidate is { row: SkuChannel; value: string } => candidate.value !== null);

  if (listingIds.length > 0) return uniqueIdentifiers(listingIds);

  return uniqueIdentifiers(rows
    .map((row) => ({ row, value: cleanIdentifier(row.asin, true) }))
    .filter((candidate): candidate is { row: SkuChannel; value: string } => candidate.value !== null));
}

function identifierValues(candidates: IdentifierCandidate[]): string[] {
  return candidates.map((candidate) => candidate.value);
}

function singleIdentifier(candidates: IdentifierCandidate[]): string | null {
  return uniqueValue(identifierValues(candidates));
}

function ebayIdentifier(rows: SkuChannel[]): string | null {
  return singleIdentifier(ebayIdentifierCandidates(rows));
}

function websiteIdentifier(rows: SkuChannel[]): string | null {
  return singleIdentifier(websiteIdentifierCandidates(rows));
}

function channelPrice(rows: SkuChannel[], preferredRows: SkuChannel[] = []): number | null {
  const prices = rows
    .map((row) => toNumber(row.price))
    .filter((value): value is number => value !== null);
  const uniquePrice = uniqueValue(prices);
  if (uniquePrice !== null) return uniquePrice;

  const preferredPrices = preferredRows
    .map((row) => toNumber(row.price))
    .filter((value): value is number => value !== null);
  return uniqueValue(preferredPrices);
}

function fulfillmentPrice(rows: SkuChannel[], field: 'fbaPrice' | 'mfnPrice'): number | null {
  return uniqueValue(
    rows
      .map((row) => toNumber(row[field]))
      .filter((value): value is number => value !== null),
  );
}

function periodDays(metric: SkuSalesMetric): number | null {
  const explicitDays = toNumber(metric.periodDays ?? metric.days ?? metric.windowDays);
  if (explicitDays !== null && explicitDays > 0) return explicitDays;

  const periodLabel = String(metric.period ?? metric.window ?? metric.label ?? '').match(/\d+/);
  if (periodLabel) return Number(periodLabel[0]);

  const start = metric.periodStart == null ? Number.NaN : new Date(metric.periodStart).getTime();
  const end = metric.periodEnd == null ? Number.NaN : new Date(metric.periodEnd).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function matchesWindow(metric: SkuSalesMetric, targetDays: SalesWindow): boolean {
  const days = periodDays(metric);
  return days !== null && (days === targetDays || days + 1 === targetDays);
}

function normalizeFulfillment(value: unknown): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized.includes('FBA')) return 'FBA';
  if (normalized.includes('MFN') || normalized.includes('FBM')) return 'MFN';
  return normalized;
}

function salesByWindow(metrics: SkuMetrics, matches: (metric: SkuSalesMetric) => boolean): WindowValues {
  return Object.fromEntries(
    SALES_WINDOWS.map((days) => {
      const values = metrics.salesMetrics
        .filter((metric) => matches(metric) && matchesWindow(metric, days))
        .map((metric) => toNumber(metric.unitsSold))
        .filter((value): value is number => value !== null);

      return [days, values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null];
    }),
  ) as WindowValues;
}

function channelSales(metrics: SkuMetrics, channel: 'EBAY' | 'WEBSITE'): WindowValues {
  return salesByWindow(metrics, (metric) => normalizeChannel(metric.channel) === channel);
}

function amazonFulfillmentSales(
  metrics: SkuMetrics,
  country: 'US' | 'CA',
  fulfillmentType: 'FBA' | 'MFN',
): WindowValues {
  return salesByWindow(
    metrics,
    (metric) =>
      normalizeChannel(metric.channel) === 'AMAZON' &&
      normalizeCountry(metric.country) === country &&
      normalizeFulfillment(metric.fulfillmentType) === fulfillmentType,
  );
}

function unavailableSales(): WindowValues {
  return Object.fromEntries(SALES_WINDOWS.map((days) => [days, null])) as WindowValues;
}

function marketplaceUrl(
  marketplace: MarketplaceKey,
  identifier: string | null,
  productUrl?: string | null,
): string | null {
  if (!identifier) return null;
  if (marketplace === 'amazonUS') return `https://www.amazon.com/dp/${encodeURIComponent(identifier)}`;
  if (marketplace === 'amazonCA') return `https://www.amazon.ca/dp/${encodeURIComponent(identifier)}`;
  if (marketplace === 'ebay') return `https://www.ebay.com/itm/${encodeURIComponent(identifier)}`;
  return productUrl && /^https?:\/\//i.test(productUrl) ? productUrl : null;
}

function marketplaceIdentifiers(
  marketplace: MarketplaceKey,
  candidates: IdentifierCandidate[],
  productUrl?: string | null,
): MarketplaceIdentifier[] {
  return candidates.map((candidate) => ({
    value: candidate.value,
    url: marketplaceUrl(marketplace, candidate.value, productUrl),
  }));
}

export function buildSkuComparison(metrics: SkuMetrics): SkuComparison {
  const sharedMfnStock = warehouseStock(metrics);
  const amazonUSRows = channelRows(metrics, 'AMAZON', 'US');
  const amazonCARows = channelRows(metrics, 'AMAZON', 'CA');
  const ebayRows = channelRows(metrics, 'EBAY');
  const websiteRows = channelRows(metrics, 'WEBSITE');
  const emptySales = unavailableSales();

  const amazonUSCandidates = amazonIdentifierCandidates(amazonUSRows);
  const amazonCACandidates = amazonIdentifierCandidates(amazonCARows);
  const ebayCandidates = ebayIdentifierCandidates(ebayRows);
  const websiteCandidates = websiteIdentifierCandidates(websiteRows);
  const amazonUSIdentifier = singleIdentifier(amazonUSCandidates);
  const amazonCAIdentifier = singleIdentifier(amazonCACandidates);
  const ebayListingId = ebayIdentifier(ebayRows);
  const websiteListingId = websiteIdentifier(websiteRows);

  const amazonUS: MarketplaceComparisonColumn = {
    key: 'amazonUS',
    label: 'Amazon US',
    identifier: amazonUSIdentifier,
    identifierUrl: marketplaceUrl('amazonUS', amazonUSIdentifier),
    identifiers: marketplaceIdentifiers('amazonUS', amazonUSCandidates),
    fbaQty: fbaStock(metrics, 'US'),
    mfnStock: sharedMfnStock,
    fbaPrice: fulfillmentPrice(amazonUSRows, 'fbaPrice'),
    price: fulfillmentPrice(amazonUSRows, 'mfnPrice'),
    sales: {
      fba: amazonFulfillmentSales(metrics, 'US', 'FBA'),
      mfn: amazonFulfillmentSales(metrics, 'US', 'MFN'),
      channel: emptySales,
    },
  };

  const amazonCA: MarketplaceComparisonColumn = {
    key: 'amazonCA',
    label: 'Amazon CA',
    identifier: amazonCAIdentifier,
    identifierUrl: marketplaceUrl('amazonCA', amazonCAIdentifier),
    identifiers: marketplaceIdentifiers('amazonCA', amazonCACandidates),
    fbaQty: fbaStock(metrics, 'CA'),
    mfnStock: sharedMfnStock,
    fbaPrice: fulfillmentPrice(amazonCARows, 'fbaPrice'),
    price: fulfillmentPrice(amazonCARows, 'mfnPrice'),
    sales: {
      fba: amazonFulfillmentSales(metrics, 'CA', 'FBA'),
      mfn: amazonFulfillmentSales(metrics, 'CA', 'MFN'),
      channel: emptySales,
    },
  };

  const ebay: MarketplaceComparisonColumn = {
    key: 'ebay',
    label: 'eBay',
    identifier: ebayListingId,
    identifierUrl: marketplaceUrl('ebay', ebayListingId),
    identifiers: marketplaceIdentifiers('ebay', ebayCandidates),
    fbaQty: null,
    mfnStock: sharedMfnStock,
    fbaPrice: null,
    price: channelPrice(ebayRows, ebayCandidates.map((candidate) => candidate.row)),
    sales: { fba: emptySales, mfn: emptySales, channel: channelSales(metrics, 'EBAY') },
  };

  const distinctAndUnique: MarketplaceComparisonColumn = {
    key: 'distinctAndUnique',
    label: 'DistinctAndUnique',
    identifier: websiteListingId,
    identifierUrl: marketplaceUrl(
      'distinctAndUnique',
      websiteListingId,
      metrics.product?.productUrl,
    ),
    identifiers: marketplaceIdentifiers(
      'distinctAndUnique',
      websiteCandidates,
      metrics.product?.productUrl,
    ),
    fbaQty: null,
    mfnStock: sharedMfnStock,
    fbaPrice: null,
    price: channelPrice(websiteRows, websiteCandidates.map((candidate) => candidate.row)),
    sales: { fba: emptySales, mfn: emptySales, channel: channelSales(metrics, 'WEBSITE') },
  };

  return {
    amazonUS,
    amazonCA,
    ebay,
    distinctAndUnique,
    columns: [amazonUS, amazonCA, ebay, distinctAndUnique],
  };
}
