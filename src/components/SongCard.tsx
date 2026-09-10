import { useState } from 'react'
import { Heart, ListPlus, MoreHorizontal, Pause, Play } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Song } from '../types/database'
import { useAuth } from '../contexts/AuthContext'
import { useMusicPlayer } from '../contexts/MusicPlayerContext'
import { likeSong, unlikeSong } from '../services/songService'
import { coverFallback, formatCount, friendlyError } from '../utils'

interface Props {
  song: Song
  context?: Song[]
  liked?: boolean
  onToggleLike?: (songId: string, liked: boolean) => void
  onAddToPlaylist?: (song: Song) => void
}

export function SongCard({ song, context, liked = false, onToggleLike, onAddToPlaylist }: Props) {
  const { user } = useAuth()
  const { currentSong, isPlaying, playSong, togglePlay } = useMusicPlayer()
  const [busy, setBusy] = useState(false)
  const isCurrent = currentSong?.id === song.id

  const handlePlay = () => {
    if (isCurrent) togglePlay()
    else playSong(song, context ?? [song])
  }

  const handleLike = async () => {
    if (!user) return
    setBusy(true)
    try {
      if (liked) {
        await unlikeSong(user.id, song.id)
        toast.success('Removed from Liked Songs')
      } else {
        await likeSong(user.id, song.id)
        toast.success('Added to Liked Songs')
      }
      onToggleLike?.(song.id, !liked)
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update like'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="card-hover group relative overflow-hidden rounded-2xl border border-line bg-panel/80">
      <div className="relative aspect-square overflow-hidden">
        <button
          onClick={handlePlay}
          aria-label={isCurrent && isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
          className="block h-full w-full cursor-pointer focus-ring"
          title={isCurrent && isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
        >
          <img
            src={song.cover_url || coverFallback(song.title, song.artist)}
            alt={`${song.title} cover art`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = coverFallback(song.title, song.artist)
            }}
          />
        </button>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
        <button
          onClick={handlePlay}
          aria-label={isCurrent && isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
          className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-card transition hover:scale-105 focus-ring"
        >
          {isCurrent && isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        {song.featured && (
          <span className="absolute left-3 top-3 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
            Featured
          </span>
        )}
      </div>
      <div className="p-3">
        <button
          onClick={handlePlay}
          aria-label={isCurrent && isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
          title={song.title}
          className="block w-full truncate text-left text-sm font-semibold transition hover:text-flame focus-ring"
        >
          {song.title}
        </button>
        <p className="truncate text-xs text-white/55" title={song.artist ?? ''}>
          {song.artist ?? 'Unknown artist'}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-white/40">{formatCount(song.play_count)} plays</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleLike}
              disabled={busy}
              aria-label={liked ? `Unlike ${song.title}` : `Like ${song.title}`}
              aria-pressed={liked}
              className={`rounded-lg p-2 transition focus-ring ${liked ? 'text-rose' : 'text-white/50 hover:text-rose'}`}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
            </button>
            {onAddToPlaylist && (
              <button
                onClick={() => onAddToPlaylist(song)}
                aria-label={`Add ${song.title} to playlist`}
                className="rounded-lg p-2 text-white/50 transition hover:text-white focus-ring"
              >
                <ListPlus className="h-4 w-4" />
              </button>
            )}
            <span className="rounded-lg p-1.5 text-white/30" aria-hidden>
              <MoreHorizontal className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
