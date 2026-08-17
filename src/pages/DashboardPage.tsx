import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Boxes, CalendarClock, Loader2, PackageCheck, RefreshCw, Zap } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { InventoryAlerts } from '../components/dashboard/InventoryAlerts';
import { Empty, InlineError, Kpi, Panel } from '../components/ui';
import {
  authApi,
  type AuthSession,
  type BackgroundJobResult,
  type CurrentUserProfile,
  type DashboardMetrics,
  type DashboardPeriod,
  getErrorMessage,
  type InventoryAlertItem,
  type SkuMetrics,
} from '../lib/authApi';
import { buildDashboardView } from '../lib/dashboardMetrics';

const PERIODS: DashboardPeriod[] = ['7D', '30D', '90D', '365D'];

function formatDate(value: string | null): string {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatMoney(amount: number, currency: string): string {
  if (currency === 'UNSPECIFIED') return `${amount.toLocaleString()} (currency N/A)`;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

export function DashboardPage({ session, profile }: {
  session: AuthSession;
  profile: CurrentUserProfile | null;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>('30D');
  const [catalog, setCatalog] = useState<SkuMetrics[] | null>(null);
  const [storedStock, setStoredStock] = useState<DashboardMetrics['stockDistribution']>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [alerts, setAlerts] = useState<InventoryAlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<BackgroundJobResult | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setError('');
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [items, stockResponse] = await Promise.all([
        authApi.browseAllSkus(session.accessToken, controller.signal),
        authApi.getDashboardMetrics(session.accessToken, '30D', controller.signal),
      ]);
      setCatalog(items);
      setStoredStock(stockResponse.data.stockDistribution);
    } catch (requestError) {
      if (controller.signal.aborted) return;
      setCatalog(null);
      setStoredStock([]);
      setError(getErrorMessage(requestError, 'Failed to load complete dashboard data.'));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [session.accessToken]);

  useEffect(() => {
    void loadDashboard();
    return () => activeRequest.current?.abort();
  }, [loadDashboard]);

  useEffect(() => {
    const controller = new AbortController();
    setAlertsLoading(true);
    setAlertsError('');
    authApi.getInventoryAlerts(session.accessToken, controller.signal)
      .then((response) => setAlerts(response.data))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setAlertsError(getErrorMessage(requestError, 'Failed to load inventory alerts.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAlertsLoading(false);
      });
    return () => controller.abort();
  }, [session.accessToken]);

  const view = useMemo(
    () => catalog ? buildDashboardView(catalog, period) : null,
    [catalog, period],
  );
  const totalUnits = view?.channelSales.reduce((sum, row) => sum + row.units, 0) ?? 0;
  const totalStock = storedStock.reduce((sum, row) => sum + row.value, 0);
  const revenueTotals = useMemo(() => {
    const totals = new Map<string, number>();
    view?.channelSales.forEach((row) => row.revenue.forEach(({ currency, amount }) => {
      totals.set(currency, (totals.get(currency) ?? 0) + amount);
    }));
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [view]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError('');
    try {
      const response = await authApi.triggerLinnworksSync(session.accessToken);
      setSyncResult(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'The Linnworks sync request was not accepted.'));
    } finally {
      setSyncing(false);
    }
  };

  const displayName = profile?.userProfile?.firstName || session.user.username;
  const unavailableValue = loading ? 'Loading…' : 'N/A';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={<Boxes className="size-5" />} label="API-returned SKUs" value={view ? view.returnedSkuCount.toLocaleString() : unavailableValue} detail="Records received across all pages" />
          <Kpi icon={<PackageCheck className="size-5" />} label={`Contributing SKUs (${period})`} value={view ? view.contributingSkuCount.toLocaleString() : unavailableValue} detail="SKUs with a matching sales snapshot" />
          <Kpi icon={<BarChart3 className="size-5" />} label={`Units sold (${period})`} value={view ? totalUnits.toLocaleString() : unavailableValue} detail="Derived from selected SKU snapshots" />
          <Kpi icon={<CalendarClock className="size-5" />} label="Latest sales snapshot" value={view ? formatDate(view.latestPeriodEnd) : unavailableValue} detail={`Latest SKU sync: ${view ? formatDate(view.latestSyncedAt) : unavailableValue}`} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => void loadDashboard(true)} disabled={refreshing || syncing || loading} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={() => void handleSync()} disabled={syncing || refreshing} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60">
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {syncing ? 'Submitting…' : 'Sync Linnworks'}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">Dashboard totals use only the records returned by the SKU API for {displayName}; they are not described as the complete external catalog.</p>

      {syncing && <div role="status" className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><Loader2 className="size-4 animate-spin" />Submitting the sync request…</div>}
      {syncResult && !syncing && (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <strong>Sync job accepted.</strong>
          <span>Job ID: {syncResult.jobId ?? 'not supplied by API'}</span>
          <span>No completion status is available yet.</span>
          <button type="button" onClick={() => setSyncResult(null)} className="ml-auto" aria-label="Dismiss sync status">×</button>
        </div>
      )}
      {error && <InlineError text={error} />}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="size-8 animate-spin text-emerald-600" /></div>
      ) : view ? (
        <>
          <Panel title="Sales snapshots">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">Newest exact-window snapshot per SKU, channel, country, and currency.</p>
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {PERIODS.map((value) => <button type="button" key={value} onClick={() => setPeriod(value)} className={`rounded-lg px-3 py-1 text-xs font-black transition ${period === value ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{value}</button>)}
              </div>
            </div>
            {view.channelSales.length === 0 ? <Empty text={`No valid ${period} sales snapshots were returned.`} /> : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={view.channelSales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="units" name="Units sold" fill="#047857" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Stored stock by location" className="lg:col-span-1">
              <p className="text-sm text-slate-500">{totalStock.toLocaleString()} units in backend-stored locations.</p>
              {storedStock.length === 0 ? <div className="mt-4"><Empty text="No stored stock distribution was returned." /></div> : (
                <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} /><Pie data={storedStock} cx="50%" cy="43%" innerRadius={55} outerRadius={78} dataKey="value" stroke="none">{storedStock.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}</Pie></PieChart></ResponsiveContainer></div>
              )}
            </Panel>

            <Panel title={`Channel totals — ${period}`} className="lg:col-span-2">
              {revenueTotals.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{revenueTotals.map(([currency, amount]) => <span key={currency} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Revenue: {formatMoney(amount, currency)}</span>)}</div>}
              {view.channelSales.length === 0 ? <Empty text="No channel totals are available for this window." /> : (
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100"><th className="py-2 pr-4 text-left text-xs font-black uppercase text-slate-400">Channel</th><th className="py-2 pr-4 text-right text-xs font-black uppercase text-slate-400">Units</th><th className="py-2 pr-4 text-right text-xs font-black uppercase text-slate-400">Revenue</th><th className="py-2 pr-4 text-right text-xs font-black uppercase text-slate-400">Fulfillment</th><th className="py-2 pr-4 text-right text-xs font-black uppercase text-slate-400">Growth</th><th className="py-2 text-right text-xs font-black uppercase text-slate-400">Stock cover</th></tr></thead><tbody className="divide-y divide-slate-50">{view.channelSales.map((row) => <tr key={row.key}><td className="py-3 pr-4 font-semibold text-slate-900">{row.label}</td><td className="py-3 pr-4 text-right font-semibold">{row.units.toLocaleString()}</td><td className="py-3 pr-4 text-right font-bold text-emerald-700">{row.revenue.length ? row.revenue.map(({ currency, amount }) => <div key={currency}>{formatMoney(amount, currency)}</div>) : 'N/A'}</td><td className="py-3 pr-4 text-right text-slate-500">N/A</td><td className="py-3 pr-4 text-right text-slate-500">N/A</td><td className="py-3 text-right text-slate-500">N/A</td></tr>)}</tbody></table></div>
              )}
              <p className="mt-3 text-xs text-slate-500">Fulfillment attribution, growth, stock cover, and revenue trend are unavailable because the returned data does not support those calculations.</p>
            </Panel>
          </div>
        </>
      ) : null}

      {alertsLoading ? <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />Loading inventory alerts…</div> : alertsError ? <InlineError text={alertsError} /> : <InventoryAlerts alerts={alerts} />}
    </div>
  );
}
