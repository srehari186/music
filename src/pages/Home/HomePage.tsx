import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Disc3, Sparkles, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { AlbumCard } from '../../components/AlbumCard'
import { MobileHome } from './MobileHome'
import { AlbumShelf, EmptyState } from '../../components/AlbumShelf'
import { SkeletonCards } from '../../components/Loading'
import { SearchBar } from '../../components/SearchBar'
import { fetchFeaturedSongs, fetchPopularSongs, fetchRecentSongs } from '../../services/songService'
import { friendlyError, groupSongsByAlbum } from '../../utils'

const PAGE_SIZE = 10

export function HomePage() {
  const { profile } = useAuth()
  const [featured, setFeatured] = useState<import('../../types/database').Song[]>([])
  const [popular, setPopular] = useState<import('../../types/database').Song[]>([])
  const [recent, setRecent] = useState<import('../../types/database').Song[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [f, p, r] = await Promise.all([fetchFeaturedSongs(200), fetchPopularSongs(100), fetchRecentSongs(30)])
      setFeatured(f)
      setPopular(p)
      setRecent(r)
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

  // Recommended: most-played albums (same pool as everywhere else —
  // repeating across shelves is normal, an empty shelf is not).
  const { albums: popularAlbums } = useMemo(() => groupSongsByAlbum(popular), [popular])
  const recommended = useMemo(
    () =>
      popularAlbums
        .filter((g) => !q || `${g.name} ${g.artist ?? ''}`.toLowerCase().includes(q))
        .slice(0, 10),
    [popularAlbums, q]
  )

  // Recently added: newest albums first.
  const { albums: allRecent } = useMemo(() => groupSongsByAlbum(recent), [recent])
  const recentAlbums = useMemo(
    () =>
      allRecent
        .filter((g) => !q || `${g.name} ${g.artist ?? ''}`.toLowerCase().includes(q))
        .slice(0, 10),
    [allRecent, q]
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
    <div>
      {/* Phones + small tablets: dedicated mobile layout. */}
      <div className="lg:hidden">
        <MobileHome
          greeting={greeting}
          profile={profile}
          query={query}
          onQuery={setQuery}
          recentAlbums={recentAlbums}
          featuredAlbums={filtered}
          recommendedAlbums={recommended}
          featuredSongs={featured}
          hasMusic={featured.length > 0 || recent.length > 0}
        />
      </div>
      {/* Desktops: hero + shelves + pagination. */}
      <div className="hidden space-y-10 lg:block">
      <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/25 blur-[100px]" aria-hidden />
        <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-flame/15 blur-[100px]" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame">{greeting}</p>
        <h1 className="mt-2 break-words font-display text-[1.65rem] font-extrabold leading-tight tracking-tight sm:text-4xl">
          {profile?.display_name ? `${profile.display_name}, ride` : 'Ride'} your sound wave
        </h1>
        <p className="mt-2 hidden max-w-xl text-sm text-white/60 sm:block">
          Fresh drops and featured albums, hand-picked for you. Open any album to play every song inside.
        </p>
        <div className="mt-4 max-w-xl sm:mt-5">
          <SearchBar value={query} onChange={setQuery} placeholder="Filter albums by name or artist…" />
        </div>
      </section>

      <AlbumShelf
        title="Recently added"
        subtitle="The latest drops on Waveora"
        icon={<Sparkles className="h-5 w-5 text-ember" />}
        albums={recentAlbums}
        emptyMessage={recent.length === 0 ? 'No music yet. Ask an admin to add songs or import an album.' : 'No recent albums found.'}
      />

      <section aria-label="Featured albums">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel">
            <Disc3 className="h-5 w-5 text-flame" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">Featured</h2>
            <p className="text-xs text-white/50">
              {filtered.length} {filtered.length === 1 ? 'album' : 'albums'}
              {totalPages > 1 && <span className="hidden sm:inline">{` • Page ${safePage} of ${totalPages}`}</span>}
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            message={featured.length === 0 ? 'No featured albums yet. Ask an admin to feature some music.' : 'No albums found.'}
          />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4 xl:grid-cols-5">
              {visible.map((a) => (
                <AlbumCard key={a.key} album={a} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label="Album pages">
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
            <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">Recommended for you</h2>
            <p className="text-xs text-white/50">Popular albums you might like</p>
          </div>
        </div>

        {recommended.length === 0 ? (
          <EmptyState message="More recommendations coming soon." />
        ) : (
          <div className="grid grid-cols-4 gap-4 xl:grid-cols-5">
            {recommended.map((a) => (
              <AlbumCard key={a.key} album={a} />
            ))}
          </div>
        )}
      </section>
      </div>
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
