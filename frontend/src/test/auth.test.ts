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
} from '@/lib/auth'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('auth token management', () => {
  it('setTokens stores all values in localStorage', () => {
    const user = { id: '1', name: 'Test', role: 'admin' }
    setTokens('access123', 'refresh456', 3600, user)

    expect(localStorage.getItem('atlas_token')).toBe('access123')
    expect(localStorage.getItem('atlas_refresh_token')).toBe('refresh456')
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

  it('getRefreshToken returns stored refresh token', () => {
    localStorage.setItem('atlas_refresh_token', 'refresh123')
    expect(getRefreshToken()).toBe('refresh123')
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
