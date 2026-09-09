import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Disc3, Play } from 'lucide-react'
import type { Playlist, Song } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useMusicPlayer } from '../../contexts/MusicPlayerContext'
import { SongRow } from '../../components/SongRow'
import { AddToPlaylistModal } from '../../components/AddToPlaylistModal'
import { LoadingScreen } from '../../components/Loading'
import { fetchPlaylists } from '../../services/playlistService'
import { getLikedSongIds } from '../../services/songService'
import { coverFallback, friendlyError } from '../../utils'

export function AlbumPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { playSongs } = useMusicPlayer()
  const name = params.get('name') ?? ''
  const artist = params.get('artist') ?? ''

  const [songs, setSongs] = useState<Song[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [modalSong, setModalSong] = useState<Song | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!name.trim()) {
      navigate('/home', { replace: true })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        let query = supabase.from('songs').select('*').eq('album', name)
        if (artist) query = query.eq('artist', artist)
        const { data, error } = await query.order('created_at', { ascending: true }).limit(200)
        if (error) throw error
        if (!cancelled) setSongs((data ?? []) as Song[])
        if (user && !cancelled) {
          const [liked, pls] = await Promise.all([getLikedSongIds(user.id), fetchPlaylists(user.id)])
          if (!cancelled) {
            setLikedIds(liked)
            setPlaylists(pls)
          }
        }
      } catch (e) {
        toast.error(friendlyError(e, 'Could not load this album'))
        navigate('/home', { replace: true })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [name, artist, user, navigate])

  if (loading) return <LoadingScreen label="Loading album…" />

  const cover = songs[0]?.cover_url || coverFallback(name, artist || undefined)

  return (
    <div className="space-y-6">
      <div className="glass flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-center">
        <img src={cover} alt={`${name} cover art`} className="h-28 w-28 shrink-0 rounded-2xl object-cover shadow-card" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-flame">
            <Disc3 className="h-3.5 w-3.5" /> Album
          </p>
          <h1 className="truncate font-display text-3xl font-extrabold tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-white/55">{artist || 'Unknown artist'}</p>
          <p className="mt-1 text-xs text-white/40">{songs.length} {songs.length === 1 ? 'track' : 'tracks'}</p>
        </div>
        {songs.length > 0 && (
          <button
            onClick={() => playSongs(songs, 0)}
            className="flex items-center justify-center gap-2 self-stretch rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-white/85 focus-ring sm:self-center"
          >
            <Play className="h-4 w-4 fill-current" /> Play album
          </button>
        )}
      </div>

      {songs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-8 text-center text-sm text-white/50">
          No tracks found in this album.
        </p>
      ) : (
        <div className="rounded-2xl border border-line bg-panel/60 p-2">
          {songs.map((s, i) => (
            <SongRow
              key={s.id}
              song={s}
              context={songs}
              index={i}
              showAlbum={false}
              liked={likedIds.has(s.id) ? true : undefined}
              trailing={
                <button
                  onClick={() => setModalSong(s)}
                  aria-label={`Add ${s.title} to playlist`}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white focus-ring"
                >
                  + Playlist
                </button>
              }
            />
          ))}
        </div>
      )}
      <AddToPlaylistModal song={modalSong} playlists={playlists} onClose={() => setModalSong(null)} />
    </div>
  )
}
