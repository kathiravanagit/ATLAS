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
        navigate('/dashboard');
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Invalid credentials');
      }
    } catch {
      // Fallback: allow offline login
      if (email && password) {
        const user = {
          email, name: email.split('@')[0], role: 'inspector', id: 'INS-001', badge: 'OFFLINE'
        };
        setTokens('offline-token', 'offline-refresh', 3600, user);
        navigate('/dashboard');
      } else {
        setError('Enter valid credentials');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 relative overflow-hidden">

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-[11px] text-[#d4d4d8] font-medium tracking-wide">SECURE CHANNEL</span>
          </div>
        </div>

        <div className="bg-[#111111]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8">
          <div className="flex justify-center mb-6">
            <GovtBadge size={80} />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-white tracking-tight">ATLAS</h1>
            <p className="text-[13px] text-[#d4d4d8] mt-1.5">Advanced Threat Location & Alert System — Law Enforcement Portal</p>
          </div>

          {error && (
            <div className="bg-[#ef4444]/5 border border-[#ef4444]/10 rounded-xl p-3 mb-5">
              <span className="text-sm text-[#ef4444]">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[13px] text-[#e4e4e7] block mb-2 font-medium">Email</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d4d4d8]" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="investigator@cybercrime.gov.in"
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-base text-white placeholder-[#71717a] focus:outline-none focus:border-white/[0.15] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[#e4e4e7] block mb-2 font-medium">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d4d4d8]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-base text-white placeholder-[#71717a] focus:outline-none focus:border-white/[0.15] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#d4d4d8] hover:text-[#d4d4d8] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-b from-white to-[#e4e4e7] text-black text-base font-semibold rounded-xl hover:from-[#f4f4f5] hover:to-[#d4d4d8] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>
                  Sign In
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-sm text-[#71717a]">New official? </span>
            <Link to="/register" className="text-sm text-white hover:text-[#d4d4d8] transition-colors font-medium">Register here</Link>
          </div>

          {/* Quick Demo Login — hidden unless VITE_DEMO_MODE is set */}
          {import.meta.env.VITE_DEMO_MODE && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">Quick Demo Login</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Inspector', email: 'inspector@atlas.gov', password: 'inspector123', color: 'text-[#3b82f6]' },
                { label: 'Analyst', email: 'analyst@atlas.gov', password: 'analyst123', color: 'text-[#22c55e]' },
                { label: 'Bank Officer', email: 'bank@atlas.gov', password: 'bank123', color: 'text-[#f59e0b]' },
                { label: 'Admin', email: 'admin@atlas.gov', password: 'admin123', color: 'text-[#8b5cf6]' },
              ].map(demo => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => { setEmail(demo.email); setPassword(demo.password); }}
                  className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-left hover:bg-white/[0.06] transition-colors"
                >
                  <div className={`text-[11px] font-medium ${demo.color}`}>{demo.label}</div>
                  <div className="text-[9px] text-[#71717a] mt-0.5">{demo.email}</div>
                </button>
              ))}
            </div>
          </div>
          )}
        </div>

        <div className="mt-6 text-center space-y-2">
          <div className="inline-flex items-center gap-4 text-[10px] text-[#71717a]">
            <span>Ministry of Home Affairs</span>
            <span className="w-1 h-1 rounded-full bg-[#27272a]" />
            <span>National Cybercrime Reporting Portal</span>
          </div>
          <p className="text-[10px] text-[#27272a]">Officials only · All access is monitored and logged</p>
        </div>
      </motion.div>
    </div>
  );
}
