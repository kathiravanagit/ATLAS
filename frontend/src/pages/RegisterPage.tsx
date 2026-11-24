import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Building, BadgeCheck, ChevronRight } from 'lucide-react';
import GovtBadge from '../components/GovtBadge';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' });
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: 'analyst',
          department: form.department,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user?.pending_approval) {
          setPendingApproval(true);
        } else {
          navigate('/login');
        }
      } else {
        const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
        setError(err.detail || 'Registration failed');
      }
    } catch {
      setError('Unable to reach the server — please try again later.');
    }
    setLoading(false);
  };

  const update = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const inputClass =
    'w-full rounded-lg border border-[#D2D1CA] bg-white py-2 pl-9 pr-3 text-sm text-[#1A1C1F] placeholder-[#8A8D90] transition-colors focus:border-[#17406F] focus:outline-none';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F6F3] px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-5 flex items-center justify-center gap-2.5">
          <GovtBadge size={28} />
          <span className="text-[13px] font-semibold text-[#1A1C1F]">ATLAS</span>
        </div>

        <div className="rounded-xl border border-[#E2E1DB] bg-white p-7">
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-[#1A1C1F]">Create an account</h1>
            <p className="mt-1 text-[13px] text-[#43474C]">
              Investigator access for the SIH 2026 prototype. A district administrator approves new accounts.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-3.5">
            {error && (
              <div className="rounded-lg border border-[#B91C1C]/25 bg-[#B91C1C]/5 p-3" role="alert">
                <span className="text-[13px] text-[#B91C1C]">{error}</span>
              </div>
            )}
            {pendingApproval ? (
              <div className="py-6 text-center">
                <BadgeCheck size={26} className="mx-auto mb-3 text-[#B45309]" aria-hidden="true" />
                <h2 className="mb-1.5 text-[15px] font-medium text-[#1A1C1F]">Registration submitted</h2>
                <p className="mb-4 text-[13px] leading-relaxed text-[#43474C]">
                  The account exists and waits for an administrator. Sign-in works once it is approved.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="rounded-lg border border-[#D2D1CA] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1C1F] transition-colors hover:bg-[#FAFAF7]"
                >
                  Go to sign in
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="reg-name" className="mb-1.5 block text-[12px] text-[#43474C]">Full name</label>
                  <div className="relative">
                    <User size={15} strokeWidth={1.6} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8D90]" aria-hidden="true" />
                    <input
                      id="reg-name"
                      value={form.name}
                      onChange={e => update('name', e.target.value)}
                      placeholder="Inspector name"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-email" className="mb-1.5 block text-[12px] text-[#43474C]">Email</label>
                  <div className="relative">
                    <User size={15} strokeWidth={1.6} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8D90]" aria-hidden="true" />
                    <input
                      id="reg-email"
                      type="email"
                      value={form.email}
                      onChange={e => update('email', e.target.value)}
                      placeholder="investigator@cybercrime.gov.in"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-department" className="mb-1.5 block text-[12px] text-[#43474C]">Department</label>
                  <div className="relative">
                    <Building size={15} strokeWidth={1.6} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8D90]" aria-hidden="true" />
                    <input
                      id="reg-department"
                      value={form.department}
                      onChange={e => update('department', e.target.value)}
                      placeholder="Cybercrime division"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-password" className="mb-1.5 block text-[12px] text-[#43474C]">Password</label>
                  <div className="relative">
                    <Lock size={15} strokeWidth={1.6} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8D90]" aria-hidden="true" />
                    <input
                      id="reg-password"
                      type="password"
                      value={form.password}
                      onChange={e => update('password', e.target.value)}
                      placeholder="••••••••••"
                      className={inputClass}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#17406F] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#12355B] disabled:opacity-50"
                >
                  {loading ? (
                    'Creating account…'
                  ) : (
                    <>
                      Create account
                      <ChevronRight size={16} aria-hidden="true" />
                    </>
                  )}
                </button>
              </>
            )}
          </form>

          <div className="mt-5 text-center">
            <span className="text-[13px] text-[#5F6368]">Already registered? </span>
            <Link to="/login" className="text-[13px] font-medium text-[#17406F] transition-colors hover:text-[#12355B]">Sign in</Link>
          </div>
        </div>

        <div className="mt-5 space-y-1.5 text-center text-[11px] text-[#8A8D90]">
          <p>SIH 2026 prototype · synthetic data only</p>
          <p>Access is logged · not affiliated with any government body</p>
        </div>
      </div>
    </div>
  );
}
