import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Disc3, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { AlbumCard } from '../../components/AlbumCard'
import { SkeletonCards } from '../../components/Loading'
import { SearchBar } from '../../components/SearchBar'
import { fetchFeaturedSongs, fetchPopularSongs } from '../../services/songService'
import { friendlyError, groupSongsByAlbum } from '../../utils'

const PAGE_SIZE = 10

export function HomePage() {
  const { profile } = useAuth()
  const [featured, setFeatured] = useState<import('../../types/database').Song[]>([])
  const [popular, setPopular] = useState<import('../../types/database').Song[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [f, p] = await Promise.all([fetchFeaturedSongs(200), fetchPopularSongs(100)])
      setFeatured(f)
      setPopular(p)
    } catch (e) {
      toast.error(friendlyError(e, 'Could not load music. Check your Supabase setup.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const q = query.trim().toLowerCase()

  // Featured songs collapse into single albums, newest first.
  // NOTE: all hooks stay above the early return — changing hook order
  // between renders crashes React to a blank page.
  const { albums } = useMemo(() => groupSongsByAlbum(featured), [featured])
  const filtered = useMemo(
    () => albums.filter((g) => !q || `${g.name} ${g.artist ?? ''}`.toLowerCase().includes(q)),
    [albums, q]
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const visibleKeys = useMemo(() => new Set(visible.map((a) => a.key)), [visible])

  // Recommended: most-played albums that aren't already shown above.
  const { albums: popularAlbums } = useMemo(() => groupSongsByAlbum(popular), [popular])
  const recommended = useMemo(
    () =>
      popularAlbums
        .filter((g) => !visibleKeys.has(g.key) && (!q || `${g.name} ${g.artist ?? ''}`.toLowerCase().includes(q)))
        .slice(0, 10),
    [popularAlbums, visibleKeys, q]
  )

  // Reset to the first page whenever the filter changes.
  useEffect(() => {
    setPage(1)
  }, [query])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div className="space-y-10">
        <div className="glass rounded-3xl p-6 sm:p-8">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="skeleton mt-2 h-4 w-40 rounded" />
        </div>
        <SkeletonCards count={10} />
      </div>
    )
  }

  const pageNumbers = pageList(safePage, totalPages)

  return (
    <div className="space-y-10">
      <section className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/25 blur-[100px]" aria-hidden />
        <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-flame/15 blur-[100px]" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame">{greeting}</p>
        <h1 className="mt-2 break-words font-display text-[1.65rem] font-extrabold leading-tight tracking-tight sm:text-4xl">
          {profile?.display_name ? `${profile.display_name}, ride` : 'Ride'} your sound wave
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/60">
          Featured albums, hand-picked for you. Open any album to play every song inside.
        </p>
        <div className="mt-5 max-w-xl">
          <SearchBar value={query} onChange={setQuery} placeholder="Filter albums by name or artist…" />
        </div>
      </section>

      <section aria-label="Featured albums">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel">
            <Disc3 className="h-5 w-5 text-flame" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Featured</h2>
            <p className="text-xs text-white/50">
              {filtered.length} {filtered.length === 1 ? 'album' : 'albums'}
              {totalPages > 1 && ` • Page ${safePage} of ${totalPages}`}
            </p>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            message={featured.length === 0 ? 'No featured albums yet. Ask an admin to feature some music.' : 'No albums found.'}
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((a) => (
                <AlbumCard key={a.key} album={a} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="mt-6 flex items-center justify-center gap-1.5" aria-label="Album pages">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  aria-label="Previous page"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 transition hover:bg-white/15 disabled:opacity-40 focus-ring"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pageNumbers.map((n, i) =>
                  n === '…' ? (
                    <span key={`gap-${i}`} className="px-1 text-sm text-white/40" aria-hidden>
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n as number)}
                      aria-label={`Page ${n}`}
                      aria-current={n === safePage ? 'page' : undefined}
                      className={`h-9 min-w-[2.25rem] rounded-xl px-2 text-sm font-bold transition focus-ring ${
                        n === safePage
                          ? 'bg-gradient-to-r from-primary to-primary-deep shadow-glow'
                          : 'bg-white/10 hover:bg-white/15'
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  aria-label="Next page"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 transition hover:bg-white/15 disabled:opacity-40 focus-ring"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      <section aria-label="Recommended albums">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel">
            <Wand2 className="h-5 w-5 text-primary-soft" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Recommended for you</h2>
            <p className="text-xs text-white/50">Popular albums you might like</p>
          </div>
        </div>

        {recommended.length === 0 ? (
          <EmptyState message="More recommendations coming soon." />
        ) : (
          <div className="no-scrollbar -mx-1 flex touch-pan-x gap-4 overflow-x-auto overscroll-x-contain px-1 pb-2 snap-x md:grid md:grid-cols-4 md:overflow-visible lg:grid-cols-5">
            {recommended.map((a) => (
              <div key={a.key} className="w-44 shrink-0 snap-start md:w-auto">
                <AlbumCard album={a} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** Compact page list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 12]. */
function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set<number>([1, 2, current - 1, current, current + 1, total - 1, total])
  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const n of sorted) {
    if (n - prev > 1) out.push('…')
    out.push(n)
    prev = n
  }
  return out
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel/40 px-6 py-10 text-center text-sm text-white/50">
      {message}
    </div>
  )
}
