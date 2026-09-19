/**
 * Token management with automatic refresh.
 */

const ACCESS_KEY = 'atlas_token';
const REFRESH_KEY = 'atlas_refresh_token';
const USER_KEY = 'investigator';
const EXPIRES_KEY = 'atlas_token_expires';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getUser(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setTokens(accessToken: string, refreshToken: string, expiresIn: number, user: Record<string, unknown>) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(EXPIRES_KEY, String(Date.now() + expiresIn * 1000));
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function isTokenExpired(): boolean {
  const expires = localStorage.getItem(EXPIRES_KEY);
  if (!expires) return true;
  return Date.now() > parseInt(expires, 10) - 30000; // 30s buffer
}

/**
 * Refresh the access token using the refresh token.
 * Returns new tokens or null if refresh fails.
 */
export async function refreshAccessToken(): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: Record<string, unknown>;
} | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token, data.expires_in, data.user);
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch with automatic token refresh on 401 and CSRF for state-changing methods.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getAccessToken();

  // Auto-refresh if expired
  if (token && isTokenExpired()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      token = refreshed.access_token;
    } else {
      // Redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Auto-fetch and include CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    try {
      const csrfRes = await fetch('/api/csrf-token', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
        if (csrfRes.ok) {
          const csrfData = await csrfRes.json();
          if (csrfData?.csrf_token) {
            headers['X-CSRF-Token'] = csrfData.csrf_token;
          }
        }
    } catch {}
  }

  const res = await fetch(url, { ...options, headers });

  // If 401, try refresh once
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryHeaders: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
        Authorization: `Bearer ${refreshed.access_token}`,
      };
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        try {
          const csrfRes = await fetch('/api/csrf-token', {
            headers: { Authorization: `Bearer ${refreshed.access_token}` },
          });
          if (csrfRes.ok) {
            const csrfData = await csrfRes.json();
            if (csrfData?.csrf_token) {
              retryHeaders['X-CSRF-Token'] = csrfData.csrf_token;
            }
          }
        } catch {}
      }
      return fetch(url, { ...options, headers: retryHeaders });
    }
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  return res;
}

/**
 * Logout: revoke refresh token and clear storage.
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken() || ''}`,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {}
  }
  clearTokens();
}

/**
 * Fetch current user profile from API.
 */
export async function fetchProfile(): Promise<Record<string, unknown> | null> {
  try {
    const res = await authFetch('/api/auth/me');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Update user profile.
 */
export async function updateProfile(data: { name?: string; badge?: string; department?: string }): Promise<boolean> {
  try {
    const csrfRes = await authFetch('/api/csrf-token');
    const csrfData = csrfRes.ok ? await csrfRes.json() : null;
    const csrfToken = csrfData?.csrf_token || '';

    const res = await authFetch('/api/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) return false;
    const result = await res.json();
    if (result.user) {
      const current = getUser() || {};
      setTokens(
        getAccessToken() || '',
        getRefreshToken() || '',
        parseInt(localStorage.getItem(EXPIRES_KEY || '') || '0') - Date.now(),
        { ...current, ...result.user },
      );
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Change user password.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const csrfRes = await authFetch('/api/csrf-token');
    const csrfData = csrfRes.ok ? await csrfRes.json() : null;
    const csrfToken = csrfData?.csrf_token || '';

    const res = await authFetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.detail || 'Failed to change password' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}
