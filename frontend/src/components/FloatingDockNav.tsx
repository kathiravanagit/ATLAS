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
} from '@tabler/icons-react';

const NAV_ITEMS = [
  { path: '/real', icon: IconHome, label: 'Home' },
  { path: '/real/predictions', icon: IconBrain, label: 'Predictions' },
  { path: '/real/map', icon: IconMap, label: 'Risk Map' },
  { path: '/real/cases', icon: IconFolderOpen, label: 'Cases' },
  { path: '/real/alerts', icon: IconBell, label: 'Alerts' },
  { path: '/real/evidence', icon: IconFileSearch, label: 'Evidence' },
  { path: '/real/audit', icon: IconClipboardList, label: 'Audit Log' },
  { path: '/real/data-privacy', icon: IconShield, label: 'Data & Privacy' },
];

export default function FloatingDockNav({ activeView }: { activeView: string }) {
  const navigate = useNavigate();
  const location = useLocation();

  const links = NAV_ITEMS.map(item => ({
    title: item.label,
    icon: <item.icon className="h-full w-full text-[#e4e4e7]" />,
    href: item.path,
    onClick: () => navigate(item.path),
    active: item.path === '/real'
      ? location.pathname === '/real'
      : location.pathname.startsWith(item.path),
  }));

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]">
      <FloatingDock
        items={links}
        desktopClassName="bg-[#18181b] border border-[#27272a]"
        mobileClassName="translate-y-20"
      />
    </div>
  );
}
