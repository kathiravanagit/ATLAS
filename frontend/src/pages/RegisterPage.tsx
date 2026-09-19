import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Building, BadgeCheck, ChevronRight } from 'lucide-react';
import GovtBadge from '../components/GovtBadge';
import CyberText from '../components/ui/cyber-text';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', badge: '' });
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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
        alert(err.detail || 'Registration failed');
      }
    } catch {
      alert('Backend not reachable');
    }
    setLoading(false);
  };

  const update = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 relative overflow-hidden">
      <CyberText density="bold" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-[11px] text-[#d4d4d8] font-medium tracking-wide">OFFICIAL REGISTRATION</span>
          </div>
        </div>

        <div className="bg-[#111111]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8">
          <div className="flex justify-center mb-5">
            <GovtBadge size={80} />
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-white tracking-tight">Create Official Account</h1>
            <p className="text-[13px] text-[#d4d4d8] mt-1.5">Register for investigator access</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-3.5">
            {pendingApproval ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#f59e0b]/10 mb-4">
                  <BadgeCheck size={32} className="text-[#f59e0b]" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">Registration Submitted</h2>
                <p className="text-sm text-[#d4d4d8] mb-4">
                  Your account has been created and is pending administrator approval.
                  You will be able to log in once an admin approves your account.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-[#27272a] text-white text-sm rounded-lg hover:bg-[#3f3f46] transition-colors"
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <>
            <div>
              <label className="text-[13px] text-[#e4e4e7] block mb-1.5 font-medium">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d4d4d8]" />
                <input
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="Inspector Name"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-base text-white placeholder-[#71717a] focus:outline-none focus:border-white/[0.15] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[#e4e4e7] block mb-1.5 font-medium">Email</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d4d4d8]" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="investigator@cybercrime.gov.in"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-base text-white placeholder-[#71717a] focus:outline-none focus:border-white/[0.15] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[#e4e4e7] block mb-1.5 font-medium">Department</label>
              <div className="relative">
                <Building size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d4d4d8]" />
                <input
                  value={form.department}
                  onChange={e => update('department', e.target.value)}
                  placeholder="Cybercrime Division"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-base text-white placeholder-[#71717a] focus:outline-none focus:border-white/[0.15] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[#e4e4e7] block mb-1.5 font-medium">Badge ID</label>
              <div className="relative">
                <BadgeCheck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d4d4d8]" />
                <input
                  value={form.badge}
                  onChange={e => update('badge', e.target.value)}
                  placeholder="IND-2026-XXXX"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-base text-white placeholder-[#71717a] focus:outline-none focus:border-white/[0.15] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[#e4e4e7] block mb-1.5 font-medium">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d4d4d8]" />
                <input
                  type="password"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-base text-white placeholder-[#71717a] focus:outline-none focus:border-white/[0.15] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-b from-white to-[#e4e4e7] text-black text-base font-semibold rounded-xl hover:from-[#f4f4f5] hover:to-[#d4d4d8] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                <>
                  Create Account
                  <ChevronRight size={16} />
                </>
              )}
            </button>
            </>
            )}
          </form>

          <div className="mt-5 text-center">
            <span className="text-sm text-[#71717a]">Already registered? </span>
            <Link to="/login" className="text-sm text-white hover:text-[#d4d4d8] transition-colors font-medium">Sign in</Link>
          </div>
        </div>

        <div className="mt-6 text-center space-y-2">
          <div className="inline-flex items-center gap-4 text-[10px] text-[#71717a]">
            <span>Ministry of Home Affairs</span>
            <span className="w-1 h-1 rounded-full bg-[#27272a]" />
            <span>National Cybercrime Reporting Portal</span>
          </div>
          <p className="text-[10px] text-[#27272a]">Officials only · All access is monitored and logged</p>
        </div>
      </div>
    </div>
  );
}
