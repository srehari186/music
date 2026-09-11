import { useCallback, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AlbumCard } from './AlbumCard'
import type { AlbumGroup } from '../utils'

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel/40 px-6 py-10 text-center text-sm text-white/50">
      {message}
    </div>
  )
}

interface ShelfProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  albums: AlbumGroup[]
  emptyMessage: string
}

/**
 * Album shelf: swipe strip with arrow fallback on phones (tap steps,
 * hold glides to the first/last), card grid on tablets/desktops.
 */
export function AlbumShelf({ title, subtitle, icon, albums, emptyMessage }: ShelfProps) {
  const stripRef = useRef<HTMLDivElement | null>(null)
  const holdTimer = useRef<number | null>(null)
  const holdFired = useRef(false)

  const scrollStrip = useCallback((dir: 1 | -1) => {
    const el = stripRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }, [])

  const stopHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearInterval(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const startHold = useCallback(
    (dir: 1 | -1) => {
      holdFired.current = false
      scrollStrip(dir)
      stopHold()
      holdTimer.current = window.setInterval(() => {
        const el = stripRef.current
        if (!el) {
          stopHold()
          return
        }
        const max = el.scrollWidth - el.clientWidth
        if ((dir === 1 && el.scrollLeft >= max - 4) || (dir === -1 && el.scrollLeft <= 4)) {
          stopHold()
          return
        }
        holdFired.current = true
        scrollStrip(dir)
      }, 350)
    },
    [scrollStrip, stopHold]
  )

  useEffect(() => stopHold, [stopHold])

  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel">{icon}</span>
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
      </div>

      {albums.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <>
          <div className="relative sm:hidden">
            <div
              ref={stripRef}
              className="no-scrollbar -mx-1 flex touch-pan-x gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2"
            >
              {albums.map((a) => (
                <div key={a.key} className="w-32 shrink-0">
                  <AlbumCard album={a} />
                </div>
              ))}
            </div>
            {albums.length > 2 && (
              <>
                <button
                  onClick={() => {
                    if (holdFired.current) {
                      holdFired.current = false
                      return
                    }
                    scrollStrip(-1)
                  }}
                  onPointerDown={() => startHold(-1)}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onPointerCancel={stopHold}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label={`Scroll ${title} left (hold to glide to the first)`}
                  className="absolute left-0 top-[30%] grid h-9 w-9 -translate-y-1/2 touch-none place-items-center rounded-full border border-line bg-black/70 text-white backdrop-blur transition active:bg-primary focus-ring"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    if (holdFired.current) {
                      holdFired.current = false
                      return
                    }
                    scrollStrip(1)
                  }}
                  onPointerDown={() => startHold(1)}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onPointerCancel={stopHold}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label={`Scroll ${title} right (hold to glide to the last)`}
                  className="absolute right-0 top-[30%] grid h-9 w-9 -translate-y-1/2 touch-none place-items-center rounded-full border border-line bg-black/70 text-white backdrop-blur transition active:bg-primary focus-ring"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          <div className="hidden gap-4 sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {albums.map((a) => (
              <AlbumCard key={a.key} album={a} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
