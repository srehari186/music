import { AudioLines } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/home" className="flex items-center gap-2.5 focus-ring rounded-xl" aria-label="Waveora home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-aqua shadow-glow">
        <AudioLines className="h-5 w-5 text-white" aria-hidden />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-lg font-extrabold tracking-tight">Waveora</span>
          <span className="block text-[11px] uppercase tracking-[0.2em] text-white/50">Ride your wave</span>
        </span>
      )}
    </Link>
  )
}
