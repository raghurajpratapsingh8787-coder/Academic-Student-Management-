let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      if (!res.ok) {
        inMemoryAccessToken = null;
        return null;
      }
      const data = (await res.json()) as { accessToken?: string };
      inMemoryAccessToken = data.accessToken || null;
      return inMemoryAccessToken;
    } catch {
      inMemoryAccessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipAuthRefresh?: boolean } = {}
): Promise<T> {
  const { skipAuthRefresh, headers: customHeaders, body, ...rest } = options;
  const headers = new Headers(customHeaders);

  if (!(body instanceof FormData) && !headers.has('Content-Type') && body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }
  if (inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  let res = await fetch(path, {
    ...rest,
    body,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && !skipAuthRefresh && !path.startsWith('/api/auth/login')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(path, {
        ...rest,
        body,
        headers,
        credentials: 'include',
      });
    }
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }

  return data as T;
}

export async function fetchProtectedImageUrl(url: string): Promise<string | null> {
  const headers = new Headers();
  if (inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }
  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
