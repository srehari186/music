import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Clock3, Heart, ListMusic } from 'lucide-react'
import type { Playlist, Song } from '../../types/database'
import { useAuth } from '../../contexts/AuthContext'
import { useMusicPlayer } from '../../contexts/MusicPlayerContext'
import { SongRow } from '../../components/SongRow'
import { PlaylistCard } from '../../components/PlaylistCard'
import { LoadingScreen } from '../../components/Loading'
import { fetchLikedSongs, fetchRecentlyPlayed, getLikedSongIds } from '../../services/songService'
import { fetchPlaylists } from '../../services/playlistService'
import { formatRelativeTime, friendlyError } from '../../utils'

export function LibraryPage() {
  const { user } = useAuth()
  const { playSongs } = useMusicPlayer()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [liked, setLiked] = useState<{ id: string; songs: Song }[]>([])
  const [history, setHistory] = useState<{ id: string; played_at: string; songs: Song }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const [pls, lk, hist] = await Promise.all([
          fetchPlaylists(user.id),
          fetchLikedSongs(user.id),
          fetchRecentlyPlayed(user.id, 10)
        ])
        setPlaylists(pls)
        setLiked(lk)
        setHistory(hist)
      } catch (e) {
        toast.error(friendlyError(e, 'Could not load library'))
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  if (loading) return <LoadingScreen label="Loading your library…" />

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Your Library</h1>
        <p className="mt-1 text-sm text-white/55">Playlists, liked songs and recent history — all yours.</p>
      </div>

      <section aria-label="Playlists">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <ListMusic className="h-5 w-5 text-flame" /> Playlists ({playlists.length})
          </h2>
          <Link to="/playlists" className="text-sm font-semibold text-flame hover:text-flame-soft">
            Manage
          </Link>
        </div>
        {playlists.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-6 text-center text-sm text-white/50">
            No playlists yet. <Link to="/playlists" className="text-flame underline">Create your first one</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {playlists.slice(0, 4).map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Liked songs preview">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Heart className="h-5 w-5 text-rose" /> Liked Songs ({liked.length})
          </h2>
          <Link to="/liked" className="text-sm font-semibold text-flame hover:text-flame-soft">
            View all
          </Link>
        </div>
        {liked.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-6 text-center text-sm text-white/50">
            Tap the heart on any song to save it here.
          </p>
        ) : (
          <div className="rounded-2xl border border-line bg-panel/60 p-2">
            {liked.slice(0, 5).map((l, i) => (
              <SongRow key={l.id} song={l.songs} context={liked.map((x) => x.songs)} index={i} liked />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Recently played">
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
          <Clock3 className="h-5 w-5 text-ember" /> Recently played
        </h2>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-6 text-center text-sm text-white/50">
            Nothing yet — press play on any song and it will show up here.
          </p>
        ) : (
          <div className="rounded-2xl border border-line bg-panel/60 p-2">
            {history.map((h, i) => (
              <div key={h.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <SongRow song={h.songs} context={history.map((x) => x.songs)} index={i} />
                </div>
                <span className="pr-3 text-[11px] text-white/35">{formatRelativeTime(h.played_at)}</span>
              </div>
            ))}
          </div>
        )}
        {history.length > 0 && (
          <button
            onClick={() => playSongs(history.map((h) => h.songs), 0)}
            className="mt-3 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15 focus-ring"
          >
            Replay history
          </button>
        )}
      </section>
    </div>
  )
}

// Re-export helper to avoid circular imports elsewhere
export async function loadLikedIds(userId: string) {
  return getLikedSongIds(userId)
}
