export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: string;
  verified: boolean;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

export type CurrentUserProfile = AuthUser & {
  status: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  userProfile: {
    firstName: string | null;
    lastName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type UpdateProfilePayload = {
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatarUrl?: string;
};

export type SkuProduct = Record<string, unknown> & {
  id?: string | null;
  sku?: string | null;
  title?: string | null;
  brand?: string | null;
  status?: string | null;
  currency?: string | null;
  category?: string | null;
  cost?: string | number | null;
  weight?: string | number | null;
  length?: string | number | null;
  width?: string | number | null;
  height?: string | number | null;
  dimensions?: {
    length?: string | number | null;
    width?: string | number | null;
    height?: string | number | null;
  } | null;
  material?: string | null;
  thickness?: string | null;
  packQty?: string | number | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  lastSyncedAt?: string | Date | null;
};

export type SkuStock = Record<string, unknown> & {
  country?: string | null;
  locationType?: string | null;
  warehouse?: string | null;
  quantity?: string | number | null;
  reserved?: string | number | null;
  inbound?: string | number | null;
  available?: string | number | null;
};

export type SkuChannel = Record<string, unknown> & {
  channel?: string | null;
  country?: string | null;
  asin?: string | null;
  listingId?: string | null;
  price?: string | number | null;
  fbaPrice?: string | number | null;
  mfnPrice?: string | number | null;
  currency?: string | null;
  isActive?: boolean | null;
};

export type SkuSalesMetric = Record<string, unknown> & {
  channel?: string | null;
  country?: string | null;
  fulfillmentType?: string | null;
  periodDays?: string | number | null;
  days?: string | number | null;
  windowDays?: string | number | null;
  period?: string | null;
  window?: string | null;
  label?: string | null;
  periodStart?: string | Date | null;
  periodEnd?: string | Date | null;
  unitsSold?: string | number | null;
  revenue?: string | number | null;
  velocity?: string | number | null;
  currency?: string | null;
};

export type SkuMetrics = {
  sku: string;
  product: SkuProduct | null;
  stock: SkuStock[];
  channels: SkuChannel[];
  salesMetrics: SkuSalesMetric[];
};

export type SkuFilterParams = {
  q?: string;
  stockStatus?: 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  channel?: 'ALL' | 'AMAZON' | 'EBAY' | 'WALMART' | 'SHOPIFY' | 'WEBSITE' | 'OTHER';
};

export type PaginatedSkus = {
  items: SkuMetrics[];
  nextCursor: string | null;
  total: number;
};

export type DashboardMetrics = {
  salesVelocity: { channel: string; fulfillmentType?: string; fba: number; mfn: number }[];
  stockDistribution: { name: string; value: number; fill: string }[];
  revenueTrend: { month: string; revenue: number }[];
};

export type DashboardPeriod = '7D' | '30D' | '90D' | '365D';

export type SyncResult = {
  status: 'COMPLETED' | 'FAILED';
  updatedSkus: number;
  updatedStock: number;
  updatedListings: number;
  updatedSalesMetrics?: number;
  syncedAt: string;
  durationMs: number;
};

export type BackgroundJobResult = {
  status: 'QUEUED';
  jobId: string | null;
  jobType: 'manual' | 'inventory-refresh';
  queuedAt: string | null;
};

export type InventoryRefreshResult = {
  status: 'COMPLETED' | 'FAILED';
  remainingSkus: string[];
  remainingSkuCount: number;
  deletedSkus: number;
  updatedSkus: number;
  updatedStock: number;
  updatedListings: number;
  refreshedAt: string;
  durationMs: number;
  errorMessage?: string;
};

export type InventoryRefreshOutcome = BackgroundJobResult | InventoryRefreshResult;

export type HistoricalSalesIngestionPayload = {
  fromDate?: string;
  toDate?: string;
  historyDays?: number;
  chunkDays?: number;
};

export type HistoricalSalesIngestionResult = {
  status: 'COMPLETED' | 'FAILED';
  fromDate: string;
  toDate: string;
  chunkDays: number;
  chunksProcessed: number;
  pagesProcessed: number;
  ordersProcessed: number;
  itemRowsProcessed: number;
  metricsUpdated: number;
  skippedItemRows: number;
  failedRows: number;
  clearedMetrics: number;
  syncedAt: string;
  durationMs: number;
  errorMessage?: string;
  errorCode?: string;
  failedChunk?: {
    fromDate: string;
    toDate: string;
    pageNumber: number;
  };
  userMessage?: string;
};

export type InventoryAlertItem = {
  sku: string;
  title: string;
  type: 'DEAD_STOCK' | 'AGED_STOCK' | 'CRITICAL_LOW' | 'OUT_OF_STOCK';
  detail: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
};

export type TokenRefresh = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type PasswordResetGrant = {
  resetToken: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:5000/v1';
export const AUTH_STORAGE_KEY = 'dandu.auth.session';
export const AUTH_SESSION_CHANGED_EVENT = 'dandu.auth.session.changed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function requireString(record: Record<string, unknown>, key: string, responseName: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${responseName} response: ${key} must be a string.`);
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string, responseName: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${responseName} response: ${key} must be a finite number.`);
  }
  return value;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isRecord(error)) {
    const response = error.response;
    if (isRecord(response) && isRecord(response.data) && typeof response.data.message === 'string') {
      return response.data.message;
    }
    if (typeof error.message === 'string') return error.message;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

export function normalizeQueuedJobResult(
  value: unknown,
  fallbackJobType: BackgroundJobResult['jobType'],
): BackgroundJobResult {
  if (!isRecord(value)) throw new Error('Invalid queued job response.');

  const rawJobId = value.jobId;
  const jobId = typeof rawJobId === 'string' || typeof rawJobId === 'number'
    ? String(rawJobId)
    : null;
  const jobType = value.jobType === 'manual' || value.jobType === 'inventory-refresh'
    ? value.jobType
    : fallbackJobType;
  const queuedAt = typeof value.queuedAt === 'string' ? value.queuedAt : null;

  if (value.status !== undefined && value.status !== 'QUEUED') {
    throw new Error('Invalid queued job response: status must be QUEUED.');
  }
  if (!jobId && value.status !== 'QUEUED') {
    throw new Error('Invalid queued job response: job identifier is missing.');
  }

  return { status: 'QUEUED', jobId, jobType, queuedAt };
}

function normalizeInventoryCompletion(value: Record<string, unknown>): InventoryRefreshResult {
  if (value.status !== 'COMPLETED' && value.status !== 'FAILED') {
    throw new Error('Invalid inventory refresh response: status is unsupported.');
  }
  if (!Array.isArray(value.remainingSkus) || !value.remainingSkus.every((sku) => typeof sku === 'string')) {
    throw new Error('Invalid inventory refresh response: remainingSkus must contain strings.');
  }
  if (!isNullableString(value.errorMessage)) {
    throw new Error('Invalid inventory refresh response: errorMessage must be a string.');
  }

  return {
    status: value.status,
    remainingSkus: value.remainingSkus,
    remainingSkuCount: requireNumber(value, 'remainingSkuCount', 'inventory refresh'),
    deletedSkus: requireNumber(value, 'deletedSkus', 'inventory refresh'),
    updatedSkus: requireNumber(value, 'updatedSkus', 'inventory refresh'),
    updatedStock: requireNumber(value, 'updatedStock', 'inventory refresh'),
    updatedListings: requireNumber(value, 'updatedListings', 'inventory refresh'),
    refreshedAt: requireString(value, 'refreshedAt', 'inventory refresh'),
    durationMs: requireNumber(value, 'durationMs', 'inventory refresh'),
    ...(value.errorMessage ? { errorMessage: value.errorMessage } : {}),
  };
}

export function normalizeInventoryRefreshResult(value: unknown): InventoryRefreshOutcome {
  if (!isRecord(value)) throw new Error('Invalid inventory refresh response.');
  if (value.status === 'COMPLETED' || value.status === 'FAILED') {
    return normalizeInventoryCompletion(value);
  }
  return normalizeQueuedJobResult(value, 'inventory-refresh');
}

export function normalizeHistoricalSalesResult(value: unknown): HistoricalSalesIngestionResult {
  if (!isRecord(value) || (value.status !== 'COMPLETED' && value.status !== 'FAILED')) {
    throw new Error('Invalid historical sales response.');
  }
  if (!isNullableString(value.errorMessage) || !isNullableString(value.errorCode) || !isNullableString(value.userMessage)) {
    throw new Error('Invalid historical sales response: error metadata must be strings.');
  }

  let failedChunk: HistoricalSalesIngestionResult['failedChunk'];
  if (value.failedChunk !== undefined && value.failedChunk !== null) {
    if (!isRecord(value.failedChunk)) throw new Error('Invalid historical sales response: failedChunk is malformed.');
    failedChunk = {
      fromDate: requireString(value.failedChunk, 'fromDate', 'historical sales failed chunk'),
      toDate: requireString(value.failedChunk, 'toDate', 'historical sales failed chunk'),
      pageNumber: requireNumber(value.failedChunk, 'pageNumber', 'historical sales failed chunk'),
    };
  }

  return {
    status: value.status,
    fromDate: requireString(value, 'fromDate', 'historical sales'),
    toDate: requireString(value, 'toDate', 'historical sales'),
    chunkDays: requireNumber(value, 'chunkDays', 'historical sales'),
    chunksProcessed: requireNumber(value, 'chunksProcessed', 'historical sales'),
    pagesProcessed: requireNumber(value, 'pagesProcessed', 'historical sales'),
    ordersProcessed: requireNumber(value, 'ordersProcessed', 'historical sales'),
    itemRowsProcessed: requireNumber(value, 'itemRowsProcessed', 'historical sales'),
    metricsUpdated: requireNumber(value, 'metricsUpdated', 'historical sales'),
    skippedItemRows: requireNumber(value, 'skippedItemRows', 'historical sales'),
    failedRows: requireNumber(value, 'failedRows', 'historical sales'),
    clearedMetrics: requireNumber(value, 'clearedMetrics', 'historical sales'),
    syncedAt: requireString(value, 'syncedAt', 'historical sales'),
    durationMs: requireNumber(value, 'durationMs', 'historical sales'),
    ...(value.errorMessage ? { errorMessage: value.errorMessage } : {}),
    ...(value.errorCode ? { errorCode: value.errorCode } : {}),
    ...(value.userMessage ? { userMessage: value.userMessage } : {}),
    ...(failedChunk ? { failedChunk } : {}),
  };
}

function isSkuMetrics(value: unknown): value is SkuMetrics {
  return isRecord(value)
    && typeof value.sku === 'string'
    && (value.product === null || isRecord(value.product))
    && Array.isArray(value.stock)
    && value.stock.every(isRecord)
    && Array.isArray(value.channels)
    && value.channels.every(isRecord)
    && Array.isArray(value.salesMetrics)
    && value.salesMetrics.every(isRecord);
}

export function normalizePaginatedSkus(value: unknown): PaginatedSkus {
  if (!isRecord(value)
    || !Array.isArray(value.items)
    || !value.items.every(isSkuMetrics)
    || (value.nextCursor !== null && typeof value.nextCursor !== 'string')
    || typeof value.total !== 'number'
    || !Number.isFinite(value.total)
    || value.total < 0) {
    throw new Error('Invalid paginated SKU response.');
  }

  return {
    items: value.items,
    nextCursor: value.nextCursor,
    total: value.total,
  };
}

export function normalizeDashboardMetrics(value: unknown): DashboardMetrics {
  if (!isRecord(value) || !Array.isArray(value.stockDistribution)) {
    throw new Error('Invalid dashboard stock response.');
  }

  const stockDistribution = value.stockDistribution.map((entry) => {
    if (!isRecord(entry)
      || typeof entry.name !== 'string'
      || typeof entry.value !== 'number'
      || !Number.isFinite(entry.value)
      || entry.value < 0
      || typeof entry.fill !== 'string') {
      throw new Error('Invalid dashboard stock response: stock distribution is malformed.');
    }
    return { name: entry.name, value: entry.value, fill: entry.fill };
  });

  return { salesVelocity: [], stockDistribution, revenueTrend: [] };
}

function readStoredAuthSession(): AuthSession | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AuthSession) : null;
  } catch {
    return null;
  }
}

function writeStoredAuthSession(session: AuthSession | null) {
  if (session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent<AuthSession | null>(AUTH_SESSION_CHANGED_EVENT, {
      detail: session,
    }),
  );
}

async function refreshStoredAuthSession(): Promise<string | null> {
  const session = readStoredAuthSession();
  if (!session?.refreshToken) return null;

  const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(body) || !isRecord(body.data) || typeof body.data.accessToken !== 'string') {
    writeStoredAuthSession(null);
    return null;
  }

  const refreshedSession: AuthSession = {
    ...session,
    accessToken: body.data.accessToken,
    refreshToken: typeof body.data.refreshToken === 'string' ? body.data.refreshToken : session.refreshToken,
    expiresIn: typeof body.data.expiresIn === 'number' ? body.data.expiresIn : session.expiresIn,
  };
  writeStoredAuthSession(refreshedSession);
  return refreshedSession.accessToken;
}

async function parseResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  let body: unknown = null;
  if (isJson) {
    body = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => null);
    if (!response.ok) {
      if (text && text.includes('Cannot GET')) {
        throw new Error('API endpoint not found or backend is offline. Check your connection.');
      }
      throw new Error(`Server returned non-JSON error: ${response.status} ${response.statusText}`);
    }
  }

  if (!response.ok) {
    let message = 'Request failed';
    if (isRecord(body) && 'message' in body) {
      message = String(body.message);
      if (message.includes('Cannot GET')) {
        message = 'API endpoint not found. Backend may be offline or syncing.';
      }
    }
    throw new Error(message);
  }

  if (!isRecord(body) || typeof body.success !== 'boolean' || typeof body.message !== 'string' || !('data' in body)) {
    throw new Error('Server returned an invalid API response.');
  }

  return body as ApiEnvelope<T>;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<ApiEnvelope<T>> {
  const makeRequest = (token?: string) => fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  let response = await makeRequest(options.token);

  if (response.status === 401 && options.token && path !== '/auth/refresh-token') {
    const cloned = response.clone();
    const body = await cloned.json().catch(() => null);
    const message = isRecord(body) && 'message' in body
      ? String(body.message)
      : '';

    if (message.includes('Token has expired')) {
      const refreshedToken = await refreshStoredAuthSession();
      if (refreshedToken) {
        response = await makeRequest(refreshedToken);
      }
    }
  }

  return parseResponse<T>(response);
}

export const authApi = {
  // --- REAL AUTHENTICATION APIS ---
  login(payload: { email: string; password: string }) {
    return request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  register(payload: { username: string; email: string; password: string }) {
    return request<unknown>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  verifyOtp(payload: { email: string; code: string; purpose?: 'registration' | 'password_reset' }) {
    return request<AuthSession | PasswordResetGrant>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  resendOtp(payload: { email: string; purpose?: 'registration' | 'password_reset' }) {
    return request<unknown>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  forgotPassword(payload: { email: string }) {
    return request<unknown>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  changePassword(payload: { currentPassword?: string; resetToken?: string; newPassword: string }, accessToken?: string) {
    return request<AuthSession>('/auth/change-password', {
      method: 'POST',
      token: accessToken,
      body: JSON.stringify(payload),
    });
  },

  refreshToken(refreshToken: string) {
    return request<TokenRefresh>('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  logout(refreshToken: string, accessToken: string) {
    return request<unknown>('/auth/logout', {
      method: 'POST',
      token: accessToken,
      body: JSON.stringify({ refreshToken }),
    });
  },

  logoutAll(accessToken: string) {
    return request<unknown>('/auth/logout-all', {
      method: 'POST',
      token: accessToken,
    });
  },

  me(accessToken: string) {
    return request<CurrentUserProfile>('/auth/me', {
      token: accessToken,
    });
  },

  updateProfile(accessToken: string, payload: UpdateProfilePayload) {
    return request<CurrentUserProfile['userProfile']>('/auth/profile', {
      method: 'PATCH',
      token: accessToken,
      body: JSON.stringify(payload),
    });
  },

  googleInit(redirectUrl?: string) {
    const search = redirectUrl ? `?redirectUrl=${encodeURIComponent(redirectUrl)}` : '';
    return request<{ url: string; state: string; message: string }>(`/auth/google${search}`);
  },

  searchSku(accessToken: string, sku: string) {
    return request<SkuMetrics>(`/sku-dashboard/search?sku=${encodeURIComponent(sku)}`, {
      token: accessToken,
    });
  },

  async browseSkus(
    accessToken: string,
    filters: SkuFilterParams,
    cursor?: string,
    limit = 10,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.stockStatus) params.set('stockStatus', filters.stockStatus);
    if (filters.channel) params.set('channel', filters.channel);
    if (cursor) params.set('cursor', cursor);
    params.set('limit', String(limit));

    const response = await request<unknown>(`/sku-dashboard/browse?${params.toString()}`, {
      token: accessToken,
      signal,
    });
    return { ...response, data: normalizePaginatedSkus(response.data) };
  },

  async browseAllSkus(accessToken: string, signal?: AbortSignal): Promise<SkuMetrics[]> {
    const items: SkuMetrics[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    let expectedTotal: number | null = null;

    while (true) {
      const response = await this.browseSkus(accessToken, {}, cursor, 100, signal);
      expectedTotal ??= response.data.total;
      if (response.data.total !== expectedTotal) {
        throw new Error('The SKU catalog changed while it was loading. Retry to calculate accurate totals.');
      }
      items.push(...response.data.items);

      const nextCursor = response.data.nextCursor;
      if (!nextCursor) break;
      if (seenCursors.has(nextCursor)) {
        throw new Error('The SKU catalog returned a repeated cursor. Totals were not calculated.');
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }

    if (expectedTotal === null || items.length !== expectedTotal) {
      throw new Error(`Incomplete SKU response: received ${items.length} of ${expectedTotal ?? 0} records.`);
    }
    return items;
  },

  async getDashboardMetrics(accessToken: string, period: string = '30D', signal?: AbortSignal) {
    const response = await request<unknown>(`/sku-dashboard/dashboard?period=${encodeURIComponent(period)}`, {
      token: accessToken,
      signal,
    });
    return { ...response, data: normalizeDashboardMetrics(response.data) };
  },

  async triggerLinnworksSync(accessToken: string) {
    const response = await request<unknown>('/sku-dashboard/sync/linnworks', {
      method: 'POST',
      token: accessToken,
      body: JSON.stringify({ queued: true }),
    });
    return { ...response, data: normalizeQueuedJobResult(response.data, 'manual') };
  },

  async refreshInventory(accessToken: string) {
    const response = await request<unknown>('/sku-dashboard/refresh-inventory', {
      method: 'POST',
      token: accessToken,
      body: JSON.stringify({}),
    });
    return { ...response, data: normalizeInventoryRefreshResult(response.data) };
  },

  async triggerHistoricalSalesIngestion(accessToken: string, payload: HistoricalSalesIngestionPayload = {}) {
    const response = await request<unknown>('/sku-dashboard/sync/linnworks/historical-sales', {
      method: 'POST',
      token: accessToken,
      body: JSON.stringify(payload),
    });
    return { ...response, data: normalizeHistoricalSalesResult(response.data) };
  },

  getInventoryAlerts(accessToken: string, signal?: AbortSignal) {
    return request<InventoryAlertItem[]>('/sku-dashboard/alerts', {
      token: accessToken,
      signal,
    });
  },

  updateProduct(accessToken: string, sku: string, data: Partial<SkuProduct>) {
    return request<unknown>(`/sku-dashboard/product/${encodeURIComponent(sku)}`, {
      method: 'PATCH',
      token: accessToken,
      body: JSON.stringify(data),
    });
  },
};
