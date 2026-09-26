import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'motion/react';
import { useRef } from 'react';
import { Brain, MapPin, AlertTriangle, ArrowRight, Activity, Eye, Shield, BarChart3, Lock, Radio } from 'lucide-react';
import GovtBadge from './GovtBadge';

function useScrollReveal() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return { ref, isInView };
}

function ScrollRevealSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isInView } = useScrollReveal();
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CyberShieldSVG() {
  return (
    <svg viewBox="0 0 400 360" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Background glow */}
      <defs>
        <radialGradient id="glow" cx="50%" cy="45%" r="45%">
          <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shieldGrad" x1="200" y1="40" x2="200" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#12355B" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <circle cx="200" cy="170" r="160" fill="url(#glow)" />

      {/* Shield */}
      <path d="M200 50 L300 95 L300 190 C300 250 200 310 200 310 C200 310 100 250 100 190 L100 95 Z"
        fill="url(#shieldGrad)" fillOpacity="0.9" stroke="#1D4ED8" strokeWidth="1.5" />

      {/* Inner shield lines */}
      <path d="M200 75 L280 112 L280 185 C280 235 200 285 200 285 C200 285 120 235 120 185 L120 112 Z"
        fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.3" />

      {/* Crosshair */}
      <circle cx="200" cy="170" r="35" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.6" />
      <circle cx="200" cy="170" r="18" fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.4" />
      <line x1="200" y1="145" x2="200" y2="195" stroke="white" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="175" y1="170" x2="225" y2="170" stroke="white" strokeWidth="0.8" strokeOpacity="0.5" />

      {/* Data nodes */}
      {[
        { x: 155, y: 130, r: 4 },
        { x: 245, y: 130, r: 3 },
        { x: 200, y: 110, r: 3.5 },
        { x: 175, y: 200, r: 3 },
        { x: 225, y: 200, r: 4 },
        { x: 200, y: 230, r: 3 },
      ].map((node, i) => (
        <g key={i}>
          <circle cx={node.x} cy={node.y} r={node.r} fill="white" fillOpacity="0.9" />
          <circle cx={node.x} cy={node.y} r={node.r + 4} fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.3" />
        </g>
      ))}

      {/* Connection lines */}
      <line x1="155" y1="130" x2="200" y2="110" stroke="white" strokeWidth="0.6" strokeOpacity="0.3" />
      <line x1="245" y1="130" x2="200" y2="110" stroke="white" strokeWidth="0.6" strokeOpacity="0.3" />
      <line x1="200" y1="110" x2="200" y2="170" stroke="white" strokeWidth="0.6" strokeOpacity="0.3" />
      <line x1="155" y1="130" x2="175" y2="200" stroke="white" strokeWidth="0.6" strokeOpacity="0.2" />
      <line x1="245" y1="130" x2="225" y2="200" stroke="white" strokeWidth="0.6" strokeOpacity="0.2" />
      <line x1="175" y1="200" x2="200" y2="230" stroke="white" strokeWidth="0.6" strokeOpacity="0.2" />
      <line x1="225" y1="200" x2="200" y2="230" stroke="white" strokeWidth="0.6" strokeOpacity="0.2" />

      {/* Signal rings */}
      <circle cx="200" cy="170" r="55" fill="none" stroke="#1D4ED8" strokeWidth="0.5" strokeOpacity="0.2" strokeDasharray="4 4" />
      <circle cx="200" cy="170" r="75" fill="none" stroke="#1D4ED8" strokeWidth="0.5" strokeOpacity="0.15" strokeDasharray="6 6" />
    </svg>
  );
}

function DashboardMockupSVG() {
  return (
    <svg viewBox="0 0 600 380" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto rounded-lg">
      {/* Background */}
      <rect width="600" height="380" rx="8" fill="#F8F9FA" />
      <rect x="1" y="1" width="598" height="378" rx="8" stroke="#E5E7EB" strokeWidth="1" />

      {/* Top bar */}
      <rect width="600" height="36" rx="8" fill="#12355B" />
      <rect y="28" width="600" height="8" fill="#12355B" />
      <rect x="16" y="10" width="80" height="16" rx="3" fill="white" fillOpacity="0.15" />
      <text x="24" y="22" fill="white" fontSize="8" fontFamily="Noto Sans" fontWeight="600">ATLAS</text>
      <circle cx="560" cy="18" r="6" fill="white" fillOpacity="0.2" />
      <circle cx="540" cy="18" r="6" fill="white" fillOpacity="0.2" />

      {/* Stat cards row */}
      {[
        { x: 16, label: 'Active Cases', value: '23', color: '#1D4ED8' },
        { x: 160, label: 'Alerts Today', value: '14', color: '#B45309' },
        { x: 304, label: 'Avg Lead Time', value: '4.2h', color: '#15803D' },
        { x: 448, label: 'Risk Score', value: '76%', color: '#B91C1C' },
      ].map((card, i) => (
        <g key={i}>
          <rect x={card.x} y="48" width="132" height="60" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="0.8" />
          <text x={card.x + 12} y="66" fill="#6B7280" fontSize="7" fontFamily="Noto Sans">{card.label}</text>
          <text x={card.x + 12} y="88" fill={card.color} fontSize="18" fontFamily="Noto Sans" fontWeight="700">{card.value}</text>
        </g>
      ))}

      {/* Map area */}
      <rect x="16" y="120" width="340" height="244" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="0.8" />
      <text x="28" y="140" fill="#1F2937" fontSize="8" fontFamily="Noto Sans" fontWeight="600">Risk Map — Puducherry</text>
      {/* Simplified map dots */}
      {[
        { x: 120, y: 200, r: 8, opacity: 0.6, color: '#B91C1C' },
        { x: 200, y: 180, r: 6, opacity: 0.4, color: '#B45309' },
        { x: 160, y: 240, r: 5, opacity: 0.3, color: '#1D4ED8' },
        { x: 250, y: 220, r: 4, opacity: 0.2, color: '#6B7280' },
        { x: 100, y: 280, r: 4, opacity: 0.2, color: '#6B7280' },
        { x: 280, y: 260, r: 3, opacity: 0.15, color: '#6B7280' },
      ].map((dot, i) => (
        <g key={i}>
          <circle cx={dot.x} cy={dot.y} r={dot.r + 6} fill={dot.color} fillOpacity={dot.opacity * 0.2} />
          <circle cx={dot.x} cy={dot.y} r={dot.r} fill={dot.color} fillOpacity={dot.opacity} />
        </g>
      ))}

      {/* Risk table */}
      <rect x="372" y="120" width="212" height="244" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="0.8" />
      <text x="384" y="140" fill="#1F2937" fontSize="8" fontFamily="Noto Sans" fontWeight="600">Ranked Locations</text>
      {[
        { rank: '1', atm: 'ATM-027, White Town', risk: '92%', color: '#B91C1C', barW: 92 },
        { rank: '2', atm: 'ATM-014, MG Road', risk: '78%', color: '#B45309', barW: 78 },
        { rank: '3', atm: 'ATM-031, Lawspet', risk: '64%', color: '#1D4ED8', barW: 64 },
        { rank: '4', atm: 'ATM-008, Kannicoil', risk: '51%', color: '#6B7280', barW: 51 },
        { rank: '5', atm: 'ATM-019, Nellithope', risk: '38%', color: '#9CA3AF', barW: 38 },
      ].map((row, i) => (
        <g key={i}>
          <text x="384" y={162 + i * 38} fill="#1F2937" fontSize="7" fontFamily="Noto Sans" fontWeight="500">{row.rank}. {row.atm}</text>
          <rect x="384" y={168 + i * 38} width={row.barW * 1.8} height="4" rx="2" fill={row.color} fillOpacity="0.2" />
          <rect x="384" y={168 + i * 38} width={row.barW * 1.8} height="4" rx="2" fill={row.color} fillOpacity="0.6" />
          <text x="560" y={174 + i * 38} fill={row.color} fontSize="7" fontFamily="Noto Sans" fontWeight="600">{row.risk}</text>
        </g>
      ))}
    </svg>
  );
}

const FEATURES = [
  {
    num: '1',
    icon: <AlertTriangle size={22} />,
    title: 'Complaint Received',
    desc: 'In a future authorised deployment, ATLAS could receive approved complaint and financial intelligence feeds. This SIH prototype demonstrates the workflow using synthetic data.',
  },
  {
    num: '2',
    icon: <Brain size={22} />,
    title: 'AI Risk Prediction',
    desc: 'Machine learning models analyze transaction patterns, account networks, and geographic signals to pinpoint cash-out risk — ranked by likelihood.',
  },
  {
    num: '3',
    icon: <MapPin size={22} />,
    title: 'Location Intelligence',
    desc: 'Ranked ATM locations with confidence scores and time windows, so investigators can deploy with precision instead of guesswork.',
  },
  {
    num: '4',
    icon: <Eye size={22} />,
    title: 'Proactive Deployment',
    desc: 'Investigators receive near-real-time alerts with actionable intelligence in an authorised deployment — enabling interception before funds are withdrawn.',
  },
];

const STATS = [
  { value: '200K+', label: 'Synthetic Transactions', icon: <BarChart3 size={18} /> },
  { value: '97.7%', label: 'Model Accuracy', icon: <Brain size={18} /> },
  { value: '4.2h', label: 'Avg Lead Time', icon: <Radio size={18} /> },
  { value: '8', label: 'City Coverage', icon: <MapPin size={18} /> },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* ── Demo Notice ─────────────────────────────────── */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-1.5">
        <p className="text-center text-[11px] text-amber-800">
          <span className="font-semibold">Demonstration Portal</span>
          {' — '}
          This system uses synthetic data generated for SIH 2026 evaluation. Not connected to any live crime, banking, or government databases.
        </p>
      </div>

      {/* ── Header ──────────────────────────────────────── */}
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GovtBadge size={28} />
            <div className="leading-tight">
              <div className="text-[11px] text-[#6B7280] font-medium">SIH 2026 Prototype — Demonstration Portal</div>
              <div className="text-sm font-semibold text-[#1F2937] tracking-tight">ATLAS — Advanced Threat Location & Alert System</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')} className="px-5 py-2 bg-[#1D4ED8] text-white text-sm font-semibold rounded-lg hover:bg-[#1D355B] transition-all duration-200">
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F8F9FA] to-white">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1D4ED8]/5 border border-[#1D4ED8]/10 mb-6"
              >
                <Shield size={12} className="text-[#1D4ED8]" />
                <span className="text-[11px] font-medium text-[#1D4ED8]">Cybercrime Coordination Prototype</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-[#12355B] leading-[1.1] tracking-tight mb-6"
              >
                Predict fraud
                <br />
                <span className="text-[#1D4ED8]">before it happens.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                className="text-lg text-[#6B7280] leading-relaxed mb-8 max-w-lg"
              >
                ATLAS gives investigators the lead time they need to prevent cash-out fraud — analyzing complaint data in this synthetic-data prototype and predicting where stolen funds will be withdrawn.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex flex-wrap gap-3"
              >
                <button
                  onClick={() => navigate('/login')}
                  className="px-6 py-3 bg-[#1D4ED8] text-white font-semibold rounded-lg hover:bg-[#1D355B] transition-all duration-200 flex items-center gap-2"
                >
                  Access Investigator Console
                  <ArrowRight size={16} />
                </button>
                <a
                  href="https://cybercrime.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-white text-[#1F2937] font-medium rounded-lg border border-[#D1D5DB] hover:bg-[#F3F4F6] transition-all duration-200 flex items-center gap-2"
                >
                  <Lock size={14} />
                  Visit NCRP Information Portal
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
                className="mt-8 flex items-center gap-4 text-[11px] text-[#9CA3AF]"
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                  Synthetic data only
                </span>
                <span>·</span>
                <span>SIH 2026 Prototype</span>
                <span>·</span>
                <span>For law enforcement evaluation</span>
              </motion.div>
            </div>

            {/* Right: Shield Illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="hidden lg:flex justify-center"
            >
              <div className="w-[380px] h-[340px]">
                <CyberShieldSVG />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ───────────────────────────────────── */}
      <ScrollRevealSection>
        <section className="border-y border-[#E5E7EB] bg-[#FAFBFC]">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map((stat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#1D4ED8]/5 text-[#1D4ED8]">
                    {stat.icon}
                  </div>
                  <div>
                    <div className="text-xl font-bold text-[#12355B]">{stat.value}</div>
                    <div className="text-[11px] text-[#6B7280]">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollRevealSection>

      {/* ── How It Works (Numbered Features) ────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollRevealSection>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-[#12355B] mb-4">
                Built around how cybercrime investigations actually work
              </h2>
              <p className="text-[#6B7280] max-w-2xl mx-auto text-lg">
                From complaint filing to fraud prevention — ATLAS bridges the gap with predictive analytics and location intelligence.
              </p>
            </div>
          </ScrollRevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feat, i) => (
              <ScrollRevealSection key={i} delay={i * 0.1}>
                <div className="flex gap-5 p-6 bg-white rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] hover:shadow-sm transition-all duration-300 group">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#12355B] text-white flex items-center justify-center text-sm font-bold">
                    {feat.num}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#1F2937] mb-2 group-hover:text-[#1D4ED8] transition-colors duration-200">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-[#6B7280] leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              </ScrollRevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dashboard Preview ───────────────────────────── */}
      <section className="py-20 px-6 bg-[#F8F9FA]">
        <div className="max-w-6xl mx-auto">
          <ScrollRevealSection>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-[#12355B] mb-4">
                Investigator Console
              </h2>
              <p className="text-[#6B7280] max-w-xl mx-auto">
                Near-real-time risk maps in an authorised deployment, ranked locations, case management, and audit trails — all in one place.
              </p>
            </div>
          </ScrollRevealSection>

          <ScrollRevealSection delay={0.2}>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 md:p-8 shadow-sm">
              <DashboardMockupSVG />
            </div>
          </ScrollRevealSection>
        </div>
      </section>

      {/* ── CTA Section ─────────────────────────────────── */}
      <ScrollRevealSection>
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="p-10 bg-[#12355B] rounded-2xl">
              <Shield size={32} className="text-white/80 mx-auto mb-4" />
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Ready to Investigate?
              </h2>
              <p className="text-white/70 mb-8 max-w-lg mx-auto">
                Access the Investigator Console to view live predictions, risk maps, and case management tools.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3 bg-white text-[#12355B] font-semibold rounded-lg hover:bg-[#F3F4F6] transition-all duration-200 inline-flex items-center gap-2"
              >
                Enter Console
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </ScrollRevealSection>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-[#E5E7EB] bg-white px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GovtBadge size={20} />
              <span className="text-sm font-medium text-[#1F2937]">ATLAS — Advanced Threat Location & Alert System</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-[#9CA3AF]">
              <span>Unofficial SIH 2026 Prototype</span>
              <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
              <span>Cybercrime Coordination Prototype</span>
              <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
              <span>SIH 2026</span>
            </div>
          </div>
          <div className="mt-4 text-center text-[11px] text-[#9CA3AF]">
            For Evaluation Use Only · Synthetic Data · Not Connected to Live Systems · Not affiliated with any government body
          </div>
        </div>
      </footer>
    </div>
  );
}
