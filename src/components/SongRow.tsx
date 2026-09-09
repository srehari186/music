import { useState } from 'react'
import { Heart, Pause, Play, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Song } from '../types/database'
import { useMusicPlayer } from '../contexts/MusicPlayerContext'
import { coverFallback, formatCount, formatTime } from '../utils'

interface Props {
  song: Song
  context: Song[]
  liked?: boolean
  index?: number
  showAlbum?: boolean
  trailing?: React.ReactNode
  onUnlike?: (songId: string) => void
}

export function SongRow({ song, context, liked, index, showAlbum = true, trailing, onUnlike }: Props) {
  const { currentSong, isPlaying, playSong, togglePlay } = useMusicPlayer()
  const [imgOk, setImgOk] = useState(true)
  const isCurrent = currentSong?.id === song.id

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5 ${
        isCurrent ? 'bg-white/5' : ''
      }`}
    >
      <span className="w-6 shrink-0 text-center text-xs text-white/35">{(index ?? 0) + 1}</span>
      <img
        src={imgOk ? song.cover_url || coverFallback(song.title, song.artist) : coverFallback(song.title, song.artist)}
        alt={`${song.title} cover`}
        loading="lazy"
        onError={() => setImgOk(false)}
        className="h-11 w-11 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${isCurrent ? 'text-flame' : ''}`}>{song.title}</p>
        <p className="truncate text-xs text-white/55">
          {song.artist ?? 'Unknown'} {showAlbum && song.album ? `• ${song.album}` : ''}
        </p>
      </div>
      <span className="hidden text-xs text-white/35 sm:block">{formatCount(song.play_count)} plays</span>
      <span className="hidden text-xs text-white/35 md:block">{formatTime(song.duration)}</span>
      <button
        onClick={() => (isCurrent ? togglePlay() : playSong(song, context))}
        aria-label={isCurrent && isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white hover:text-black focus-ring"
      >
        {isCurrent && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      {liked !== undefined && onUnlike ? (
        <button
          onClick={() => {
            onUnlike(song.id)
            toast.success('Removed from Liked Songs')
          }}
          aria-label={`Remove ${song.title} from liked`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-rose transition hover:bg-rose/15 focus-ring"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : liked !== undefined ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center text-rose" aria-label="Liked">
          <Heart className="h-4 w-4 fill-current" />
        </span>
      ) : null}
      {trailing}
    </div>
  )
}
