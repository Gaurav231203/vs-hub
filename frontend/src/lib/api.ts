let currentAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setApiAccessToken(token: string | null) {
  currentAccessToken = token;
}

export function getApiAccessToken(): string | null {
  return currentAccessToken;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `/api/v1${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth && currentAccessToken) {
    headers.set('Authorization', `Bearer ${currentAccessToken}`);
  }

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 with single-flight token refresh
  if (response.status === 401 && !options.skipAuth && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const res = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!res.ok) {
            setApiAccessToken(null);
            return null;
          }

          const data = await res.json();
          setApiAccessToken(data.accessToken);
          return data.accessToken as string;
        } catch {
          setApiAccessToken(null);
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    const newToken = await refreshPromise;
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      // Refresh failed -> session expired
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error?.message || response.statusText);
    (error as any).status = response.status;
    (error as any).code = data.error?.code || 'UNKNOWN';
    (error as any).details = data.error?.details;
    throw error;
  }

  return data as T;
}
