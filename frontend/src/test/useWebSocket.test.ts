import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from '@/hooks/useWebSocket'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  onerror: (() => void) | null = null
  readyState = 0 // CONNECTING
  sent: string[] = []
  private _listeners: Record<string, ((...args: unknown[]) => void)[]> = {}

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    setTimeout(() => {
      this.readyState = 1 // OPEN
      this.onopen?.()
    }, 0)
  }

  addEventListener(type: string, fn: (...args: unknown[]) => void) {
    if (!this._listeners[type]) this._listeners[type] = []
    this._listeners[type].push(fn)
  }

  removeEventListener(type: string, fn: (...args: unknown[]) => void) {
    this._listeners[type] = (this._listeners[type] || []).filter(f => f !== fn)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close(code = 1000, reason = '') {
    this.readyState = 3
    this.onclose?.({ code, reason })
  }

  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

beforeEach(() => {
  MockWebSocket.instances = []
  vi.stubGlobal('WebSocket', MockWebSocket)
  // Mock authFetch to return a ticket
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ ticket: 'test-ticket-abc123' }),
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useWebSocket', () => {
  it('connects to the WebSocket URL with ticket', async () => {
    renderHook(() => useWebSocket('/ws/alerts'))
    // Wait for the ticket fetch to resolve and WS to connect
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(MockWebSocket.instances.length).toBe(1)
    expect(MockWebSocket.instances[0].url).toContain('/ws/alerts')
    expect(MockWebSocket.instances[0].url).toContain('ticket=test-ticket-abc123')
    expect(MockWebSocket.instances[0].url).not.toContain('token=')
  })

  it('sets connected to true on open', async () => {
    const { result } = renderHook(() => useWebSocket('/ws/alerts'))
    // Wait for ticket fetch + WS creation
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })

    // MockWebSocket auto-opens via setTimeout(0), so by now it should be connected
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.connected).toBe(true)
  })

  it('parses incoming messages', async () => {
    const { result } = renderHook(() => useWebSocket('/ws/alerts'))
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })

    await act(async () => {
      MockWebSocket.instances[0].onopen?.()
    })

    await act(async () => {
      MockWebSocket.instances[0].simulateMessage({ type: 'alert', message: 'test' })
    })
    expect(result.current.lastMessage).toEqual({ type: 'alert', message: 'test' })
  })

  it('ignores pong messages', async () => {
    const { result } = renderHook(() => useWebSocket('/ws/alerts'))
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })

    await act(async () => {
      MockWebSocket.instances[0].onopen?.()
    })

    await act(async () => {
      MockWebSocket.instances[0].simulateMessage({ type: 'pong' })
    })
    expect(result.current.lastMessage).toBeNull()
  })

  it('send sends data when connected', async () => {
    const { result } = renderHook(() => useWebSocket('/ws/alerts'))
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })

    await act(async () => {
      MockWebSocket.instances[0].readyState = 1
      MockWebSocket.instances[0].onopen?.()
    })

    await act(async () => {
      result.current.send('ping')
    })
    expect(MockWebSocket.instances[0].sent).toContain('ping')
  })

  it('does not send when no WS connection exists', async () => {
    // Before the hook connects (before ticket fetch resolves), send should be a no-op
    const { result } = renderHook(() => useWebSocket('/ws/alerts'))
    // Immediately call send before any async work completes
    result.current.send('ping')
    // send is a no-op when wsRef.current is null — just verify no error thrown
  })
})
