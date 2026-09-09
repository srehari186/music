import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Heart } from 'lucide-react'
import type { Song } from '../../types/database'
import { useAuth } from '../../contexts/AuthContext'
import { useMusicPlayer } from '../../contexts/MusicPlayerContext'
import { SongRow } from '../../components/SongRow'
import { LoadingScreen } from '../../components/Loading'
import { fetchLikedSongs, unlikeSong } from '../../services/songService'
import { friendlyError } from '../../utils'

export function LikedSongsPage() {
  const { user } = useAuth()
  const { playSongs } = useMusicPlayer()
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchLikedSongs(user.id)
      .then((rows) => setSongs(rows.map((r) => r.songs)))
      .catch((e) => toast.error(friendlyError(e, 'Could not load liked songs')))
      .finally(() => setLoading(false))
  }, [user])

  const remove = async (songId: string) => {
    if (!user) return
    try {
      await unlikeSong(user.id, songId)
      setSongs((prev) => prev.filter((s) => s.id !== songId))
    } catch (e) {
      toast.error(friendlyError(e, 'Could not remove like'))
    }
  }

  if (loading) return <LoadingScreen label="Loading liked songs…" />

  return (
    <div className="space-y-6">
      <div className="glass flex items-center gap-4 rounded-3xl p-6">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-rose to-primary shadow-glow">
          <Heart className="h-8 w-8 fill-current text-white" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Liked Songs</h1>
          <p className="mt-1 text-sm text-white/55">{songs.length} saved {songs.length === 1 ? 'song' : 'songs'}</p>
        </div>
        {songs.length > 0 && (
          <button
            onClick={() => playSongs(songs, 0)}
            className="ml-auto rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-white/85 focus-ring"
          >
            Play all
          </button>
        )}
      </div>

      {songs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel/40 px-6 py-12 text-center">
          <p className="font-semibold">No liked songs yet</p>
          <p className="mt-1 text-sm text-white/50">Tap the heart icon on any song to save it here.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-panel/60 p-2">
          {songs.map((s, i) => (
            <SongRow key={s.id} song={s} context={songs} index={i} liked onUnlike={remove} />
          ))}
        </div>
      )}
    </div>
  )
}
