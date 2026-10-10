import type { ApiMeta, ApiResponse } from '../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors?: Array<{ field: string; message: string }>;

  constructor(status: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }
}

/** CSRF token issued as a readable cookie at sign-in. */
function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  raw?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE_URL}/api/v1${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; meta?: ApiMeta }> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (method !== 'GET') {
    const csrf = readCookie('cgs_csrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      // Session lives in an httpOnly cookie, so credentials must be included.
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiClientError(0, 'Could not reach the server. Check that the API is running.', 'NETWORK_ERROR');
  }

  if (options.raw) {
    if (!response.ok) throw new ApiClientError(response.status, 'Request failed', 'REQUEST_FAILED');
    return { data: (await response.text()) as unknown as T };
  }

  const text = await response.text();
  let payload: ApiResponse<T> | null = null;
  try {
    payload = text ? (JSON.parse(text) as ApiResponse<T>) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload?.message ?? `Request failed with status ${response.status}.`,
      payload?.meta?.code ?? 'REQUEST_FAILED',
      payload?.errors,
    );
  }

  return { data: payload?.data as T, meta: payload?.meta };
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  raw: <T>(path: string) => request<T>(path, { method: 'GET', raw: true }),
  baseUrl: BASE_URL,
};

/**
 * Opens an authorised report download in a new tab. Because the session is a
 * cookie, a plain link works - no token needs to be put in the URL.
 */
export function openDownload(path: string): void {
  window.open(`${BASE_URL}/api/v1${path}`, '_blank', 'noopener,noreferrer');
}

/**
 * Downloads a text/CSV response as a file using the authenticated session.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/v1${path}`, { credentials: 'include' });
  if (!response.ok) {
    throw new ApiClientError(response.status, 'Download failed.', 'DOWNLOAD_FAILED');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const name = match?.[1] ?? fallbackName;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
