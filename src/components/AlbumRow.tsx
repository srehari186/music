import { Link } from 'react-router-dom'
import { Pause, Play } from 'lucide-react'
import { useMusicPlayer } from '../contexts/MusicPlayerContext'
import { coverFallback, type AlbumGroup } from '../utils'

/** Compact album row for phones: small thumb, name, play — many per screen. */
export function AlbumRow({ album, index }: { album: AlbumGroup; index: number }) {
  const { currentSong, isPlaying, playSongs, togglePlay } = useMusicPlayer()
  const isCurrentAlbum = currentSong != null && album.songs.some((s) => s.id === currentSong.id)

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isCurrentAlbum) togglePlay()
    else playSongs(album.songs, 0)
  }

  const href = `/album?name=${encodeURIComponent(album.name)}&artist=${encodeURIComponent(album.artist ?? '')}`

  return (
    <div className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition hover:bg-white/5">
      <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-white/35">{index + 1}</span>
      <Link to={href} aria-label={`Open album ${album.name}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-ring">
        <img
          src={album.cover || coverFallback(album.name, album.artist)}
          alt=""
          loading="lazy"
          className="h-20 w-20 shrink-0 rounded-xl object-cover"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = coverFallback(album.name, album.artist)
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{album.name}</span>
          <span className="block truncate text-[11px] text-white/55">
            {album.artist ?? 'Unknown artist'} • {album.songs.length} {album.songs.length === 1 ? 'track' : 'tracks'}
          </span>
        </span>
      </Link>
      <button
        onClick={handlePlay}
        aria-label={isCurrentAlbum && isPlaying ? `Pause album ${album.name}` : `Play album ${album.name}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white hover:text-black focus-ring"
      >
        {isCurrentAlbum && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
    </div>
  )
}
