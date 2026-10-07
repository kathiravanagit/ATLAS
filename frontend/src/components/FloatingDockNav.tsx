import { useNavigate, useLocation } from 'react-router-dom';
import { FloatingDock } from '@/components/ui/floating-dock';
import {
  IconHome,
  IconBrain,
  IconMap,
  IconFolderOpen,
  IconBell,
  IconFileSearch,
  IconClipboardList,
  IconShield,
  IconChartLine,
  IconHeartbeat,
} from '@tabler/icons-react';

const NAV_ITEMS = [
  { path: '/real', icon: IconHome, label: 'Overview' },
  { path: '/real/predictions', icon: IconBrain, label: 'Predictions' },
  { path: '/real/map', icon: IconMap, label: 'Risk Map' },
  { path: '/real/cases', icon: IconFolderOpen, label: 'Cases' },
  { path: '/real/alerts', icon: IconBell, label: 'Alerts' },
  { path: '/real/evidence', icon: IconFileSearch, label: 'Evidence' },
  { path: '/real/audit', icon: IconClipboardList, label: 'Audit Log' },
  { path: '/real/data-privacy', icon: IconShield, label: 'Data & Privacy' },
  { path: '/real/model-card', icon: IconChartLine, label: 'Model Card' },
  { path: '/real/health', icon: IconHeartbeat, label: 'System Health' },
];

export default function FloatingDockNav({ activeView }: { activeView: string }) {
  const navigate = useNavigate();
  const location = useLocation();

  const base = location.pathname.startsWith('/demo') ? '/demo' : '/real';
    const links = NAV_ITEMS.map(original => {
      const item = { ...original, path: original.path.replace('/real', base) };
    const isActive = item.path === base
      ? location.pathname === base
      : location.pathname.startsWith(item.path);
    return {
      title: item.label,
      icon: (
        <div className="relative flex flex-col items-center justify-center">
          <item.icon className={`h-full w-full ${isActive ? 'text-[#1D4ED8]' : 'text-[#6B7280]'} transition-colors duration-200`} />
          {isActive && <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1D4ED8]" />}
        </div>
      ),
      href: item.path,
      onClick: () => navigate(item.path),
    };
  });

  return (
    <nav aria-label="Investigation console navigation" data-active-view={activeView} className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2">
      <FloatingDock
        items={links}
        desktopClassName="bg-white border border-[#D1D5DB]"
        mobileClassName=""
      />
    </nav>
  );
}
