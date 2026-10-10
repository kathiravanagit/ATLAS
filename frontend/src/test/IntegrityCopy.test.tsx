import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SyntheticOperationalSimulation from '../components/SyntheticOperationalSimulation';
import DataPrivacyPage from '../pages/DataPrivacyPage';
import AlertPanel from '../components/AlertPanel';

vi.mock('../lib/auth', () => ({
  isDemoRoute: () => false,
  authFetch: vi.fn(async () => ({ ok: true, json: async () => [] })),
}));
vi.mock('../lib/roles', () => ({ can: () => false }));

describe('prototype integrity copy', () => {
  it('simulation metrics require evidence rather than claiming a measured fixture benchmark', () => {
    const { container } = render(<SyntheticOperationalSimulation />);
    expect(screen.getAllByText('Not measured')).toHaveLength(3);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(container.textContent).toContain('No operational benchmark has been measured or verified');
    expect(container.textContent).toContain('Requires labelled cash-out locations');
    expect(container.textContent).not.toMatch(/42\s*min|8\s*min|18\s*\/\s*day|72%|Reproducible fixture run/);
  });

  it('privacy describes prototype limitations, not verified calibration, legal compliance or invented explanations', () => {
    const { container } = render(<DataPrivacyPage />);
    expect(screen.getByText('Prototype Controls — Not Legal Compliance')).toBeInTheDocument();
    expect(container.textContent).toContain('Calibration to public fraud statistics has not been verified');
    expect(container.textContent).toContain('Complete logging of every data access is not established');
    expect(container.textContent).toContain('NPCI compliance have not been verified');
    expect(container.textContent).toContain('No real bank integration is implemented');
    expect(container.textContent).toContain('Explanation values are unavailable on this information page');
    expect(container.textContent).not.toMatch(/synthetic data calibrated to|Full PII encryption|All data access logged|NPCI Compliance|Compliance Framework|Every prediction is accompanied|Example SHAP output|200,000\+|200k|\d+(?:\.\d+)?%|\+0\.(?:288|104|081|050)/);
    expect(screen.getAllByText(/Not implemented;/)).toHaveLength(3);
  });

  it('notification copy limits enqueueing to new high-risk alert rows and disclaims atomic delivery', async () => {
    const { container } = render(<AlertPanel alerts={[]} onAcknowledge={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Notification log' }));
    await waitFor(() => expect(screen.getByText(/No notification jobs recorded/)).toBeInTheDocument());
    expect(container.textContent).toContain('HIGH-risk predictions and');
    expect(container.textContent).toContain('once per open case+ATM');
    expect(container.textContent).toContain('separate commits, not one atomic transaction');
    expect(container.textContent).toContain('TextBee/SMTP');
    expect(container.textContent).not.toMatch(/each alert enqueues|work transactionally|dispatch rows appear here once an alert is created/);
  });
});
