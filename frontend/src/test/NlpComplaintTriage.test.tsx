import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NlpComplaintTriage from '@/components/NlpComplaintTriage'

const mockAuthFetch = vi.fn()

vi.mock('@/lib/auth', () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}))

beforeEach(() => {
  mockAuthFetch.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

function mockTriageResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: () => Promise.resolve({
      category: 'UPI Fraud',
      keyword_match_score: 0.87,
      confidence_note: 'Keyword-based heuristic, not a calibrated ML model',
      priority: 'High',
      estimated_loss: 'Rs.35,000',
      entities: [
        { type: 'AMOUNT', value: 'Rs.35,000' },
        { type: 'BANK', value: 'SBI' },
      ],
      suggested_action: 'Block UPI ID. File complaint on cybercrime.gov.in.',
      crime_key: 'upi_fraud',
      ...overrides,
    }),
  }
}

describe('NlpComplaintTriage', () => {
  it('renders the triage input and button', () => {
    mockAuthFetch.mockResolvedValue({ ok: false })
    render(<NlpComplaintTriage />)
    expect(screen.getByPlaceholderText(/Paste or type a cybercrime complaint/)).toBeDefined()
    expect(screen.getByText('Triage')).toBeDefined()
  })

  it('renders quick demo buttons', () => {
    mockAuthFetch.mockResolvedValue({ ok: false })
    render(<NlpComplaintTriage />)
    expect(screen.getByText(/Quick demo complaints/)).toBeDefined()
  })

  it('shows result after successful triage', async () => {
    mockAuthFetch.mockResolvedValue(mockTriageResponse())
    render(<NlpComplaintTriage />)

    const textarea = screen.getByPlaceholderText(/Paste or type a cybercrime complaint/)
    fireEvent.change(textarea, { target: { value: 'UPI PIN used to transfer Rs.35000' } })
    fireEvent.click(screen.getByText('Triage'))

    await waitFor(() => {
      expect(screen.getByText('UPI Fraud')).toBeDefined()
    })
  })

  it('displays keyword match score instead of confidence', async () => {
    mockAuthFetch.mockResolvedValue(mockTriageResponse())
    render(<NlpComplaintTriage />)

    const textarea = screen.getByPlaceholderText(/Paste or type a cybercrime complaint/)
    fireEvent.change(textarea, { target: { value: 'UPI fraud Rs.35000' } })
    fireEvent.click(screen.getByText('Triage'))

    await waitFor(() => {
      expect(screen.getByText(/Keyword Match:/)).toBeDefined()
    })
    // Should NOT contain "Confidence:"
    expect(screen.queryByText(/Confidence:/)).toBeNull()
  })

  it('displays heuristic note', async () => {
    mockAuthFetch.mockResolvedValue(mockTriageResponse())
    render(<NlpComplaintTriage />)

    const textarea = screen.getByPlaceholderText(/Paste or type a cybercrime complaint/)
    fireEvent.change(textarea, { target: { value: 'UPI fraud' } })
    fireEvent.click(screen.getByText('Triage'))

    await waitFor(() => {
      expect(screen.getByText(/heuristic/)).toBeDefined()
    })
  })

  it('displays extracted entities', async () => {
    mockAuthFetch.mockResolvedValue(mockTriageResponse({
      entities: [
        { type: 'AMOUNT', value: 'Rs.35,000' },
        { type: 'BANK', value: 'SBI' },
        { type: 'LOCATION', value: 'Chennai' },
        { type: 'PLATFORM', value: 'Telegram' },
      ],
    }))
    render(<NlpComplaintTriage />)

    const textarea = screen.getByPlaceholderText(/Paste or type a cybercrime complaint/)
    fireEvent.change(textarea, { target: { value: 'UPI fraud Rs.35000 SBI Chennai Telegram' } })
    fireEvent.click(screen.getByText('Triage'))

    await waitFor(() => {
      expect(screen.getByText('Extracted Entities')).toBeDefined()
      expect(screen.getByText('SBI')).toBeDefined()
      expect(screen.getByText('Chennai')).toBeDefined()
      expect(screen.getByText('Telegram')).toBeDefined()
    })
  })

  it('displays suggested action', async () => {
    mockAuthFetch.mockResolvedValue(mockTriageResponse())
    render(<NlpComplaintTriage />)

    const textarea = screen.getByPlaceholderText(/Paste or type a cybercrime complaint/)
    fireEvent.change(textarea, { target: { value: 'UPI fraud' } })
    fireEvent.click(screen.getByText('Triage'))

    await waitFor(() => {
      expect(screen.getByText('Suggested Action')).toBeDefined()
      expect(screen.getByText(/Block UPI ID/)).toBeDefined()
    })
  })

  it('does not call API for empty input', () => {
    mockAuthFetch.mockResolvedValue({ ok: false })
    render(<NlpComplaintTriage />)

    fireEvent.click(screen.getByText('Triage'))
    expect(mockAuthFetch).not.toHaveBeenCalled()
  })

  it('shows analyzing state during API call', async () => {
    let resolvePromise: (value: unknown) => void
    mockAuthFetch.mockReturnValue(new Promise(resolve => { resolvePromise = resolve }))
    render(<NlpComplaintTriage />)

    const textarea = screen.getByPlaceholderText(/Paste or type a cybercrime complaint/)
    fireEvent.change(textarea, { target: { value: 'UPI fraud' } })
    fireEvent.click(screen.getByText('Triage'))

    await waitFor(() => {
      expect(screen.getByText('Analyzing...')).toBeDefined()
    })

    resolvePromise!(mockTriageResponse())
  })

  it('handles unrecognized complaint format gracefully', async () => {
    mockAuthFetch.mockResolvedValue(mockTriageResponse({
      category: 'General Cyber Fraud',
      keyword_match_score: 0.55,
      priority: 'Low',
    }))
    render(<NlpComplaintTriage />)

    const textarea = screen.getByPlaceholderText(/Paste or type a cybercrime complaint/)
    fireEvent.change(textarea, { target: { value: 'Something weird happened' } })
    fireEvent.click(screen.getByText('Triage'))

    await waitFor(() => {
      expect(screen.getByText('Unrecognized Complaint Format')).toBeDefined()
    })
  })

  it('displays priority with correct styling', async () => {
    mockAuthFetch.mockResolvedValue(mockTriageResponse({ priority: 'Critical' }))
    render(<NlpComplaintTriage />)

    const textarea = screen.getByPlaceholderText(/Paste or type a cybercrime complaint/)
    fireEvent.change(textarea, { target: { value: 'UPI fraud Rs.250000' } })
    fireEvent.click(screen.getByText('Triage'))

    await waitFor(() => {
      expect(screen.getByText('Critical')).toBeDefined()
    })
  })

  it('clicking demo button triggers triage', async () => {
    mockAuthFetch.mockResolvedValue(mockTriageResponse())
    render(<NlpComplaintTriage />)

    // Click the first demo button
    const demoButtons = screen.getAllByText(/\.\.\.$/)
    fireEvent.click(demoButtons[0])

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/nlp/triage', expect.objectContaining({
        method: 'POST',
      }))
    })
  })
})
