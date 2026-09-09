import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Flame, Sparkles, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Song } from '../../types/database'
import { useAuth } from '../../contexts/AuthContext'
import { useMusicPlayer } from '../../contexts/MusicPlayerContext'
import { SongCard } from '../../components/SongCard'
import { AlbumCard } from '../../components/AlbumCard'
import { SongRow } from '../../components/SongRow'
import { SkeletonCards, LoadingScreen } from '../../components/Loading'
import { SearchBar } from '../../components/SearchBar'
import { AddToPlaylistModal } from '../../components/AddToPlaylistModal'
import { fetchFeaturedSongs, fetchPopularSongs, fetchRecentSongs, fetchRecentlyPlayed, getLikedSongIds } from '../../services/songService'
import { fetchPlaylists } from '../../services/playlistService'
import { formatRelativeTime, friendlyError, groupSongsByAlbum } from '../../utils'
import type { Playlist } from '../../types/database'

function SectionHead({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/8 border border-line bg-panel">{icon}</span>
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        <p className="text-xs text-white/50">{subtitle}</p>
      </div>
    </div>
  )
}

export function HomePage() {
  const { user, profile } = useAuth()
  const { playSongs } = useMusicPlayer()
  const [recent, setRecent] = useState<Song[]>([])
  const [featured, setFeatured] = useState<Song[]>([])
  const [popular, setPopular] = useState<Song[]>([])
  const [history, setHistory] = useState<{ id: string; played_at: string; songs: Song }[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [modalSong, setModalSong] = useState<Song | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [r, f, p, h, liked, pls] = await Promise.all([
        fetchRecentSongs(30),
        fetchFeaturedSongs(10),
        fetchPopularSongs(10),
        fetchRecentlyPlayed(user.id, 8),
        getLikedSongIds(user.id),
        fetchPlaylists(user.id)
      ])
      setRecent(r)
      setFeatured(f)
      setPopular(p)
      setHistory(h)
      setLikedIds(liked)
      setPlaylists(pls)
    } catch (e) {
      toast.error(friendlyError(e, 'Could not load music. Check your Supabase setup.'))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const toggleLikeLocal = (songId: string, liked: boolean) => {
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (liked) next.add(songId)
      else next.delete(songId)
      return next
    })
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div className="space-y-10">
        <div className="glass rounded-3xl p-6 sm:p-8">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="skeleton mt-2 h-4 w-40 rounded" />
        </div>
        <SkeletonCards count={5} />
        <SkeletonCards count={5} />
      </div>
    )
  }

  const recommended = [...featured, ...popular].filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i).slice(0, 10)
  const q = query.trim().toLowerCase()
  const filterFn = (s: Song) => !q || `${s.title} ${s.artist ?? ''} ${s.album ?? ''}`.toLowerCase().includes(q)

  // Recently added is presented as albums: songs sharing an album land in
  // one album card (newest album first); loose tracks show as singles.
  const { albums: recentAlbums, singles: recentSingles } = useMemo(() => groupSongsByAlbum(recent), [recent])
  const shownAlbums = recentAlbums
    .filter((g) => !q || `${g.name} ${g.artist ?? ''}`.toLowerCase().includes(q))
    .slice(0, 10)
  const shownSingles = recentSingles.filter(filterFn).slice(0, 10)

  return (
    <div className="space-y-10">
      <section className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/25 blur-[100px]" aria-hidden />
        <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-flame/15 blur-[100px]" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame">{greeting}</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {profile?.display_name ? `${profile.display_name}, ride` : 'Ride'} your sound wave
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/60">
          Fresh drops, featured picks and your recent rotations — all in one place. Press play and stay in flow.
        </p>
        <div className="mt-5 max-w-xl">
          <SearchBar value={query} onChange={setQuery} placeholder="Filter this page by title, artist, album…" />
        </div>
      </section>

      {history.length > 0 && (
        <section aria-label="Recently played">
          <SectionHead icon={<Clock3 className="h-5 w-5 text-flame" />} title="Jump back in" subtitle="Your recent rotations" />
          <div className="rounded-2xl border border-line bg-panel/60 p-2">
            {history.slice(0, 5).map((h, i) => (
              <div key={h.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <SongRow song={h.songs} context={history.map((x) => x.songs)} index={i} liked={likedIds.has(h.songs.id) ? true : undefined} onUnlike={undefined} />
                </div>
                <span className="pr-3 text-[11px] text-white/35">{formatRelativeTime(h.played_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Recently added">
        <SectionHead icon={<Sparkles className="h-5 w-5 text-ember" />} title="Recently added" subtitle="Fresh albums and singles on Waveora" />
        {shownAlbums.length === 0 && shownSingles.length === 0 ? (
          <EmptyState message={recent.length === 0 ? 'No songs yet. Ask an admin to add music.' : 'No results found.'} />
        ) : (
          <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2 snap-x md:grid md:grid-cols-4 md:overflow-visible lg:grid-cols-5">
            {shownAlbums.map((a) => (
              <div key={a.key} className="w-44 shrink-0 snap-start md:w-auto">
                <AlbumCard album={a} />
              </div>
            ))}
            {shownSingles.map((s) => (
              <div key={s.id} className="w-44 shrink-0 snap-start md:w-auto">
                <SongCard song={s} context={recent} liked={likedIds.has(s.id)} onToggleLike={toggleLikeLocal} onAddToPlaylist={setModalSong} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Featured songs">
        <SectionHead icon={<Flame className="h-5 w-5 text-rose" />} title="Featured" subtitle="Curated picks from Waveora editors" />
        {featured.filter(filterFn).length === 0 ? (
          <EmptyState message="No featured songs right now." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {featured.filter(filterFn).map((s) => (
              <SongCard key={s.id} song={s} context={featured} liked={likedIds.has(s.id)} onToggleLike={toggleLikeLocal} onAddToPlaylist={setModalSong} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Popular songs">
        <SectionHead icon={<Flame className="h-5 w-5 text-flame" />} title="Trending now" subtitle="Most played across Waveora" />
        <div className="rounded-2xl border border-line bg-panel/60 p-2">
          {popular.filter(filterFn).slice(0, 8).map((s, i) => (
            <SongRow key={s.id} song={s} context={popular} index={i} liked={likedIds.has(s.id) ? true : undefined} />
          ))}
          {popular.filter(filterFn).length === 0 && <EmptyState message="No results found." />}
        </div>
        {popular.length > 0 && (
          <button
            onClick={() => playSongs(popular, 0)}
            className="mt-3 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15 focus-ring"
          >
            Play all trending
          </button>
        )}
      </section>

      <section aria-label="Recommended">
        <SectionHead icon={<Wand2 className="h-5 w-5 text-primary-soft" />} title="Recommended for you" subtitle="A blend of featured and popular" />
        {recommended.filter(filterFn).length === 0 ? (
          <EmptyState message="No results found." />
        ) : (
          <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2 snap-x md:grid md:grid-cols-4 md:overflow-visible lg:grid-cols-5">
            {recommended.filter(filterFn).map((s) => (
              <div key={s.id} className="w-44 shrink-0 snap-start md:w-auto">
                <SongCard song={s} context={recommended} liked={likedIds.has(s.id)} onToggleLike={toggleLikeLocal} onAddToPlaylist={setModalSong} />
              </div>
            ))}
          </div>
        )}
      </section>

      <AddToPlaylistModal song={modalSong} playlists={playlists} onClose={() => setModalSong(null)} />
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel/40 px-6 py-10 text-center text-sm text-white/50">
      {message}
    </div>
  )
}

export function HomeLoadingFallback() {
  return <LoadingScreen label="Loading your music…" />
}
