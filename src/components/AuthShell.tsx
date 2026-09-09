import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AudioLines } from 'lucide-react'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1440] via-[#0e0e1e] to-[#04222b]" />
        <div className="absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-primary/30 blur-[120px]" />
        <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-aqua/20 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-aqua shadow-glow">
              <AudioLines className="h-6 w-6 text-white" />
            </span>
            <span>
              <span className="block font-display text-2xl font-extrabold">Waveora</span>
              <span className="block text-xs uppercase tracking-[0.25em] text-white/50">Ride your wave</span>
            </span>
          </Link>
          <div>
            <h2 className="max-w-md font-display text-4xl font-extrabold leading-tight">
              Every mood has a <span className="bg-gradient-to-r from-primary-soft to-aqua-soft bg-clip-text text-transparent">frequency</span>.
            </h2>
            <p className="mt-4 max-w-md text-white/60">
              Stream hand-picked tracks, build playlists for every moment, and carry your sound everywhere. Original, fast, and free to start.
            </p>
            <div className="mt-8 flex gap-2">
              {['Focus', 'Workout', 'Chill', 'Party', 'Drive'].map((t) => (
                <span key={t} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/35">© 2026 Waveora Labs — original artwork & sound identity.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden" aria-label="Waveora home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-aqua">
              <AudioLines className="h-5 w-5 text-white" />
            </span>
            <span className="font-display text-xl font-extrabold">Waveora</span>
          </Link>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-white/60">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
