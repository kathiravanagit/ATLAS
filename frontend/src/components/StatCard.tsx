import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'default' | 'error' | 'warning' | 'success';
  className?: string;
  style?: React.CSSProperties;
}

const colorMap = {
  default: 'bg-[#F3F4F6] text-[#1F2937]',
  success: 'bg-[#15803D]/10 text-[#15803D]',
  warning: 'bg-[#B45309]/10 text-[#B45309]',
  error: 'bg-[#B91C1C]/10 text-[#B91C1C]',
};

export default function StatCard({ icon: Icon, label, value, sub, color = 'default', className = '', style }: StatCardProps) {
  return (
    <div className={`card p-5 ${className}`} style={style}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-[#6B7280] uppercase tracking-wider mb-2">{label}</div>
          <div className="text-2xl font-bold text-[#1F2937]">{value}</div>
          {sub && <div className="text-sm text-[#6B7280] mt-1">{sub}</div>}
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
          <div className="h-3 w-24 bg-[#E5E7EB] rounded animate-pulse mb-3" />
          <div className="h-7 w-16 bg-[#E5E7EB] rounded animate-pulse mb-1" />
          <div className="h-3 w-20 bg-[#E5E7EB] rounded animate-pulse" />
        </div>
        <div className="h-9 w-9 bg-[#E5E7EB] rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
