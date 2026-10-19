import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReviewQueue from '../components/ReviewQueue';

vi.mock('@/lib/auth', () => ({
  isDemoRoute: () => false,
  authFetch: vi.fn(),
}));
vi.mock('@/lib/roles', () => ({ can: () => true }));

type MockFn = ReturnType<typeof vi.fn>;

const queueItem = {
  case_id: 'CC-2026-0130',
  crime_type: 'Investment Fraud',
  amount: 210000,
  current_risk: 'High',
  victim_name: 'Victim A',
  status: 'active',
  assigned_to: 'INS-001',
  created_at: '2026-01-01',
  priority: 'High',
};

/** Loads the queue, opens the first decision form, returns the fetch mock. */
async function openDecisionForm(): Promise<MockFn> {
  const { authFetch } = await import('@/lib/auth');
  const fn = authFetch as unknown as MockFn;
  fn.mockImplementation((url: string) => {
    if (url === '/api/review/queue') {
      return Promise.resolve({ ok: true, json: async () => ({ queue: [queueItem] }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
  render(<ReviewQueue />);
  fireEvent.click(await screen.findByText('CC-2026-0130'));
  return fn;
}

const reasonInput = () => screen.getByPlaceholderText('Reason for review decision...');
const submitButton = () => screen.getByRole('button', { name: 'Submit' });

describe('ReviewQueue decision form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks a reason under the server minimum and issues no request', async () => {
    const fn = await openDecisionForm();
    fireEvent.change(reasonInput(), { target: { value: 'ok' } });

    // Mirrors backend/main.py: `len(reason.strip()) < 10` -> 422.
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(fn.mock.calls.some(c => String(c[0]) === '/api/review/CC-2026-0130')).toBe(false);
  });

  it('posts the decision without a client-supplied reviewer_id', async () => {
    const fn = await openDecisionForm();
    fireEvent.change(reasonInput(), {
      target: { value: '  Reviewed the ranked candidates  ' },
    });
    fireEvent.click(submitButton());

    await waitFor(() => expect(
      fn.mock.calls.some(c => String(c[0]) === '/api/review/CC-2026-0130'),
    ).toBe(true));

    const call = fn.mock.calls.find(c => String(c[0]) === '/api/review/CC-2026-0130');
    const init = call ? (call[1] as RequestInit) : undefined;
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ action: 'approve', reason: 'Reviewed the ranked candidates' });
  });

  it('surfaces a server rejection instead of failing silently', async () => {
    const fn = await openDecisionForm();
    fn.mockImplementation((url: string) => {
      if (url === '/api/review/CC-2026-0130') {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ detail: 'Case is already resolved; re-review is not allowed' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    fireEvent.change(reasonInput(), { target: { value: 'Attempting a re-review' } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(
      screen.getByText('Case is already resolved; re-review is not allowed'),
    ).toBeInTheDocument());
  });
});
