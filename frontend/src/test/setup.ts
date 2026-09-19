import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'

// Mock localStorage with a simple in-memory store
const store: Record<string, string> = {}

const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = String(value) },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  get length() { return Object.keys(store).length },
  key: (index: number) => Object.keys(store)[index] ?? null,
}

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true })

beforeEach(() => {
  localStorage.clear()
})
