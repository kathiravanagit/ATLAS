import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import GovtBadge from './GovtBadge';

const RANKED = [
  { rank: '01', atm: 'ATM-027', place: 'White Town Main Road', score: 92 },
  { rank: '02', atm: 'ATM-014', place: 'MG Road Commercial', score: 78 },
  { rank: '03', atm: 'ATM-031', place: 'Lawspet Junction', score: 64 },
  { rank: '04', atm: 'ATM-009', place: 'Muthialpet Bazaar', score: 51 },
  { rank: '05', atm: 'ATM-022', place: 'Reddiarpalayam Town', score: 38 },
];

const STEPS = [
  {
    n: '01',
    title: 'A complaint is logged',
    body: 'Case, district, amount and the accounts named in the complaint. The record is the starting point, not a formality.',
  },
  {
    n: '02',
    title: 'Locations are ranked',
    body: 'The model orders ATM candidates by the evidence on file — transaction pattern, network, geography — and shows that evidence beside each rank.',
  },
  {
    n: '03',
    title: 'The list goes to the desk',
    body: 'Investigators get the ranked list, alerts on four channels, a block request for human review, and a tamper-evident record of every action.',
  },
];

const SURFACES = [
  {
    label: 'Alerts',
    title: 'Four channels, one signed record',
    body: 'Dashboard, SMS, email and an HMAC-signed webhook. Every dispatch is written to the audit trail before it leaves.',
  },
  {
    label: 'Campaigns and I4C',
    title: 'Across complaints, across districts',
    body: 'Destination accounts that recur across cases, and a national roll-up of counts by district with no case detail attached.',
  },
  {
    label: 'Evidence',
    title: 'A ledger that can be checked',
    body: 'Hash-chained records with export and verification. A local ledger, not a government blockchain, and the interface says so.',
  },
];

const LIMITS = [
  {
    term: 'No predicted hour',
    detail: 'The temporal forecast was measured on synthetic data and found absent (permutation p = 0.82). The console shows observed cash-out records instead of inventing a window.',
  },
  {
    term: 'No bank action',
    detail: 'The block button records a request for human review. It does not freeze an account and never claims a bank acted.',
  },
  {
    term: 'No real data',
    detail: 'Every figure on this site comes from synthetic fixtures generated for SIH 2026. No crime, banking or government system is connected.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#1A1C1F]">
      <div className="border-b border-[#E8E2D0] bg-[#FBF7EC] px-4 py-1">
        <p className="truncate text-center text-[11px] text-[#6B5B2E]">
          Demonstration portal · synthetic data for SIH 2026 · not connected to live crime, banking or government systems
        </p>
      </div>

      <header className="border-b border-[#E2E1DB] bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <GovtBadge size={28} />
            <div className="min-w-0 leading-tight">
              <div className="text-[14px] font-semibold">ATLAS</div>
              <div className="truncate text-[11px] text-[#8A8D90]">Advanced Threat Location &amp; Alert System</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/demo')}
              className="hidden text-[13px] font-medium text-[#43474C] transition-colors hover:text-[#1A1C1F] sm:block"
            >
              Local demo
            </button>
            <button
              onClick={() => navigate('/login')}
              className="rounded-lg bg-[#17406F] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#12355B]"
            >
              Sign in
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-12 md:px-8 lg:grid-cols-[1.02fr_1fr] lg:gap-14 lg:py-20">
          <div>
            <p className="text-[12px] font-medium text-[#5F6368]">SIH 2026 · Problem statement 26184</p>
            <h1 className="mt-3 max-w-[15ch] text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1A1C1F] md:text-[46px]">
              Rank the cash-out locations worth checking first
            </h1>
            <p className="mt-5 max-w-[54ch] text-[15px] leading-relaxed text-[#43474C]">
              ATLAS turns a cybercrime complaint into an ordered list of ATMs, with the cash-out records behind each rank.
              An investigation starts at the top of the list instead of across a whole city.
            </p>
            <p className="mt-3 max-w-[54ch] text-[13px] leading-relaxed text-[#5F6368]">
              Synthetic data only. The temporal forecast was measured and is not claimed.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#17406F] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#12355B]"
              >
                Open investigator console
                <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <button
                onClick={() => navigate('/demo')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D2D1CA] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1A1C1F] transition-colors hover:bg-[#EFEFEA]"
              >
                Local demo
                <ArrowUpRight size={15} strokeWidth={1.8} className="text-[#8A8D90]" />
              </button>
            </div>

            <dl className="mt-10 grid max-w-[420px] grid-cols-3 border-t border-[#E2E1DB] pt-4">
              {[
                ['8', 'cities'],
                ['64', 'ATM fixtures'],
                ['4', 'alert channels'],
              ].map(([value, label], i) => (
                <div key={label} className={i > 0 ? 'border-l border-[#E2E1DB] pl-4' : 'pr-4'}>
                  <dt className="num text-[17px] font-medium">{value}</dt>
                  <dd className="mt-0.5 text-[11px] text-[#5F6368]">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <figure className="w-full">
            <div className="overflow-hidden rounded-xl border border-[#E2E1DB] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#E2E1DB] px-4 py-3">
                <div className="min-w-0">
                  <div className="num text-[12px] text-[#43474C]">CC-2026-0147</div>
                  <div className="mt-0.5 text-[11px] text-[#8A8D90]">Puducherry · UPI fraud · ₹48,500</div>
                </div>
                <span className="shrink-0 rounded border border-[#B91C1C]/25 bg-[#B91C1C]/5 px-1.5 py-0.5 text-[11px] font-medium text-[#B91C1C]">
                  High risk
                </span>
              </div>

              <div className="flex items-baseline justify-between px-4 pb-1 pt-3 text-[11px] text-[#8A8D90]">
                <span>Ranked locations</span>
                <span>Display score</span>
              </div>

              <ol className="pb-2">
                {RANKED.map(row => (
                  <li
                    key={row.atm}
                    className="grid grid-cols-[28px_1fr_auto] items-baseline gap-2 px-4 py-2.5 hover:bg-[#FAFAF7]"
                  >
                    <span className="num text-[11px] text-[#8A8D90]">{row.rank}</span>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="num text-[12px] font-medium text-[#1A1C1F]">{row.atm}</span>
                      <span className="truncate text-[12px] text-[#43474C]">{row.place}</span>
                    </div>
                    <span className="num text-[13px] font-medium text-[#1A1C1F]">{row.score}</span>
                  </li>
                ))}
              </ol>

              <div className="border-t border-[#E2E1DB] px-4 py-2.5 text-[10px] leading-relaxed text-[#8A8D90]">
                Display score is relative priority, not a probability. Every row links to its evidence.
              </div>
            </div>
          </figure>
        </section>

        <section className="border-t border-[#E2E1DB] bg-white">
          <div className="mx-auto max-w-[1200px] px-5 py-14 md:px-8">
            <h2 className="max-w-[30ch] text-[24px] font-semibold leading-tight text-[#1A1C1F] md:text-[28px]">
              Built around the first hour of an investigation
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
              {STEPS.map(step => (
                <div key={step.n} className="border-t border-[#E2E1DB] pt-4">
                  <div className="num text-[11px] text-[#8A8D90]">{step.n}</div>
                  <h3 className="mt-2 text-[15px] font-semibold text-[#1A1C1F]">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#43474C]">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 py-14 md:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[24px] font-semibold leading-tight text-[#1A1C1F] md:text-[28px]">What sits behind the list</h2>
            <p className="text-[12px] text-[#5F6368]">Four notification channels · district-scoped access · evidence ledger</p>
          </div>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-[#E2E1DB] bg-[#E2E1DB] md:grid-cols-3">
            {SURFACES.map(surface => (
              <div key={surface.label} className="bg-white p-5">
                <div className="text-[11px] font-medium text-[#8A8D90]">{surface.label}</div>
                <h3 className="mt-2 text-[14px] font-semibold text-[#1A1C1F]">{surface.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#43474C]">{surface.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[#E2E1DB] bg-[#FBFBF8]">
          <div className="mx-auto max-w-[1200px] px-5 py-14 md:px-8">
            <h2 className="text-[24px] font-semibold leading-tight text-[#1A1C1F] md:text-[28px]">What it does not do</h2>
            <p className="mt-2 max-w-[65ch] text-[13px] leading-relaxed text-[#43474C]">
              Three limits a judge or an investigator should hear from us first, not find later.
            </p>
            <dl className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
              {LIMITS.map(limit => (
                <div key={limit.term} className="border-t border-[#D2D1CA] pt-4">
                  <dt className="text-[14px] font-semibold text-[#1A1C1F]">{limit.term}</dt>
                  <dd className="mt-2 text-[13px] leading-relaxed text-[#43474C]">{limit.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 py-14 md:px-8">
          <div className="flex flex-col gap-6 rounded-xl bg-[#12355B] px-6 py-8 text-white md:flex-row md:items-center md:justify-between md:px-10">
            <div>
              <h2 className="text-[22px] font-semibold leading-tight">Start at the top of the list</h2>
              <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-white/70">
                The console runs on synthetic fixtures. Sign in with a demo account or open the local demo without a
                backend.
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-white px-5 py-2.5 text-[14px] font-medium text-[#12355B] transition-colors hover:bg-[#F0F0EC] md:self-auto"
            >
              Open the console
              <ArrowRight size={16} strokeWidth={1.8} />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E2E1DB] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-2.5">
            <GovtBadge size={20} />
            <span className="text-[12px] text-[#43474C]">ATLAS · SIH 2026 prototype · Team FIGHT CLUB</span>
          </div>
          <div className="text-[11px] text-[#8A8D90]">
            Evaluation use only · synthetic data · not affiliated with any government body
          </div>
        </div>
      </footer>
    </div>
  );
}
