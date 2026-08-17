import type { SkuMetrics, SkuSalesMetric } from '../../lib/authApi.ts';
import { getSalesWindowDays, toFiniteNumber, toTimestamp } from '../../lib/dataValues.ts';

export type RestockRow = {
  country: 'US' | 'CA';
  label: string;
  available: boolean;
  reason: string | null;
  fbaStock: number | null;
  dailySalesRate: number | null;
  daysOfCover: number | null;
  reorderPoint: number | null;
  suggestedOrderQty: number | null;
  urgency: 'CRITICAL' | 'LOW' | 'HEALTHY' | null;
};

function isFbaMetric(metric: SkuSalesMetric, country: 'US' | 'CA'): boolean {
  const channel = String(metric.channel ?? '').trim().toUpperCase();
  const metricCountry = String(metric.country ?? '').trim().toUpperCase();
  const fulfillment = String(metric.fulfillmentType ?? '').trim().toUpperCase();
  return channel === 'AMAZON'
    && metricCountry === country
    && fulfillment === 'FBA'
    && getSalesWindowDays(metric) === 30;
}

function latestFbaSales(metrics: SkuMetrics, country: 'US' | 'CA'): number | null {
  const matches = metrics.salesMetrics.filter((metric) => isFbaMetric(metric, country));
  const latestTimestamp = Math.max(
    ...matches.map((metric) => toTimestamp(metric.periodEnd) ?? Number.NEGATIVE_INFINITY),
  );
  const latest = matches.filter(
    (metric) => (toTimestamp(metric.periodEnd) ?? Number.NEGATIVE_INFINITY) === latestTimestamp,
  );
  const units = latest
    .map((metric) => toFiniteNumber(metric.unitsSold))
    .filter((value): value is number => value !== null);
  return units.length > 0 ? units.reduce((sum, value) => sum + value, 0) : null;
}

function fbaStock(metrics: SkuMetrics, country: 'US' | 'CA'): number | null {
  const values = metrics.stock
    .filter((stock) => (
      String(stock.locationType ?? '').trim().toUpperCase() === 'FBA'
      && String(stock.country ?? '').trim().toUpperCase() === country
    ))
    .map((stock) => toFiniteNumber(stock.available))
    .filter((value): value is number => value !== null);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

export function calculateRestockRows(
  metrics: SkuMetrics,
  leadTimeDays: number,
  targetCoverDays: number,
): RestockRow[] {
  return (['US', 'CA'] as const).map((country) => {
    const stock = fbaStock(metrics, country);
    const units30 = latestFbaSales(metrics, country);
    const label = `Amazon ${country}`;
    if (units30 === null) {
      return {
        country,
        label,
        available: false,
        reason: '30-day Amazon sales do not include explicit FBA fulfillment attribution.',
        fbaStock: stock,
        dailySalesRate: null,
        daysOfCover: null,
        reorderPoint: null,
        suggestedOrderQty: null,
        urgency: null,
      };
    }
    if (stock === null) {
      return {
        country,
        label,
        available: false,
        reason: 'FBA stock is unavailable for this country.',
        fbaStock: null,
        dailySalesRate: null,
        daysOfCover: null,
        reorderPoint: null,
        suggestedOrderQty: null,
        urgency: null,
      };
    }

    const dailySalesRate = units30 / 30;
    const daysOfCover = dailySalesRate > 0 ? Math.round(stock / dailySalesRate) : null;
    const reorderPoint = Math.ceil(leadTimeDays * dailySalesRate);
    const suggestedOrderQty = Math.max(0, Math.ceil(targetCoverDays * dailySalesRate) - stock);
    const urgency = daysOfCover === null
      ? 'HEALTHY'
      : daysOfCover <= leadTimeDays
        ? 'CRITICAL'
        : daysOfCover <= leadTimeDays * 1.5
          ? 'LOW'
          : 'HEALTHY';

    return {
      country,
      label,
      available: true,
      reason: null,
      fbaStock: stock,
      dailySalesRate: Math.round(dailySalesRate * 10) / 10,
      daysOfCover,
      reorderPoint,
      suggestedOrderQty,
      urgency,
    };
  });
}
