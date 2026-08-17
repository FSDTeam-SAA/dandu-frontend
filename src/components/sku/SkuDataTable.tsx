import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ExternalLink, Loader2, Pencil, X } from 'lucide-react';
import {
  authApi,
  type AuthSession,
  type SkuMetrics,
  type SkuProduct,
} from '../../lib/authApi';
import {
  buildSkuComparison,
  PRIMARY_TABLE_HEADERS,
  PRIMARY_TABLE_SECTIONS,
  type MarketplaceComparisonColumn,
  type MarketplaceIdentifier,
  type PrimaryTableRow,
  type ProductFieldKey,
} from './skuComparison';

type UnknownRecord = Record<string, unknown>;

type EditValues = {
  cost: string | number;
  weight: string | number;
  length: string | number;
  width: string | number;
  height: string | number;
  material: string;
  thickness: string;
  packQty: string | number;
};

function asFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value: unknown): string {
  const number = asFiniteNumber(value);
  return number === null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number);
}

function formatNumber(value: unknown): string {
  const number = asFiniteNumber(value);
  return number === null ? '—' : number.toLocaleString();
}

function formatWeight(value: unknown): string {
  const ounces = asFiniteNumber(value);
  if (ounces === null) return '—';
  const options = { maximumFractionDigits: 3 };
  return [
    ounces.toLocaleString(undefined, options) + ' oz',
    (ounces / 16).toLocaleString(undefined, options) + ' lb',
    (ounces * 0.0283495).toLocaleString(undefined, options) + ' kg',
  ].join(' / ');
}

function formatDetailValue(value: unknown): string {
  if (value == null || value === '') return '—';
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
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

function editValuesFromProduct(product: SkuProduct): EditValues {
  return {
    cost: product.cost ?? '',
    weight: product.weight ?? '',
    length: product.dimensions?.length ?? product.length ?? '',
    width: product.dimensions?.width ?? product.width ?? '',
    height: product.dimensions?.height ?? product.height ?? '',
    material: product.material ?? '',
    thickness: product.thickness ?? '',
    packQty: product.packQty ?? '',
  };
}

function ClickableValue({
  identifiers,
  marketplace,
}: {
  identifiers: MarketplaceIdentifier[];
  marketplace: string;
}) {
  if (identifiers.length === 0) return <span aria-label={marketplace + ' identifier unavailable'}>—</span>;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {identifiers.map((identifier) =>
        identifier.url ? (
          <a
            key={identifier.value}
            href={identifier.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={'Open ' + marketplace + ' listing ' + identifier.value + ' in a new tab'}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded px-1 font-mono font-semibold text-emerald-700 underline-offset-2 hover:text-emerald-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            {identifier.value}
            <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
          </a>
        ) : (
          <span
            key={identifier.value}
            className="break-all font-mono font-semibold text-slate-800"
            aria-label={marketplace + ' listing ' + identifier.value + '; direct listing URL unavailable'}
          >
            {identifier.value}
          </span>
        ),
      )}
    </div>
  );
}

function ProductIdentity({
  sku,
  product,
  isEditing,
  isSaving,
  canEdit,
  onEdit,
  onSave,
  onCancel,
}: {
  sku: string;
  product: SkuProduct;
  isEditing: boolean;
  isSaving: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const title = product.title || 'Untitled product';

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={title + ' product'} width={64} height={64} className="size-full object-contain p-1" />
          ) : (
            <div className="flex size-full items-center justify-center px-1 text-center text-xs font-semibold text-slate-400">No image</div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold text-emerald-700">{sku}</p>
          <h3 className="mt-1 truncate text-sm font-black text-slate-900">{title}</h3>
        </div>
      </div>

      {canEdit ? (
        isEditing ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button type="button" onClick={onSave} disabled={isSaving} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Check aria-hidden="true" className="size-4" />}
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onCancel} disabled={isSaving} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              <X aria-hidden="true" className="size-4" />
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={onEdit} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
            <Pencil aria-hidden="true" className="size-4" />
            Edit
          </button>
        )
      ) : null}
    </header>
  );
}

function isEditableProductField(field: ProductFieldKey): field is keyof EditValues {
  return field !== 'category';
}

function productFieldValue(field: ProductFieldKey, product: SkuProduct): string {
  switch (field) {
    case 'category':
      return product.category || '—';
    case 'cost':
      return formatCurrency(product.cost);
    case 'weight':
      return formatWeight(product.weight);
    case 'length':
      return formatNumber(product.dimensions?.length ?? product.length);
    case 'width':
      return formatNumber(product.dimensions?.width ?? product.width);
    case 'height':
      return formatNumber(product.dimensions?.height ?? product.height);
    case 'material':
      return product.material || '—';
    case 'thickness':
      return product.thickness || '—';
    case 'packQty':
      return formatNumber(product.packQty);
  }
}

const PRODUCT_FIELD_LABELS: Record<ProductFieldKey, string> = {
  category: 'Category',
  cost: 'Cost',
  weight: 'Weight',
  length: 'Length',
  width: 'Width',
  height: 'Height',
  material: 'Material',
  thickness: 'Thickness',
  packQty: 'Pack Qty',
};

function ProductCell({
  fields,
  product,
  isEditing,
  editValues,
  onValueChange,
}: {
  fields: readonly ProductFieldKey[];
  product: SkuProduct;
  isEditing: boolean;
  editValues: EditValues;
  onValueChange: (field: keyof EditValues, value: string) => void;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
      {fields.map((field) => {
        const label = PRODUCT_FIELD_LABELS[field];
        const inputId = 'sku-product-' + field;
        const isText = field === 'material' || field === 'thickness';
        const step = field === 'packQty' ? '1' : '0.01';

        return (
          <div key={field} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-0.5 min-w-0">
              {isEditing && isEditableProductField(field) ? (
                <>
                  <label htmlFor={inputId} className="sr-only">Edit {label}</label>
                  <input
                    id={inputId}
                    type={isText ? 'text' : 'number'}
                    step={isText ? undefined : step}
                    inputMode={isText ? undefined : field === 'packQty' ? 'numeric' : 'decimal'}
                    value={editValues[field]}
                    onChange={(event) => onValueChange(field, event.target.value)}
                    className="h-8 w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                </>
              ) : (
                <span className="break-words font-semibold text-slate-900">{productFieldValue(field, product)}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function renderMarketplaceValue(row: PrimaryTableRow, column: MarketplaceComparisonColumn): ReactNode {
  if (row.kind === 'sales') {
    return (
      <dl className="grid grid-cols-4 gap-1 text-center text-xs">
        {row.windows.map((window) => (
          <div key={window}>
            <dt className="text-[10px] font-bold uppercase text-slate-500">{window}D</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {formatNumber(column.sales[row.field][window])}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  if (row.kind === 'marketplace') {
    switch (row.field) {
      case 'identifier':
        return <ClickableValue identifiers={column.identifiers} marketplace={column.label} />;
      case 'fbaQty':
        return formatNumber(column.fbaQty);
      case 'mfnStock':
        return formatNumber(column.mfnStock);
      case 'fbaPrice':
        return formatCurrency(column.fbaPrice);
      case 'price':
        return formatCurrency(column.price);
    }
  }

  return <span aria-label="Not applicable">—</span>;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <th scope="rowgroup" colSpan={PRIMARY_TABLE_HEADERS.length} className="border-y border-slate-300 bg-slate-100 px-3 py-1.5 text-left text-xs font-black uppercase tracking-wider text-slate-600">
        {label}
      </th>
    </tr>
  );
}

function PrimaryRow({
  row,
  rowIndex,
  columns,
  product,
  isEditing,
  editValues,
  onValueChange,
}: {
  row: PrimaryTableRow;
  rowIndex: number;
  columns: MarketplaceComparisonColumn[];
  product: SkuProduct;
  isEditing: boolean;
  editValues: EditValues;
  onValueChange: (field: keyof EditValues, value: string) => void;
}) {
  const background = rowIndex % 2 === 1 ? 'bg-slate-50' : 'bg-white';

  return (
    <tr className={background}>
      <th scope="row" className={['sticky left-0 z-10 border-b border-r border-slate-200 px-3 py-1.5 text-left text-xs font-bold text-slate-700', background].join(' ')}>
        {row.label}
      </th>
      <td className="border-b border-r border-slate-200 px-2 py-1.5 text-sm tabular-nums text-slate-900">
        {row.kind === 'product' ? (
          <ProductCell fields={row.fields} product={product} isEditing={isEditing} editValues={editValues} onValueChange={onValueChange} />
        ) : (
          <span aria-label="Not applicable">—</span>
        )}
      </td>
      {columns.map((column) => (
        <td key={column.key} className="border-b border-r border-slate-200 px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-slate-900 last:border-r-0">
          {renderMarketplaceValue(row, column)}
        </td>
      ))}
    </tr>
  );
}

function TableSection({
  label,
  rows,
  columns,
  product,
  isEditing,
  editValues,
  onValueChange,
  startIndex,
}: {
  label: string;
  rows: readonly PrimaryTableRow[];
  columns: MarketplaceComparisonColumn[];
  product: SkuProduct;
  isEditing: boolean;
  editValues: EditValues;
  onValueChange: (field: keyof EditValues, value: string) => void;
  startIndex: number;
}) {
  return (
    <>
      <SectionHeader label={label} />
      {rows.map((row, index) => (
        <PrimaryRow
          key={[label, row.label].join('-')}
          row={row}
          rowIndex={startIndex + index}
          columns={columns}
          product={product}
          isEditing={isEditing}
          editValues={editValues}
          onValueChange={onValueChange}
        />
      ))}
    </>
  );
}

function ConsolidatedSkuTable({
  columns,
  product,
  isEditing,
  editValues,
  onValueChange,
}: {
  columns: MarketplaceComparisonColumn[];
  product: SkuProduct;
  isEditing: boolean;
  editValues: EditValues;
  onValueChange: (field: keyof EditValues, value: string) => void;
}) {
  let rowIndex = 0;

  return (
    <section aria-label="SKU decision table" className="min-w-0">
      <div className="overflow-x-auto border-b border-slate-200" tabIndex={0} aria-label="Scrollable SKU decision table">
        <table className="w-full min-w-[1152px] table-fixed border-collapse text-left">
          <caption className="sr-only">
            Consolidated SKU decision table with product information and marketplace data for Amazon US, Amazon CA, eBay, and DistinctAndUnique.
          </caption>
          <colgroup>
            <col className="w-40" />
            <col className="w-72" />
            <col className="w-44" />
            <col className="w-44" />
            <col className="w-44" />
            <col className="w-44" />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-emerald-800 text-white">
            <tr>
              <th scope="col" className="sticky left-0 z-30 border-r border-emerald-700 bg-emerald-800 px-3 py-2 text-left text-xs font-black uppercase tracking-wide">
                {PRIMARY_TABLE_HEADERS[0]}
              </th>
              <th scope="col" className="border-r border-emerald-700 px-2 py-2 text-left text-xs font-black uppercase tracking-wide">
                {PRIMARY_TABLE_HEADERS[1]}
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="border-r border-emerald-700 px-2 py-2 text-center text-xs font-black last:border-r-0">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRIMARY_TABLE_SECTIONS.map((section) => {
              const startIndex = rowIndex;
              rowIndex += section.rows.length;
              return (
                <TableSection
                  key={section.label}
                  label={section.label}
                  rows={section.rows}
                  columns={columns}
                  product={product}
                  isEditing={isEditing}
                  editValues={editValues}
                  onValueChange={onValueChange}
                  startIndex={startIndex}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
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
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-500">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm font-semibold text-slate-500">No data available</div>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-max border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col" className="border-b border-r border-slate-200 px-3 py-2 font-black uppercase">
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

function RawLinnworksData({ data }: { data: SkuMetrics }) {
  return (
    <details className="border-t border-slate-200">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-700 marker:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600">
        <span>View raw Linnworks data</span>
        <span className="text-xs font-semibold text-slate-500">Diagnostic records</span>
      </summary>
      <div className="border-t border-slate-200">
        <DetailTable title="Product" rows={data.product ? [data.product] : []} preferredColumns={['id', 'sku', 'title', 'brand', 'category', 'status', 'cost', 'currency', 'weight', 'length', 'width', 'height', 'material', 'thickness', 'packQty', 'imageUrl', 'productUrl', 'lastSyncedAt', 'createdAt', 'updatedAt']} />
        <DetailTable title="Stock" rows={data.stock} preferredColumns={['id', 'productId', 'country', 'locationType', 'warehouse', 'quantity', 'reserved', 'inbound', 'available', 'updatedAt']} />
        <DetailTable title="Pricing and Channel" rows={data.channels} preferredColumns={['id', 'productId', 'channel', 'country', 'asin', 'listingId', 'price', 'fbaPrice', 'mfnPrice', 'currency', 'isActive', 'updatedAt']} />
        <DetailTable title="Sales" rows={data.salesMetrics} preferredColumns={['id', 'productId', 'productChannelId', 'channel', 'country', 'fulfillmentType', 'periodStart', 'periodEnd', 'unitsSold', 'revenue', 'velocity', 'currency', 'createdAt', 'updatedAt']} />
      </div>
    </details>
  );
}

export function SkuDataTable({
  data,
  session,
  onUpdate,
}: {
  data: SkuMetrics;
  session?: AuthSession;
  onUpdate?: () => void;
}) {
  const product = data.product ?? {};
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editValues, setEditValues] = useState<EditValues>(() => editValuesFromProduct(product));
  const comparison = buildSkuComparison(data);

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
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update product details. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setEditValues(editValuesFromProduct(product));
  };

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss product update error" className="flex size-11 shrink-0 items-center justify-center rounded-lg text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : null}

      <ProductIdentity
        sku={data.sku}
        product={product}
        isEditing={isEditing}
        isSaving={isSaving}
        canEdit={Boolean(session && onUpdate)}
        onEdit={() => setIsEditing(true)}
        onSave={handleSave}
        onCancel={handleCancel}
      />
      <ConsolidatedSkuTable
        columns={comparison.columns}
        product={product}
        isEditing={isEditing}
        editValues={editValues}
        onValueChange={(field, value) => setEditValues((current) => ({ ...current, [field]: value }))}
      />
      <RawLinnworksData data={data} />
    </div>
  );
}
