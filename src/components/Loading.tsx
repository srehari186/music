import { Loader2 } from 'lucide-react'

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-white/60">{label}</p>
      </div>
    </div>
  )
}

export function SkeletonCards({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="skeleton aspect-square w-full" />
          <div className="space-y-2 p-3">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ButtonSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
}
