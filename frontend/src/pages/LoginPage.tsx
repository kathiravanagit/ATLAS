import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import GovtBadge from '../components/GovtBadge';
import { setTokens } from '@/lib/auth';

interface DemoCredential {
  label: string;
  email: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Explicit opt-in demo build only — never fake a session in production builds.
  const isDemoBuild = import.meta.env.VITE_DEMO_MODE === '1' || import.meta.env.VITE_DEMO_MODE === 'true';
  // Demo credentials come from the backend (DEMO_MODE only) so no passwords
  // are embedded in the JS bundle; buttons render without them if the fetch fails.
  const [demoCredentials, setDemoCredentials] = useState<DemoCredential[]>([]);

  useEffect(() => {
    if (!isDemoBuild) return;
    fetch('/api/auth/demo-credentials')
      .then(r => (r.ok ? r.json() : []))
      .then((rows: DemoCredential[]) => {
        if (Array.isArray(rows) && rows.length > 0) setDemoCredentials(rows);
      })
      .catch(() => {});
  }, [isDemoBuild]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setTokens(data.access_token, data.refresh_token, data.expires_in, data.user);
        navigate('/real');
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Invalid credentials');
      }
    } catch {
      setError('Unable to authenticate — service unavailable. Use /demo for the local synthetic console.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F6F6F3] flex flex-col">
      {/* Demo Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-1.5">
        <p className="text-center text-[11px] text-amber-800">
          <span className="font-semibold">Demonstration Portal</span>
          {' — '}
          Synthetic data only. Not connected to live systems.
        </p>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-[#E2E1DB] px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <GovtBadge size={28} />
          <div className="leading-tight">
            <div className="text-[11px] text-[#5F6368] font-medium">SIH 2026 Prototype</div>
            <div className="text-sm font-semibold text-[#1A1C1F]">ATLAS — Advanced Threat Location & Alert System</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[900px] grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left: Info Panel (hidden on mobile) */}
          <div className="hidden md:block">
            <p className="text-[12px] font-medium text-[#5F6368]">SIH 2026 · Problem statement 26184</p>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight text-[#1A1C1F]">
              Cybercrime investigation portal
            </h1>
            <p className="mt-3 max-w-[42ch] leading-relaxed text-[#43474C]">
              Rank cash-out locations from a complaint, see the records behind each rank, and keep every action on the
              audit trail.
            </p>
            <ol className="mt-8 space-y-4 border-t border-[#E2E1DB] pt-5">
              {[
                { num: '01', text: 'Complaint intake and risk scoring' },
                { num: '02', text: 'Ranked ATM locations with evidence' },
                { num: '03', text: 'Alerts, case actions and a verifiable record' },
              ].map((item) => (
                <li key={item.num} className="flex items-baseline gap-3">
                  <span className="num text-[11px] text-[#8A8D90]">{item.num}</span>
                  <span className="text-sm text-[#43474C]">{item.text}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Right: Login Form */}
          <div>
            <div className="rounded-xl border border-[#E2E1DB] bg-white p-6 md:p-8">
              <div className="mb-6 flex justify-center md:hidden">
                <GovtBadge size={56} />
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-semibold text-[#1A1C1F]">Sign in</h2>
                <p className="mt-1 text-sm text-[#5F6368]">Investigator console</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
                  <span className="text-sm text-[#B91C1C]">{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm text-[#33373B] block mb-1.5 font-medium">Email</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6368]" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="investigator@cybercrime.gov.in"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D2D1CA] rounded-lg text-sm text-[#1A1C1F] placeholder-[#8A8D90] focus:outline-none focus:border-[#17406F] focus:ring-1 focus:ring-[#17406F]/20 transition-colors duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[#33373B] block mb-1.5 font-medium">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6368]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#D2D1CA] rounded-lg text-sm text-[#1A1C1F] placeholder-[#8A8D90] focus:outline-none focus:border-[#17406F] focus:ring-1 focus:ring-[#17406F]/20 transition-colors duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6368] hover:text-[#33373B] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#17406F] text-white text-sm font-semibold rounded-lg hover:bg-[#12355B] transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              <div className="mt-4">
                {isDemoBuild ? (
                  <>
                    <span className="text-xs text-[#5F6368]">New here? </span>
                    <Link to="/register" className="text-xs font-medium text-[#17406F] transition-colors hover:text-[#12355B]">
                      Register
                    </Link>
                  </>
                ) : (
                  <span className="text-xs text-[#5F6368]">Request access through your department administrator.</span>
                )}
              </div>

              {/* Quick Demo Login — evaluation builds only.
                  Labels/emails are public demo identities; passwords are fetched
                  from the DEMO_MODE-only backend endpoint, never bundled. */}
              {isDemoBuild && (
                <div className="mt-5 border-t border-[#E2E1DB] pt-4">
                  <div className="mb-2 text-[11px] font-medium text-[#8A8D90]">Demo accounts</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Inspector', email: 'inspector@atlas.gov' },
                      { label: 'Analyst', email: 'analyst@atlas.gov' },
                      { label: 'Bank officer', email: 'bank@atlas.gov' },
                      { label: 'Admin', email: 'admin@atlas.gov' },
                    ].map(demo => (
                      <button
                        key={demo.label}
                        type="button"
                        onClick={() => {
                          setEmail(demo.email);
                          setPassword(demoCredentials.find(c => c.email === demo.email)?.password ?? '');
                        }}
                        className="rounded-lg border border-[#E2E1DB] bg-white px-3 py-2 text-left transition-colors hover:border-[#D2D1CA] hover:bg-[#F6F6F3]"
                      >
                        <div className="text-[12px] font-medium text-[#1A1C1F]">{demo.label}</div>
                        <div className="mt-0.5 truncate text-[11px] text-[#8A8D90]">{demo.email}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E2E1DB] bg-white px-6 py-4">
        <div className="text-center text-[11px] text-[#8A8D90]">
          Cybercrime Coordination Prototype · SIH 2026 · Not affiliated with any government body
        </div>
      </footer>
    </div>
  );
}
