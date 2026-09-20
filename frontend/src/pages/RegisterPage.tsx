import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Building, BadgeCheck, ChevronRight } from 'lucide-react';
import GovtBadge from '../components/GovtBadge';

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
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1D355B]/5 border border-[#1D355B]/10 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" />
            <span className="text-[11px] text-[#1D355B] font-medium tracking-wide">OFFICIAL REGISTRATION</span>
          </div>
        </div>

        <div className="bg-white border border-[#D1D5DB] rounded-2xl p-8 shadow-sm">
          <div className="flex justify-center mb-5">
            <GovtBadge size={80} />
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-[#1F2937] tracking-tight">Create Official Account</h1>
            <p className="text-[13px] text-[#6B7280] mt-1.5">Register for investigator access</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-3.5">
            {pendingApproval ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#B45309]/10 mb-4">
                  <BadgeCheck size={32} className="text-[#B45309]" />
                </div>
                <h2 className="text-lg font-semibold text-[#1F2937] mb-2">Registration Submitted</h2>
                <p className="text-sm text-[#6B7280] mb-4">
                  Your account has been created and is pending administrator approval.
                  You will be able to log in once an admin approves your account.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-[#F3F4F6] text-[#1F2937] text-sm rounded-lg hover:bg-[#E5E7EB] transition-colors"
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <>
            <div>
              <label className="text-[13px] text-[#374151] block mb-1.5 font-medium">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="Inspector Name"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D1D5DB] rounded-xl text-base text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]/20 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[#374151] block mb-1.5 font-medium">Email</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="investigator@cybercrime.gov.in"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D1D5DB] rounded-xl text-base text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]/20 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[#374151] block mb-1.5 font-medium">Department</label>
              <div className="relative">
                <Building size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  value={form.department}
                  onChange={e => update('department', e.target.value)}
                  placeholder="Cybercrime Division"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D1D5DB] rounded-xl text-base text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]/20 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[#374151] block mb-1.5 font-medium">Badge ID</label>
              <div className="relative">
                <BadgeCheck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  value={form.badge}
                  onChange={e => update('badge', e.target.value)}
                  placeholder="IND-2026-XXXX"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D1D5DB] rounded-xl text-base text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]/20 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[#374151] block mb-1.5 font-medium">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="password"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D1D5DB] rounded-xl text-base text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]/20 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1D4ED8] text-white text-base font-semibold rounded-xl hover:bg-[#1D355B] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#D1D5DB] border-t-[#1F2937] rounded-full animate-spin" />
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
            <span className="text-sm text-[#6B7280]">Already registered? </span>
            <Link to="/login" className="text-sm text-[#1D4ED8] hover:text-[#1D355B] transition-colors font-medium">Sign in</Link>
          </div>
        </div>

        <div className="mt-6 text-center space-y-2">
          <div className="inline-flex items-center gap-4 text-[11px] text-[#6B7280]">
            <span>Ministry of Home Affairs</span>
            <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
            <span>National Cybercrime Reporting Portal</span>
          </div>
          <p className="text-[11px] text-[#9CA3AF]">Officials only · All access is monitored and logged</p>
        </div>
      </div>
    </div>
  );
}
