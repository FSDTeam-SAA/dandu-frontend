import type { DashboardPeriod, SkuMetrics, SkuSalesMetric } from './authApi.ts';
import { getDateWindowDays, toFiniteNumber, toTimestamp } from './dataValues.ts';

const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  '365D': 365,
};

export type CurrencyAmount = {
  currency: string;
  amount: number;
};

export type DashboardChannelSale = {
  key: string;
  channel: string;
  country: string | null;
  label: string;
  units: number;
  revenue: CurrencyAmount[];
};

export type DashboardView = {
  channelSales: DashboardChannelSale[];
  returnedSkuCount: number;
  contributingSkuCount: number;
  latestPeriodEnd: string | null;
  latestSyncedAt: string | null;
};

type SelectedMetric = {
  sku: string;
  channel: string;
  country: string | null;
  currency: string;
  units: number | null;
  revenue: number | null;
  periodEnd: string | null;
  periodEndTimestamp: number;
};

function normalizeChannel(value: unknown): string {
  const channel = String(value ?? '').trim().toUpperCase();
  return channel || 'OTHER';
}

function normalizeCountry(value: unknown): string | null {
  const country = String(value ?? '').trim().toUpperCase();
  return country || null;
}

function normalizeCurrency(value: unknown): string {
  const currency = String(value ?? '').trim().toUpperCase();
  return currency || 'UNSPECIFIED';
}

function channelLabel(channel: string, country: string | null): string {
  const name = channel === 'EBAY'
    ? 'eBay'
    : channel === 'WEBSITE'
      ? 'DistinctAndUnique'
      : channel.charAt(0) + channel.slice(1).toLowerCase();
  return country ? `${name} ${country}` : name;
}

function metricKey(sku: string, metric: SkuSalesMetric): string {
  return [
    sku,
    normalizeChannel(metric.channel),
    normalizeCountry(metric.country) ?? '',
    normalizeCurrency(metric.currency),
  ].join('\u0000');
}

function selectLatestMetrics(items: SkuMetrics[], targetDays: number): SelectedMetric[] {
  const selected = new Map<string, SelectedMetric>();

  for (const item of items) {
    for (const metric of item.salesMetrics) {
      if (getDateWindowDays(metric) !== targetDays) continue;

      const units = toFiniteNumber(metric.unitsSold);
      const revenue = toFiniteNumber(metric.revenue);
      if (units === null && revenue === null) continue;

      const timestamp = toTimestamp(metric.periodEnd) ?? Number.NEGATIVE_INFINITY;
      const key = metricKey(item.sku, metric);
      const current = selected.get(key);
      if (current && current.periodEndTimestamp >= timestamp) continue;

      selected.set(key, {
        sku: item.sku,
        channel: normalizeChannel(metric.channel),
        country: normalizeCountry(metric.country),
        currency: normalizeCurrency(metric.currency),
        units,
        revenue,
        periodEnd: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
        periodEndTimestamp: timestamp,
      });
    }
  }

  return [...selected.values()];
}

function latestIso(values: unknown[]): string | null {
  const timestamps = values
    .map(toTimestamp)
    .filter((value): value is number => value !== null);
  return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
}

export function buildDashboardView(items: SkuMetrics[], period: DashboardPeriod): DashboardView {
  const selected = selectLatestMetrics(items, PERIOD_DAYS[period]);
  const summaries = new Map<string, {
    channel: string;
    country: string | null;
    units: number;
    revenue: Map<string, number>;
  }>();

  for (const metric of selected) {
    const key = `${metric.channel}\u0000${metric.country ?? ''}`;
    const summary = summaries.get(key) ?? {
      channel: metric.channel,
      country: metric.country,
      units: 0,
      revenue: new Map<string, number>(),
    };

    if (metric.units !== null) summary.units += metric.units;
    if (metric.revenue !== null) {
      summary.revenue.set(
        metric.currency,
        (summary.revenue.get(metric.currency) ?? 0) + metric.revenue,
      );
    }
    summaries.set(key, summary);
  }

  const channelSales = [...summaries.entries()]
    .map(([key, summary]): DashboardChannelSale => ({
      key,
      channel: summary.channel,
      country: summary.country,
      label: channelLabel(summary.channel, summary.country),
      units: summary.units,
      revenue: [...summary.revenue.entries()]
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    channelSales,
    returnedSkuCount: items.length,
    contributingSkuCount: new Set(selected.map((metric) => metric.sku)).size,
    latestPeriodEnd: latestIso(selected.map((metric) => metric.periodEnd)),
    latestSyncedAt: latestIso(items.map((item) => item.product?.lastSyncedAt)),
  };
}
