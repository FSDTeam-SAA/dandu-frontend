import { useState } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { authApi, AuthSession, SkuMetrics } from '../../lib/authApi';

type UnknownRecord = Record<string, unknown>;

function formatCurrency(value: string | number | null | undefined): string {
  if (value == null) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function formatNumber(value: string | number | null | undefined): string {
  if (value == null) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return num.toLocaleString();
}

function formatWeight(value: string | number | null | undefined): string {
  if (value == null) return '-';
  const ounces = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(ounces)) return '-';

  const pounds = ounces / 16;
  const kilograms = ounces * 0.0283495;
  return `${ounces.toLocaleString(undefined, { maximumFractionDigits: 3 })} oz / ${pounds.toLocaleString(undefined, { maximumFractionDigits: 3 })} lb / ${kilograms.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg`;
}

function formatDetailValue(value: unknown): string {
  if (value == null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toLocaleString();
    }
    return value;
  }
  return JSON.stringify(value);
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function collectColumns(rows: UnknownRecord[], preferredColumns: string[]): string[] {
  const seen = new Set<string>();
  const columns: string[] = [];

  for (const key of preferredColumns) {
    if (rows.some((row) => key in row)) {
      seen.add(key);
      columns.push(key);
    }
  }

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  return columns;
}

function DetailTable({
  title,
  rows,
  preferredColumns,
}: {
  title: string;
  rows: UnknownRecord[];
  preferredColumns: string[];
}) {
  const columns = collectColumns(rows, preferredColumns);

  return (
    <section className="border-t border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</h4>
        <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm font-semibold text-slate-400">
          No data available
        </div>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-max border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="border-b border-r border-slate-200 px-3 py-2 font-black uppercase">
                    {humanizeKey(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  {columns.map((column) => (
                    <td key={column} className="max-w-72 whitespace-pre-wrap break-words border-b border-r border-slate-100 px-3 py-2 text-slate-700">
                      {formatDetailValue(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Pick the best matching salesMetrics entry for a given channel/country/period combo.
 * The mock data stores one entry per period bucket, so we match on period length in days.
 */
function getSalesForPeriod(
  metrics: SkuMetrics,
  channelName: string,
  country: string | undefined,
  targetDays: number,
): string {
  // Build a sorted list of relevant entries
  const relevant = metrics.salesMetrics.filter((m: any) => {
    if (m.channel !== channelName) return false;
    if (country && m.country !== country) return false;
    return true;
  }) as any[];

  if (!relevant.length) return '-';

  // Find the entry whose period length is closest to targetDays
  const withLen = relevant.map((m: any) => {
    const start = new Date(m.periodStart).getTime();
    const end = new Date(m.periodEnd).getTime();
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return { ...m, days };
  });

  const exact = withLen.find((m) => m.days === targetDays);
  if (exact) return exact.unitsSold > 0 ? exact.unitsSold.toLocaleString() : '-';

  // Fall back to the closest match
  const closest = withLen.reduce((prev, curr) =>
    Math.abs(curr.days - targetDays) < Math.abs(prev.days - targetDays) ? curr : prev,
  );
  return closest.unitsSold > 0 ? closest.unitsSold.toLocaleString() : '-';
}

function getChannelData(metrics: SkuMetrics, channelName: string, country?: string) {
  const channel = metrics.channels.find(
    (c: any) => c.channel === channelName && (!country || c.country === country),
  ) as any;

  const stockFBA = metrics.stock.find(
    (s: any) => s.locationType === 'FBA' && (!country || s.country === country),
  ) as any;

  const stockMFN = metrics.stock.find(
    (s: any) => s.locationType === 'MFN' && (!country || s.country === country),
  ) as any;

  return {
    asin: channel?.asin ?? '-',
    fbaQty: stockFBA?.available != null ? stockFBA.available.toLocaleString() : '-',
    mfnQty: stockMFN?.available != null ? stockMFN.available.toLocaleString() : '-',
    fbaPrice: formatCurrency(channel?.price),
    mfnPrice: formatCurrency(channel?.price),
    salesFBA7: getSalesForPeriod(metrics, channelName, country, 7),
    salesFBA30: getSalesForPeriod(metrics, channelName, country, 30),
    salesFBA90: getSalesForPeriod(metrics, channelName, country, 90),
    salesFBA365: getSalesForPeriod(metrics, channelName, country, 365),
  };
}

const ATTRIBUTE_ROWS = [
  { label: 'CATEGORY' },
  { label: 'COST' },
  { label: 'WEIGHT (oz / lb / kg)' },
  { label: 'LENGTH (in)' },
  { label: 'WIDTH (in)' },
  { label: 'HEIGHT (in)' },
  { label: 'MATERIAL' },
  { label: 'THICKNESS' },
  { label: 'PACK QTY' },
] as const;

const SALES_ROWS: { label: string; key: keyof ReturnType<typeof getChannelData> }[] = [
  { label: '7-Day Sales (units)', key: 'salesFBA7' },
  { label: '30-Day Sales (units)', key: 'salesFBA30' },
  { label: '90-Day Sales (units)', key: 'salesFBA90' },
  { label: '365-Day Sales (units)', key: 'salesFBA365' },
];

export function SkuDataTable({ data, session, onUpdate }: { data: SkuMetrics; session?: AuthSession; onUpdate?: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const product: any = data.product ?? {};

  const [editValues, setEditValues] = useState({
    cost: product.cost ?? '',
    weight: product.weight ?? '',
    length: product.dimensions?.length ?? product.length ?? '',
    width: product.dimensions?.width ?? product.width ?? '',
    height: product.dimensions?.height ?? product.height ?? '',
    material: product.material ?? '',
    thickness: product.thickness ?? '',
    packQty: product.packQty ?? '',
  });

  const handleSave = async () => {
    if (!session || !onUpdate) return;
    setIsSaving(true);
    setError('');
    try {
      await authApi.updateProduct(session.accessToken, data.sku, {
        cost: editValues.cost === '' ? null : Number(editValues.cost),
        weight: editValues.weight === '' ? null : Number(editValues.weight),
        length: editValues.length === '' ? null : Number(editValues.length),
        width: editValues.width === '' ? null : Number(editValues.width),
        height: editValues.height === '' ? null : Number(editValues.height),
        material: editValues.material === '' ? null : editValues.material,
        thickness: editValues.thickness === '' ? null : editValues.thickness,
        packQty: editValues.packQty === '' ? null : Number(editValues.packQty),
      });
      setIsEditing(false);
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update product details. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setEditValues({
      cost: product.cost ?? '',
      weight: product.weight ?? '',
      length: product.dimensions?.length ?? product.length ?? '',
      width: product.dimensions?.width ?? product.width ?? '',
      height: product.dimensions?.height ?? product.height ?? '',
      material: product.material ?? '',
      thickness: product.thickness ?? '',
      packQty: product.packQty ?? '',
    });
  };

  const channelDefs = [
    { name: 'Amazon US', ch: 'AMAZON', country: 'US' },
    { name: 'Amazon CA', ch: 'AMAZON', country: 'CA' },
    { name: 'eBay', ch: 'EBAY', country: undefined },
    { name: 'DistinctAndUnique', ch: 'WEBSITE', country: undefined },
  ];

  const channels = channelDefs.map((def) => ({
    ...def,
    data: getChannelData(data, def.ch, def.country),
  }));

  const attrValues: Record<string, string> = {
    'CATEGORY': product.category ?? 'N/A',
    'COST': formatCurrency(product.cost),
    'WEIGHT (oz / lb / kg)': formatWeight(product.weight),
    'LENGTH (in)': formatNumber(product.dimensions?.length ?? product.length),
    'WIDTH (in)': formatNumber(product.dimensions?.width ?? product.width),
    'HEIGHT (in)': formatNumber(product.dimensions?.height ?? product.height),
    'MATERIAL': product.material ?? 'N/A',
    'THICKNESS': product.thickness ?? 'N/A',
    'PACK QTY': product.packQty ?? 'N/A',
  };

  const th = 'border-b border-r border-slate-200 p-3 text-xs font-bold uppercase tracking-wide';
  const td = 'border-b border-r border-slate-200 p-2 text-center text-sm';
  const tdLeft = 'border-b border-r border-slate-200 p-3 text-sm';
  const productRows = data.product ? [data.product as UnknownRecord] : [];
  const stockRows = data.stock as UnknownRecord[];
  const channelRows = data.channels as UnknownRecord[];
  const salesRows = data.salesMetrics as UnknownRecord[];

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-sm text-sm">
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-xs font-semibold text-red-800 flex items-center justify-between">
          <span>Error: {error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold text-base line-height-1">×</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            {/* Row 1 — SKU + Title */}
            <tr className="bg-slate-50">
              <th className={`${th} bg-slate-100 text-slate-600 w-52`}>SKU</th>
              <td className={`${td} text-left font-mono text-emerald-700 font-bold`}>{data.sku}</td>
              <td className={`${td} text-left font-medium text-slate-900`} colSpan={channels.length - 1}>
                {product.title ?? 'N/A'}
              </td>
            </tr>
            {/* Row 2 — Channel Headers */}
            <tr>
              <th className={`${th} bg-slate-100 text-slate-600`}>
                <div className="flex justify-between items-center">
                  <span>Product Info</span>
                  {session && onUpdate && (
                    !isEditing ? (
                      <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-300 transition">
                        <Pencil className="size-3" /> Edit
                      </button>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={handleSave} disabled={isSaving} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 transition">
                          {isSaving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Save
                        </button>
                        <button onClick={handleCancel} disabled={isSaving} className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-200 transition">
                          <X className="size-3" /> Cancel
                        </button>
                      </div>
                    )
                  )}
                </div>
              </th>
              {channels.map((c) => (
                <th key={c.name} className={`${th} bg-emerald-700 text-white text-center`}>{c.name}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Image + ASIN + Stock + Price rows */}
            <tr>
              <td className={`${tdLeft} align-top`} rowSpan={5}>
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="h-36 w-36 rounded-xl border border-slate-100 object-contain p-1"
                  />
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
                    No Image
                  </div>
                )}
              </td>
              {channels.map((c) => (
                <td key={c.name} className={td}>
                  <span className="text-[10px] uppercase text-slate-400 tracking-wider block">Listing ID / ASIN</span>
                  <span className="font-mono font-semibold text-slate-800">{c.data.asin}</span>
                </td>
              ))}
            </tr>
            <tr className="bg-slate-50">
              {channels.map((c) => (
                <td key={c.name} className={td}>
                  <span className="text-[10px] uppercase text-slate-400 tracking-wider block">FBA Stock</span>
                  <span className="font-semibold text-slate-800">{c.data.fbaQty}</span>
                </td>
              ))}
            </tr>
            <tr>
              {channels.map((c) => (
                <td key={c.name} className={td}>
                  <span className="text-[10px] uppercase text-slate-400 tracking-wider block">MFN Stock</span>
                  <span className="font-semibold text-slate-800">{c.data.mfnQty}</span>
                </td>
              ))}
            </tr>
            <tr className="bg-slate-50">
              {channels.map((c) => (
                <td key={c.name} className={td}>
                  <span className="text-[10px] uppercase text-slate-400 tracking-wider block">FBA Price</span>
                  <span className="font-bold text-emerald-700">{c.data.fbaPrice}</span>
                </td>
              ))}
            </tr>
            <tr>
              {channels.map((c) => (
                <td key={c.name} className={td}>
                  <span className="text-[10px] uppercase text-slate-400 tracking-wider block">MFN Price</span>
                  <span className="font-bold text-slate-700">{c.data.mfnPrice}</span>
                </td>
              ))}
            </tr>

            {/* Attributes + Sales Velocity Matrix */}
            {ATTRIBUTE_ROWS.map((row, i) => {
              const salesRow = SALES_ROWS[i];

              let editContent = <span className="font-semibold text-slate-900">{attrValues[row.label] ?? 'N/A'}</span>;

              if (isEditing) {
                if (row.label === 'COST') {
                  editContent = <input type="number" step="0.01" className="w-20 rounded border border-slate-300 px-1 py-0.5 text-right font-semibold outline-none focus:border-emerald-500" value={editValues.cost} onChange={e => setEditValues({ ...editValues, cost: e.target.value })} />;
                } else if (row.label === 'WEIGHT (oz / lb / kg)') {
                  editContent = <input type="number" step="0.01" className="w-20 rounded border border-slate-300 px-1 py-0.5 text-right font-semibold outline-none focus:border-emerald-500" value={editValues.weight} onChange={e => setEditValues({ ...editValues, weight: e.target.value })} />;
                } else if (row.label === 'LENGTH (in)') {
                  editContent = <input type="number" step="0.01" className="w-20 rounded border border-slate-300 px-1 py-0.5 text-right font-semibold outline-none focus:border-emerald-500" value={editValues.length} onChange={e => setEditValues({ ...editValues, length: e.target.value })} />;
                } else if (row.label === 'WIDTH (in)') {
                  editContent = <input type="number" step="0.01" className="w-20 rounded border border-slate-300 px-1 py-0.5 text-right font-semibold outline-none focus:border-emerald-500" value={editValues.width} onChange={e => setEditValues({ ...editValues, width: e.target.value })} />;
                } else if (row.label === 'HEIGHT (in)') {
                  editContent = <input type="number" step="0.01" className="w-20 rounded border border-slate-300 px-1 py-0.5 text-right font-semibold outline-none focus:border-emerald-500" value={editValues.height} onChange={e => setEditValues({ ...editValues, height: e.target.value })} />;
                } else if (row.label === 'MATERIAL') {
                  editContent = <input type="text" className="w-24 rounded border border-slate-300 px-1 py-0.5 text-right font-semibold outline-none focus:border-emerald-500" value={editValues.material} onChange={e => setEditValues({ ...editValues, material: e.target.value })} />;
                } else if (row.label === 'THICKNESS') {
                  editContent = <input type="text" className="w-24 rounded border border-slate-300 px-1 py-0.5 text-right font-semibold outline-none focus:border-emerald-500" value={editValues.thickness} onChange={e => setEditValues({ ...editValues, thickness: e.target.value })} />;
                } else if (row.label === 'PACK QTY') {
                  editContent = <input type="number" step="1" className="w-20 rounded border border-slate-300 px-1 py-0.5 text-right font-semibold outline-none focus:border-emerald-500" value={editValues.packQty} onChange={e => setEditValues({ ...editValues, packQty: e.target.value })} />;
                }
              }

              return (
                <tr key={row.label} className={i % 2 === 0 ? 'bg-slate-50 hover:bg-slate-100 transition-colors' : 'hover:bg-slate-50 transition-colors'}>
                  <td className={tdLeft}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{row.label}</span>
                      {editContent}
                    </div>
                  </td>
                  {channels.map((c) => (
                    <td key={c.name} className={td}>
                      {salesRow ? (
                        <>
                          <span className="text-[10px] uppercase text-slate-400 tracking-wider block">{salesRow.label}</span>
                          <span className="font-semibold text-slate-800">{c.data[salesRow.key]}</span>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DetailTable
        title="All Product Data"
        rows={productRows}
        preferredColumns={['id', 'sku', 'title', 'brand', 'category', 'status', 'cost', 'currency', 'weight', 'length', 'width', 'height', 'material', 'thickness', 'packQty', 'imageUrl', 'productUrl', 'lastSyncedAt', 'createdAt', 'updatedAt']}
      />
      <DetailTable
        title="All Stock Data"
        rows={stockRows}
        preferredColumns={['id', 'productId', 'country', 'locationType', 'warehouse', 'quantity', 'reserved', 'inbound', 'available', 'updatedAt']}
      />
      <DetailTable
        title="All Pricing and Channel Data"
        rows={channelRows}
        preferredColumns={['id', 'productId', 'channel', 'country', 'asin', 'listingId', 'price', 'currency', 'isActive', 'updatedAt']}
      />
      <DetailTable
        title="All Sales Data"
        rows={salesRows}
        preferredColumns={['id', 'productId', 'productChannelId', 'channel', 'country', 'periodStart', 'periodEnd', 'unitsSold', 'revenue', 'velocity', 'currency', 'createdAt', 'updatedAt']}
      />
    </div>
  );
}
