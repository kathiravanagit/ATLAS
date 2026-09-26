import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, Lock, Activity, MapPin, Bell, ArrowLeft } from 'lucide-react';
import GovtBadge from '../components/GovtBadge';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const data = localStorage.getItem('investigator');
    if (data) {
      try {
        setUser(JSON.parse(data));
      } catch {
        localStorage.removeItem('investigator');
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('investigator');
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen relative bg-[#F8F9FA]">
      <header className="relative z-20 h-14 border-b border-[#D1D5DB] flex items-center px-6 bg-[#1D355B]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
            title="Back to Home"
          >
            <ArrowLeft size={14} className="text-white" />
          </button>
          <GovtBadge size={28} />
          <span className="text-base font-semibold text-white tracking-tight">ATLAS</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center border border-white/20">
              <span className="text-sm font-medium text-white">{user.name?.charAt(0)?.toUpperCase() || 'I'}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-white">{user.name || 'Investigator'}</div>
              <div className="text-[11px] text-white/70">{user.department || 'Cybercrime Division'}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-colors">
            <LogOut size={14} className="text-white" />
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <GovtBadge size={80} />
          </div>
          <h1 className="text-3xl font-bold text-[#1F2937] mb-2 tracking-tight">Welcome, {user.name || 'Investigator'}</h1>
          <p className="text-[#6B7280]">{user.department || 'Cybercrime Division'} · Badge: {user.badge || 'IND-2026-XXXX'}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="bg-white border border-[#D1D5DB] rounded-2xl p-5 text-center shadow-sm">
            <Activity size={24} className="text-[#6B7280] mx-auto mb-2" />
            <div className="text-2xl font-bold text-[#1F2937]">12</div>
            <div className="text-sm text-[#6B7280] mt-0.5">Active Cases</div>
          </div>
          <div className="bg-white border border-[#D1D5DB] rounded-2xl p-5 text-center shadow-sm">
            <MapPin size={24} className="text-[#ef4444] mx-auto mb-2" />
            <div className="text-2xl font-bold text-[#1F2937]">7</div>
            <div className="text-sm text-[#6B7280] mt-0.5">High-Risk ATMs</div>
          </div>
          <div className="bg-white border border-[#D1D5DB] rounded-2xl p-5 text-center shadow-sm">
            <Bell size={24} className="text-[#f59e0b] mx-auto mb-2" />
            <div className="text-2xl font-bold text-[#1F2937]">5</div>
            <div className="text-sm text-[#6B7280] mt-0.5">Pending Alerts</div>
          </div>
        </div>

        <div className="bg-white border border-[#D1D5DB] rounded-2xl p-8 text-center shadow-sm">
          <Lock size={32} className="text-[#6B7280] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#1F2937] mb-2">Investigator Console</h2>
          <p className="text-base text-[#6B7280] mb-6 max-w-md mx-auto">
              Access the full prediction dashboard with near-real-time risk scoring in an authorised deployment, case management, and alert system.
          </p>
          <button
            onClick={() => navigate('/real')}
            className="px-8 py-3 bg-[#1D4ED8] text-white text-base font-semibold rounded-xl hover:bg-[#1E40AF] transition-all inline-flex items-center gap-2"
          >
            Access Investigator Console
            <ArrowRight size={16} />
          </button>
          <p className="text-[11px] text-[#6B7280] mt-4">All activity is logged for audit compliance</p>
        </div>

        <div className="mt-8 text-center">
          <span className="text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
            Synthetic / Demo Data — For demonstration purposes only
          </span>
        </div>
      </main>
    </div>
  );
}
