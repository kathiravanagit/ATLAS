import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AlertPanel from '../components/AlertPanel';

vi.mock('@/lib/auth', () => ({
  isDemoRoute: () => false,
  authFetch: vi.fn(),
}));
vi.mock('@/lib/roles', () => ({ can: () => true }));

const alert = {
  alert_id: 'ALT-1', case_id: 'CASE-001', message: 'ATLAS ALERT',
  risk_level: 'High', location: 'PNY-004, Muthialpet Bazaar',
  time_window: '18:00-20:00', timestamp: '10:00:00',
  acknowledged: false, acknowledged_at: null,
};

describe('Notify officer button', () => {
  it('posts one manual dispatch and shows the queued outcome', async () => {
    const { authFetch } = await import('@/lib/auth');
    (authFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'queued', dispatch: {
        sms: { queued: true }, email: { queued: true } } }),
    });
    render(<AlertPanel alerts={[alert]} onAcknowledge={() => {}} />);
    fireEvent.click(screen.getByText('Notify officer'));
    await waitFor(() => expect(screen.getByText(/SMS queued; Email queued/)).toBeDefined());
    expect(authFetch).toHaveBeenCalledWith('/api/alerts/ALT-1/notify',
      expect.objectContaining({ method: 'POST' }));
  });

  it('hides the button for acknowledged alerts', () => {
    render(<AlertPanel alerts={[{ ...alert, acknowledged: true }]} onAcknowledge={() => {}} />);
    expect(screen.queryByText('Notify officer')).toBeNull();
  });
});
