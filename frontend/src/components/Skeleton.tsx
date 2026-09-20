export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#F3F4F6] rounded ${className}`} />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-7 w-16 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}

export function PredictionCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#D1D5DB] mb-4">
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-8 w-48 mb-3" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-[#D1D5DB]">
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlertSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 rounded-full" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="card h-[500px] flex items-center justify-center">
      <div className="text-center">
        <Skeleton className="h-8 w-8 rounded-full mx-auto mb-3" />
        <Skeleton className="h-4 w-32 mx-auto mb-1" />
        <Skeleton className="h-3 w-48 mx-auto" />
      </div>
    </div>
  );
}
