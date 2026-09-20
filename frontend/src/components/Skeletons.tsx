function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`bg-[#F3F4F6] rounded animate-pulse ${className}`} />;
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card p-5">
            <SkeletonBar className="h-3 w-20 mb-3" />
            <SkeletonBar className="h-8 w-16 mb-2" />
            <SkeletonBar className="h-2 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <SkeletonBar className="h-4 w-32 mb-4" />
          <SkeletonBar className="h-48 w-full" />
        </div>
        <div className="card p-5">
          <SkeletonBar className="h-4 w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonBar className="h-2 w-2 rounded-full" />
                <SkeletonBar className="h-3 flex-1" />
                <SkeletonBar className="h-3 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PredictionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card p-5">
        <SkeletonBar className="h-4 w-40 mb-4" />
        <SkeletonBar className="h-10 w-full mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB]">
              <SkeletonBar className="h-2 w-16 mb-2" />
              <SkeletonBar className="h-8 w-12 mb-1" />
              <SkeletonBar className="h-2 w-10" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <SkeletonBar className="h-4 w-32 mb-4" />
          <SkeletonBar className="h-48 w-full" />
        </div>
        <div className="card p-5">
          <SkeletonBar className="h-4 w-32 mb-4" />
          <SkeletonBar className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="relative w-full h-[calc(100vh-180px)] min-h-[500px] rounded-xl overflow-hidden border border-[#D1D5DB]">
      <div className="absolute inset-0 bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <SkeletonBar className="h-3 w-32 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export function CasesSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-[#D1D5DB]">
        <SkeletonBar className="h-4 w-32 mb-3" />
        <div className="flex gap-2 mb-3">
          {[1, 2, 3, 4, 5].map(i => (
            <SkeletonBar key={i} className="h-6 w-16 rounded" />
          ))}
        </div>
        <SkeletonBar className="h-8 w-full" />
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 p-3 border border-[#D1D5DB] rounded-lg">
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="h-3 w-16" />
            <SkeletonBar className="h-3 w-8" />
            <SkeletonBar className="h-3 w-12" />
            <SkeletonBar className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlertsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <SkeletonBar className="h-4 w-24" />
        <SkeletonBar className="h-4 w-16" />
      </div>
      <div className="flex gap-1 mb-2">
        {[1, 2, 3].map(i => (
          <SkeletonBar key={i} className="h-6 w-16 rounded" />
        ))}
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-4 border-l-2 border-l-[#27272a]">
          <div className="flex items-start gap-3">
            <SkeletonBar className="h-3 w-3 rounded-full mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <SkeletonBar className="h-4 w-12" />
                <SkeletonBar className="h-3 w-20" />
              </div>
              <SkeletonBar className="h-3 w-full mb-2" />
              <SkeletonBar className="h-2 w-32" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EvidenceSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonBar className="h-4 w-40 mb-4" />
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <SkeletonBar className="h-4 w-4" />
            <SkeletonBar className="h-4 w-32" />
            <SkeletonBar className="h-4 w-16 ml-auto" />
          </div>
          <SkeletonBar className="h-3 w-full mb-1" />
          <SkeletonBar className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function AuditSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-[#D1D5DB]">
        <SkeletonBar className="h-4 w-24 mb-2" />
        <SkeletonBar className="h-3 w-40" />
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex items-center gap-3 p-2">
            <SkeletonBar className="h-2 w-2 rounded-full" />
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="h-3 flex-1" />
            <SkeletonBar className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
