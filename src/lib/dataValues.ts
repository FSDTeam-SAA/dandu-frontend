import type { SkuSalesMetric } from './authApi.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toTimestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const timestamp = new Date(value as string | number | Date).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getDateWindowDays(metric: SkuSalesMetric): number | null {
  const start = toTimestamp(metric.periodStart);
  const end = toTimestamp(metric.periodEnd);
  if (start === null || end === null || end <= start) return null;
  return Math.round((end - start) / DAY_MS);
}

export function getSalesWindowDays(metric: SkuSalesMetric): number | null {
  const explicit = toFiniteNumber(metric.periodDays ?? metric.days ?? metric.windowDays);
  if (explicit !== null && explicit > 0) return Math.round(explicit);

  const label = String(metric.period ?? metric.window ?? metric.label ?? '').match(/\d+/);
  if (label) return Number(label[0]);

  return getDateWindowDays(metric);
}
