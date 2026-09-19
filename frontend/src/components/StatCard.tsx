import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'default' | 'error' | 'warning' | 'success';
}

const colorMap = {
  default: 'bg-[#27272a] text-[#e4e4e7]',
  success: 'bg-[#22c55e]/10 text-[#22c55e]',
  warning: 'bg-[#f59e0b]/10 text-[#f59e0b]',
  error: 'bg-[#ef4444]/10 text-[#ef4444]',
};

export default function StatCard({ icon: Icon, label, value, sub, color = 'default' }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-[#d4d4d8] uppercase tracking-wider mb-2">{label}</div>
          <div className="text-2xl font-bold text-white">{value}</div>
          {sub && <div className="text-sm text-[#d4d4d8] mt-1">{sub}</div>}
        </div>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-3 w-24 bg-[#27272a] rounded animate-pulse mb-3" />
          <div className="h-7 w-16 bg-[#27272a] rounded animate-pulse mb-1" />
          <div className="h-3 w-20 bg-[#27272a] rounded animate-pulse" />
        </div>
        <div className="h-9 w-9 bg-[#27272a] rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
