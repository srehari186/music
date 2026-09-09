import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ListMusic, Play, Shuffle, X } from 'lucide-react'
import type { Song } from '../../types/database'
import { useMusicPlayer } from '../../contexts/MusicPlayerContext'
import { SongRow } from '../../components/SongRow'
import { LoadingScreen } from '../../components/Loading'
import { fetchPlaylistDetails, removeSongFromPlaylist } from '../../services/playlistService'
import { friendlyError } from '../../utils'

export function PlaylistDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { playSongs } = useMusicPlayer()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState<string | null>(null)
  const [entries, setEntries] = useState<{ id: string; position: number; songs: Song }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetchPlaylistDetails(id)
      .then(({ playlist, items }) => {
        setName(playlist.name)
        setDesc(playlist.description)
        setEntries(items)
      })
      .catch((e) => {
        toast.error(friendlyError(e, 'Playlist not found or not accessible'))
        navigate('/playlists', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const songs = entries.map((e) => e.songs)

  const shufflePlay = () => {
    const shuffled = [...songs].sort(() => Math.random() - 0.5)
    playSongs(shuffled, 0)
  }

  const remove = async (entryId: string) => {
    try {
      await removeSongFromPlaylist(entryId)
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
      toast.success('Removed from playlist')
    } catch (e) {
      toast.error(friendlyError(e, 'Could not remove song'))
    }
  }

  if (loading) return <LoadingScreen label="Loading playlist…" />

  return (
    <div className="space-y-6">
      <div className="glass flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-center">
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-flame shadow-glow">
          <ListMusic className="h-10 w-10 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame">Playlist</p>
          <h1 className="truncate font-display text-3xl font-extrabold tracking-tight">{name}</h1>
          {desc && <p className="mt-1 text-sm text-white/55">{desc}</p>}
          <p className="mt-1 text-xs text-white/40">{songs.length} {songs.length === 1 ? 'song' : 'songs'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => songs.length && playSongs(songs, 0)}
            disabled={songs.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-white/85 disabled:opacity-40 focus-ring sm:flex-none"
          >
            <Play className="h-4 w-4 fill-current" /> Play
          </button>
          <button
            onClick={shufflePlay}
            disabled={songs.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold hover:bg-white/15 disabled:opacity-40 focus-ring sm:flex-none"
          >
            <Shuffle className="h-4 w-4" /> Shuffle
          </button>
        </div>
      </div>

      {songs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-8 text-center text-sm text-white/50">
          This playlist is empty. Add songs from Home or Search with the “+ Playlist” action.
        </p>
      ) : (
        <div className="rounded-2xl border border-line bg-panel/60 p-2">
          {songs.map((s, i) => (
            <SongRow
              key={entries[i].id}
              song={s}
              context={songs}
              index={i}
              trailing={
                <button
                  onClick={() => remove(entries[i].id)}
                  aria-label={`Remove ${s.title} from playlist`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/50 hover:bg-rose/15 hover:text-rose focus-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
