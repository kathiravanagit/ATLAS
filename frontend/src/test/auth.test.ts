import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAccessToken,
  getRefreshToken,
  getUser,
  setTokens,
  clearTokens,
  isTokenExpired,
  authFetch,
  logout,
  updateStoredUser,
  refreshAccessToken,
} from '@/lib/auth'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('auth token management', () => {
  it('setTokens stores access session state but never the refresh token', () => {
    const user = { id: '1', name: 'Test', role: 'admin' }
    setTokens('access123', 'refresh456', 3600, user)

    expect(localStorage.getItem('atlas_token')).toBe('access123')
    expect(localStorage.getItem('atlas_refresh_token')).toBeNull()
    expect(JSON.parse(localStorage.getItem('investigator') || '{}')).toEqual(user)
    expect(localStorage.getItem('atlas_token_expires')).toBeTruthy()
  })

  it('getAccessToken returns stored token', () => {
    localStorage.setItem('atlas_token', 'mytoken')
    expect(getAccessToken()).toBe('mytoken')
  })

  it('getAccessToken returns null when not set', () => {
    expect(getAccessToken()).toBeNull()
  })

  it('getRefreshToken never exposes the HttpOnly refresh cookie', () => {
    localStorage.setItem('atlas_refresh_token', 'refresh123')
    expect(getRefreshToken()).toBeNull()
  })

  it('getUser parses JSON from localStorage', () => {
    localStorage.setItem('investigator', JSON.stringify({ name: 'Test' }))
    expect(getUser()).toEqual({ name: 'Test' })
  })

  it('getUser returns null for invalid JSON', () => {
    localStorage.setItem('investigator', 'not-json')
    expect(getUser()).toBeNull()
  })

  it('getUser returns null when not set', () => {
    expect(getUser()).toBeNull()
  })

  it('clearTokens removes all tokens', () => {
    setTokens('a', 'b', 3600, { id: '1' })
    clearTokens()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(getUser()).toBeNull()
  })

  it('isTokenExpired returns true when no expires value', () => {
    expect(isTokenExpired()).toBe(true)
  })

  it('isTokenExpired returns true when token is expired', () => {
    localStorage.setItem('atlas_token_expires', String(Date.now() - 10000))
    expect(isTokenExpired()).toBe(true)
  })

  it('isTokenExpired returns false when token is valid', () => {
    localStorage.setItem('atlas_token_expires', String(Date.now() + 60000))
    expect(isTokenExpired()).toBe(false)
  })

  it('isTokenExpired accounts for 30s buffer', () => {
    // Expires in 20 seconds (less than 30s buffer)
    localStorage.setItem('atlas_token_expires', String(Date.now() + 20000))
    expect(isTokenExpired()).toBe(true)
  })
})

describe('authFetch', () => {
  it('adds Authorization header when token exists', async () => {
    setTokens('test-token', 'refresh', 3600, {})
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', mockFetch)

    await authFetch('/api/test')
    expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }))
  })

  it('does not add Authorization header when no token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', mockFetch)

    await authFetch('/api/test')
    expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
    }))
  })

  it('redirects to /login on 401 when refresh fails', async () => {
    setTokens('expired-token', 'bad-refresh', 3600, {})
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 401 }) // refresh also fails
    vi.stubGlobal('fetch', mockFetch)

    const originalHref = window.location.href
    Object.defineProperty(window, 'location', { value: { href: originalHref }, writable: true })

    await expect(authFetch('/api/test')).rejects.toThrow('Session expired')
  })
})

describe('session safety regressions', () => {
  it('profile updates preserve the exact expiry timestamp and access token', () => {
    setTokens('token', '', 3600, { name: 'Before' });
    const expiry = localStorage.getItem('atlas_token_expires');
    updateStoredUser({ name: 'After' });
    expect(localStorage.getItem('atlas_token_expires')).toBe(expiry);
    expect(getAccessToken()).toBe('token');
    expect(getUser()).toEqual({ name: 'After' });
  });

  it('refreshes once for concurrent expired requests', async () => {
    setTokens('old', '', -1, {});
    let finish!: (value: unknown) => void;
    const mockFetch = vi.fn().mockImplementation((url: string) => url === '/api/auth/refresh'
      ? new Promise(resolve => { finish = resolve; })
      : Promise.resolve({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', mockFetch);
    const requests = [authFetch('/api/a'), authFetch('/api/b'), refreshAccessToken()];
    expect(mockFetch.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1);
    finish({ ok: true, json: async () => ({ access_token: 'new', expires_in: 3600, user: {} }) });
    await Promise.all(requests);
    expect(getAccessToken()).toBe('new');
    expect(mockFetch.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1);
  });

  it('blocks demo reads and mutations before token refresh or CSRF network calls', async () => {
    const location = window.location;
    Object.defineProperty(window, 'location', { value: { pathname: '/demo/predictions' }, writable: true });
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    try {
      setTokens('expired', '', -1, {});
      expect((await authFetch('/api/cases')).status).toBe(503);
      expect((await authFetch('/api/transactions', { method: 'POST' })).status).toBe(503);
      expect(await refreshAccessToken()).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { value: location, writable: true });
    }
  });
});

describe('logout', () => {
  it('clears all tokens after logout', async () => {
    setTokens('a', 'b', 3600, { id: '1' })
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    await logout()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(getUser()).toBeNull()
  })
})
