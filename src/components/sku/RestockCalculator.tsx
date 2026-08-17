import { useState } from 'react';
import { AlertTriangle, CheckCircle, Info, Package, ShoppingCart, Truck } from 'lucide-react';
import type { SkuMetrics } from '../../lib/authApi';
import { calculateRestockRows } from './restockCalculation';

const urgencyConfig = {
  CRITICAL: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', icon: <AlertTriangle className="size-4" />, label: 'Order Now' },
  LOW: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: <Truck className="size-4" />, label: 'Plan Reorder' },
  HEALTHY: { bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="size-4" />, label: 'Stock OK' },
};

function positiveInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

export function RestockCalculator({ data }: { data: SkuMetrics }) {
  const [leadTime, setLeadTime] = useState(21);
  const [targetCover, setTargetCover] = useState(60);
  const results = calculateRestockRows(data, leadTime, targetCover);
  const hasCritical = results.some((row) => row.available && row.urgency === 'CRITICAL');

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-emerald-700" />
          <h3 className="text-base font-black text-slate-900">Restock Calculator</h3>
          {hasCritical && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700"><AlertTriangle className="size-3" />Action Required</span>}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 text-slate-500">Lead Time
            <input type="number" min={1} max={120} value={leadTime} onChange={(event) => setLeadTime(positiveInteger(event.target.value, 1))} className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600" />days
          </label>
          <label className="flex items-center gap-1.5 text-slate-500">Target Cover
            <input type="number" min={1} max={365} value={targetCover} onChange={(event) => setTargetCover(positiveInteger(event.target.value, 1))} className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600" />days
          </label>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2">
        {results.map((row) => {
          if (!row.available || !row.urgency) {
            return (
              <div key={row.country} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between"><span className="font-bold text-slate-900">{row.label}</span><span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-black text-slate-600">N/A</span></div>
                <p className="flex items-start gap-2 text-sm text-slate-600"><Info className="mt-0.5 size-4 shrink-0" />{row.reason}</p>
                <p className="mt-3 text-xs text-slate-500">Returned FBA stock: {row.fbaStock === null ? 'N/A' : `${row.fbaStock} units`}</p>
              </div>
            );
          }

          const config = urgencyConfig[row.urgency];
          return (
            <div key={row.country} className={`rounded-xl border p-4 ${config.bg}`}>
              <div className="mb-3 flex items-center justify-between"><span className="font-bold text-slate-900">{row.label}</span><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${config.badge}`}>{config.icon}{config.label}</span></div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><div className="text-[11px] font-black uppercase text-slate-400">FBA Stock</div><div className="font-bold">{row.fbaStock} units</div></div>
                <div><div className="text-[11px] font-black uppercase text-slate-400">Daily Rate</div><div className="font-bold">{row.dailySalesRate} units/day</div></div>
                <div><div className="text-[11px] font-black uppercase text-slate-400">Days of Cover</div><div className="text-lg font-black">{row.daysOfCover === null ? 'N/A' : `${row.daysOfCover}d`}</div></div>
                <div><div className="text-[11px] font-black uppercase text-slate-400">Reorder Point</div><div className="font-bold">{row.reorderPoint} units</div></div>
              </div>
              {row.suggestedOrderQty !== null && row.suggestedOrderQty > 0 && <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2"><ShoppingCart className="size-4 shrink-0 text-slate-500" /><span className="text-sm text-slate-600">Suggested PO: <strong>{row.suggestedOrderQty} units</strong> <span className="text-slate-400">(for {targetCover}d cover)</span></span></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
