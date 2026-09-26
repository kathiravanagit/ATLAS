import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, User, Eye, EyeOff, ChevronRight } from 'lucide-react';
import GovtBadge from '../components/GovtBadge';
import { setTokens } from '@/lib/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Explicit opt-in demo build only — never fake a session in production builds.
  const isDemoBuild = import.meta.env.VITE_DEMO_MODE === '1' || import.meta.env.VITE_DEMO_MODE === 'true';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      if (isDemoBuild && email && password) {
        const user = {
          email, name: email.split('@')[0], role: 'inspector', id: 'INS-001', badge: 'OFFLINE'
        };
        setTokens('offline-token', 'offline-refresh', 3600, user);
        navigate('/real');
      } else {
        setError('Unable to authenticate — service unavailable');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      {/* Demo Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-1.5">
        <p className="text-center text-[11px] text-amber-800">
          <span className="font-semibold">Demonstration Portal</span>
          {' — '}
          Synthetic data only. Not connected to live systems.
        </p>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <GovtBadge size={28} />
          <div className="leading-tight">
            <div className="text-[11px] text-[#6B7280] font-medium">Government of India</div>
            <div className="text-sm font-semibold text-[#1F2937]">ATLAS — Advanced Threat Location & Alert System</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[900px] grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left: Info Panel (hidden on mobile) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="hidden md:block"
          >
            <h1 className="text-3xl font-bold text-[#12355B] mb-4 leading-tight">
              Cybercrime
              <br />
              <span className="text-[#1D4ED8]">Investigation Portal</span>
            </h1>
            <p className="text-[#6B7280] mb-8 leading-relaxed">
              Predictive-analytics prototype for preventing cash-out fraud. Access the investigator console to view risk assessments.
            </p>
            <div className="space-y-4">
              {[
                { num: '1', text: 'Complaint analysis and risk scoring' },
                { num: '2', text: 'Ranked ATM location predictions' },
                { num: '3', text: 'Near-real-time alert and case management (authorised deployment)' },
              ].map((item) => (
                <div key={item.num} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-[#12355B] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {item.num}
                  </div>
                  <span className="text-sm text-[#4B5563]">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Login Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 md:p-8 shadow-sm">
              <div className="flex justify-center mb-6 md:hidden">
                <GovtBadge size={60} />
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-[#1F2937]">Sign In</h2>
                <p className="text-sm text-[#6B7280] mt-1">Access the Investigator Console</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
                  <span className="text-sm text-[#B91C1C]">{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm text-[#374151] block mb-1.5 font-medium">Email</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="investigator@cybercrime.gov.in"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]/20 transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[#374151] block mb-1.5 font-medium">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]/20 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#374151] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#1D4ED8] text-white text-sm font-semibold rounded-lg hover:bg-[#1D355B] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <>
                      Sign In
                      <ChevronRight size={14} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                {isDemoBuild ? (
                  <>
                    <span className="text-xs text-[#6B7280]">New official? </span>
                    <Link to="/register" className="text-xs text-[#1D4ED8] hover:text-[#1D355B] transition-colors font-medium">Register here</Link>
                  </>
                ) : (
                  <span className="text-xs text-[#6B7280]">Request access through your department administrator.</span>
                )}
              </div>

              {/* Quick Demo Login — evaluation builds only */}
              {isDemoBuild && (
                <div className="mt-5 pt-4 border-t border-[#E5E7EB]">
                  <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-2 font-medium">Quick Demo Login</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Inspector', email: 'inspector@atlas.gov', password: 'inspector123', color: 'text-[#1D4ED8]' },
                      { label: 'Analyst', email: 'analyst@atlas.gov', password: 'analyst123', color: 'text-[#15803D]' },
                      { label: 'Bank Officer', email: 'bank@atlas.gov', password: 'bank123', color: 'text-[#B45309]' },
                      { label: 'Admin', email: 'admin@atlas.gov', password: 'admin123', color: 'text-[#12355B]' },
                    ].map(demo => (
                      <button
                        key={demo.label}
                        type="button"
                        onClick={() => { setEmail(demo.email); setPassword(demo.password); }}
                        className="px-3 py-2 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg text-left hover:bg-[#F3F4F6] hover:border-[#D1D5DB] transition-all duration-200"
                      >
                        <div className={`text-[11px] font-medium ${demo.color}`}>{demo.label}</div>
                        <div className="text-[10px] text-[#9CA3AF] mt-0.5 truncate">{demo.email}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-white px-6 py-4">
        <div className="text-center text-[11px] text-[#9CA3AF]">
          Ministry of Home Affairs · Cybercrime Coordination Prototype · SIH 2026
        </div>
      </footer>
    </div>
  );
}
