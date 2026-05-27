/**
 * Skeleton placeholder rows shown above the actively-streaming result table while operators
 * are being discovered/enriched.
 */
export function SkeletonRow() {
  return (
    <div class="animate-pulse flex items-start gap-3 border-t border-slate-100 px-4 py-3">
      <div class="h-3 w-6 rounded bg-slate-200" />
      <div class="flex-1 space-y-2">
        <div class="h-4 w-2/5 rounded bg-slate-200" />
        <div class="h-3 w-3/5 rounded bg-slate-100" />
      </div>
      <div class="h-3 w-24 rounded bg-slate-200" />
      <div class="h-3 w-16 rounded bg-slate-200" />
      <div class="h-3 w-1/3 rounded bg-slate-200" />
    </div>
  );
}

export function SkeletonStrip({ count = 3 }: { count?: number }) {
  return (
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 px-6 py-3">
        <div class="h-4 w-40 rounded bg-slate-200 animate-pulse" />
      </div>
      {Array.from({ length: count }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  );
}
