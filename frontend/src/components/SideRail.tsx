import { NavLink } from 'react-router-dom';
import {
  Activity,
  Bell,
  Brain,
  ClipboardList,
  FileSearch,
  FolderOpen,
  Globe2,
  LayoutDashboard,
  LineChart,
  Map,
  RefreshCw,
  ShieldCheck,
  UserCircle,
  Users,
} from 'lucide-react';
import GovtBadge from './GovtBadge';

type Item = { to: string; label: string; icon: typeof Activity };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Operations',
    items: [
      { to: '', label: 'Overview', icon: LayoutDashboard },
      { to: '/loop', label: 'Loop', icon: RefreshCw },
      { to: '/predictions', label: 'Predictions', icon: Brain },
      { to: '/map', label: 'Risk map', icon: Map },
      { to: '/cases', label: 'Cases', icon: FolderOpen },
      { to: '/alerts', label: 'Alerts', icon: Bell },
      { to: '/campaigns', label: 'Campaigns', icon: Users },
      { to: '/i4c', label: 'I4C summary', icon: Globe2 },
    ],
  },
  {
    title: 'Records',
    items: [
      { to: '/evidence', label: 'Evidence', icon: FileSearch },
      { to: '/audit', label: 'Audit log', icon: ClipboardList },
      { to: '/data-privacy', label: 'Data & privacy', icon: ShieldCheck },
    ],
  },
  {
    title: 'Reference',
    items: [
      { to: '/model-card', label: 'Model card', icon: LineChart },
      { to: '/health', label: 'System health', icon: Activity },
      { to: '/profile', label: 'Profile', icon: UserCircle },
    ],
  },
];

function NavRows({ base, orientation }: { base: string; orientation: 'rail' | 'strip' }) {
  return (
    <>
      {GROUPS.map(group => (
        <div key={group.title} className={orientation === 'rail' ? 'mt-5 first:mt-0' : 'contents'}>
          {orientation === 'rail' && (
            <div className="px-2 pb-1 text-[11px] font-medium text-[#8A8D90]">{group.title}</div>
          )}
          {group.items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to || 'root'}
              to={`${base}${to}`}
              end={to === ''}
              className={({ isActive }) =>
                [
                  orientation === 'rail'
                    ? 'flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px]'
                    : 'flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px]',
                  'transition-colors',
                  isActive
                    ? 'bg-[#EFEFEA] font-medium text-[#12355B]'
                    : 'text-[#43474C] hover:bg-[#F4F4F0] hover:text-[#1A1C1F]',
                ].join(' ')
              }
            >
              <Icon size={16} strokeWidth={1.6} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * The case-file rail: one fixed column on desktop.
 */
export default function SideRail({ base }: { base: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-[1000] hidden w-[248px] flex-col border-r border-[#E2E1DB] bg-white lg:flex">
      <div className="flex items-center gap-2.5 px-4 pb-5 pt-5">
        <GovtBadge size={26} />
        <div className="min-w-0 leading-tight">
          <div className="text-[13px] font-semibold text-[#1A1C1F]">ATLAS</div>
          <div className="truncate text-[11px] text-[#8A8D90]">Investigator console</div>
        </div>
      </div>
      <nav aria-label="Investigation console navigation" className="flex-1 overflow-y-auto px-3 pb-4">
        <NavRows base={base} orientation="rail" />
      </nav>
      <div className="border-t border-[#E2E1DB] px-4 py-3 text-[11px] leading-relaxed text-[#8A8D90]">
        SIH 2026 prototype
        <br />
        Synthetic data only
      </div>
    </aside>
  );
}

/**
 * The same rows as one scrollable strip on small screens.
 */
export function MobileNav({ base }: { base: string }) {
  return (
    <nav
      aria-label="Investigation console navigation"
      className="flex gap-1 overflow-x-auto border-b border-[#E2E1DB] bg-white px-3 py-2 lg:hidden"
    >
      <NavRows base={base} orientation="strip" />
    </nav>
  );
}
