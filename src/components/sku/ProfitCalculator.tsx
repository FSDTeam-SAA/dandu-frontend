import { useState } from 'react';
import { Info, TrendingUp } from 'lucide-react';
import type { SkuMetrics } from '../../lib/authApi';
import { calculateChannelMargins } from './profitCalculation';

function formatMoney(value: number | null, currency: string | null): string {
  if (value === null || !currency) return 'N/A';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency}`;
  }
}

function numericInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function ProfitCalculator({ data }: { data: SkuMetrics }) {
  const [referralPercent, setReferralPercent] = useState(15);
  const [pickFee, setPickFee] = useState(0);
  const [packFee, setPackFee] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const margins = calculateChannelMargins(data, { referralPercent, pickFee, packFee, shippingFee });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-5 text-emerald-700" />
          <h3 className="text-base font-black text-slate-900">Profit Margin Estimate</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 text-slate-500">Referral
            <input type="number" min={0} max={100} step={0.5} value={referralPercent} onChange={(event) => setReferralPercent(numericInput(event.target.value))} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600" />%
          </label>
          <label className="flex items-center gap-1.5 text-slate-500">Pick
            <input type="number" min={0} step={0.1} value={pickFee} onChange={(event) => setPickFee(numericInput(event.target.value))} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600" />
          </label>
          <label className="flex items-center gap-1.5 text-slate-500">Pack
            <input type="number" min={0} step={0.1} value={packFee} onChange={(event) => setPackFee(numericInput(event.target.value))} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600" />
          </label>
          <label className="flex items-center gap-1.5 text-slate-500">Shipping
            <input type="number" min={0} step={0.1} value={shippingFee} onChange={(event) => setShippingFee(numericInput(event.target.value))} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600" />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        {margins.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500"><Info className="size-4 shrink-0" />No active channel listings were returned.</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-b border-slate-100">{['Channel', 'Sale Price', 'COGS', 'Referral', 'Entered Fees', 'Net Profit', 'Margin', 'ROI'].map((heading) => <th key={heading} className="py-2 pr-4 text-right first:text-left text-[11px] font-black uppercase tracking-wide text-slate-400">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50">
              {margins.map((margin) => (
                <tr key={margin.id} className="align-top hover:bg-slate-50">
                  <td className="py-3 pr-4"><div className="font-semibold text-slate-900">{margin.label}</div>{!margin.available && <div className="mt-1 max-w-64 text-xs text-amber-700">{margin.reason}</div>}</td>
                  <td className="py-3 pr-4 text-right font-bold">{formatMoney(margin.price, margin.currency)}</td>
                  <td className="py-3 pr-4 text-right">{formatMoney(margin.cogs, margin.currency)}</td>
                  <td className="py-3 pr-4 text-right">{formatMoney(margin.referralFee, margin.currency)}</td>
                  <td className="py-3 pr-4 text-right">{margin.currency ? formatMoney(margin.operatingFees, margin.currency) : 'N/A'}</td>
                  <td className={`py-3 pr-4 text-right font-black ${margin.netProfit !== null && margin.netProfit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatMoney(margin.netProfit, margin.currency)}</td>
                  <td className="py-3 pr-4 text-right font-bold">{margin.marginPercent === null ? 'N/A' : `${margin.marginPercent}%`}</td>
                  <td className="py-3 text-right font-bold">{margin.roiPercent === null ? 'N/A' : `${margin.roiPercent}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 flex items-start gap-1 text-[11px] text-slate-500"><Info className="mt-0.5 size-3 shrink-0" />Calculations require real cost, price, and matching currencies. Pick, pack, and shipping are user-entered estimates in each listing currency. No automatic FBA fee is applied because the product weight unit is unknown.</p>
      </div>
    </div>
  );
}
