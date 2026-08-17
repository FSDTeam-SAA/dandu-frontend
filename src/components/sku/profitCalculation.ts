import type { SkuChannel, SkuMetrics } from '../../lib/authApi.ts';
import { toFiniteNumber } from '../../lib/dataValues.ts';

export type ProfitInputs = {
  referralPercent: number;
  pickFee: number;
  packFee: number;
  shippingFee: number;
};

export type ChannelMargin = {
  id: string;
  label: string;
  currency: string | null;
  price: number | null;
  cogs: number | null;
  referralFee: number | null;
  operatingFees: number;
  netProfit: number | null;
  marginPercent: number | null;
  roiPercent: number | null;
  available: boolean;
  reason: string | null;
};

function currency(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || null;
}

function channelLabel(channel: SkuChannel): string {
  const name = String(channel.channel ?? '').trim().toUpperCase();
  const country = String(channel.country ?? '').trim().toUpperCase();
  if (name === 'AMAZON') return country ? `Amazon ${country}` : 'Amazon';
  if (name === 'EBAY') return country ? `eBay ${country}` : 'eBay';
  if (name === 'WEBSITE' || name === 'DANDU') return 'DistinctAndUnique';
  return name || 'Other channel';
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateChannelMargins(metrics: SkuMetrics, inputs: ProfitInputs): ChannelMargin[] {
  const cost = toFiniteNumber(metrics.product?.cost);
  const productCurrency = currency(metrics.product?.currency);
  const operatingFees = money(inputs.pickFee + inputs.packFee + inputs.shippingFee);

  return metrics.channels
    .filter((channel) => channel.isActive !== false)
    .map((channel, index) => {
      const price = toFiniteNumber(channel.price);
      const channelCurrency = currency(channel.currency);
      const base = {
        id: [channel.channel, channel.country, channel.asin, channel.listingId, index].join(':'),
        label: channelLabel(channel),
        currency: channelCurrency,
        price,
        cogs: cost,
        operatingFees,
      };

      let reason: string | null = null;
      if (cost === null) reason = 'Product cost is unavailable.';
      else if (price === null) reason = 'Channel price is unavailable.';
      else if (!productCurrency || !channelCurrency) reason = 'Currency is unavailable.';
      else if (productCurrency !== channelCurrency) {
        reason = `Currency mismatch: cost is ${productCurrency}, price is ${channelCurrency}.`;
      }

      if (reason || price === null || cost === null) {
        return {
          ...base,
          referralFee: null,
          netProfit: null,
          marginPercent: null,
          roiPercent: null,
          available: false,
          reason,
        };
      }

      const referralFee = money((price * inputs.referralPercent) / 100);
      const netProfit = money(price - cost - referralFee - operatingFees);
      return {
        ...base,
        referralFee,
        netProfit,
        marginPercent: price > 0 ? Math.round((netProfit / price) * 1000) / 10 : null,
        roiPercent: cost > 0 ? Math.round((netProfit / cost) * 1000) / 10 : null,
        available: true,
        reason: null,
      };
    });
}
