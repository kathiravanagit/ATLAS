import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ScenarioRunner from '@/components/ScenarioRunner'

const mockAuthFetch = vi.fn()

vi.mock('@/lib/auth', () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}))

beforeEach(() => {
  mockAuthFetch.mockReset()
})

function okJson(payload: unknown) {
  return { ok: true, json: () => Promise.resolve(payload) }
}

const SCENARIOS = [
  { id: 'fast_upi_layering', name: 'Fast UPI Layering', description: 'Layering pattern.' },
]

const FLOW = {
  id: 'fast_upi_layering',
  name: 'Fast UPI Layering',
  description: 'Layering pattern.',
  case_id: 'CC-2026-0145',
  steps: ['Complaint filed', 'Mule accounts found'],
  prediction: {
    primary_location: { atm_id: 'PNY-005', location_name: 'Kurumbapet', risk_score: 88, expected_window: '19:00-21:00' },
  },
}

describe('ScenarioRunner', () => {
  it('lists scenarios and runs one click end-to-end', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(okJson(SCENARIOS))
      .mockResolvedValueOnce(okJson(FLOW))
    render(<ScenarioRunner />)
    await waitFor(() => expect(screen.getByText('Fast UPI Layering')).toBeDefined())
    fireEvent.click(screen.getByText('Fast UPI Layering'))
    await waitFor(() => expect(screen.getByText('Complaint filed')).toBeDefined())
    expect(screen.getByText(/PNY-005/).textContent).toContain('88')
    expect(mockAuthFetch).toHaveBeenCalledTimes(2)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/scenarios/fast_upi_layering')
  })

  it('shows an empty state when no scenarios are supplied', async () => {
    mockAuthFetch.mockResolvedValueOnce(okJson([]))
    render(<ScenarioRunner />)
    await waitFor(() => expect(screen.getByText('No scenarios supplied.')).toBeDefined())
  })

  it('surfaces run failures without crashing', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(okJson(SCENARIOS))
      .mockResolvedValueOnce({ ok: false, status: 500 })
    render(<ScenarioRunner />)
    await waitFor(() => expect(screen.getByText('Fast UPI Layering')).toBeDefined())
    fireEvent.click(screen.getByText('Fast UPI Layering'))
    await waitFor(() => expect(screen.getByText(/Scenario failed \(500\)/)).toBeDefined())
  })
})
