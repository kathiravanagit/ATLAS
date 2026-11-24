interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A figure, its label, and what it counts. No icon tile, no colour coding:
 * the number carries the emphasis and the note says what it is not.
 * A phrase in place of a number ("Not measured") sets at reading size
 * instead of shouting at figure size.
 */
export default function StatCard({ label, value, sub, className = '', style }: StatCardProps) {
  const text = String(value);
  const isFigure = typeof value === 'number' || /^[₹]?[\d,]*\.?\d+%?$/.test(text.trim());

  return (
    <div className={`card flex flex-col p-4 ${className}`} style={style}>
      <div className="text-[12px] text-[#5F6368]">{label}</div>
      <div className="mt-2">
        {isFigure ? (
          <span className="num block text-[26px] font-medium leading-none text-[#1A1C1F]">{text}</span>
        ) : (
          <span className="block text-[15px] font-medium leading-snug text-[#1A1C1F]">{text}</span>
        )}
      </div>
      {sub && <div className="mt-2 text-[11px] leading-snug text-[#8A8D90]">{sub}</div>}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-4">
      <div className="mb-3 h-3 w-24 animate-pulse rounded bg-[#E2E1DB]" />
      <div className="mb-2 h-7 w-16 animate-pulse rounded bg-[#E2E1DB]" />
      <div className="h-3 w-20 animate-pulse rounded bg-[#E2E1DB]" />
    </div>
  );
}
