import { Link } from 'react-router-dom'
import { Disc3, Pause, Play } from 'lucide-react'
import { useMusicPlayer } from '../contexts/MusicPlayerContext'
import { coverFallback, type AlbumGroup } from '../utils'

export function AlbumCard({ album }: { album: AlbumGroup }) {
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
    <article className="card-hover group relative overflow-hidden rounded-2xl border border-line bg-panel/80">
      <Link to={href} aria-label={`Open album ${album.name}`} className="block focus-ring rounded-2xl">
        <div className="relative aspect-square overflow-hidden">
          <img
            src={album.cover || coverFallback(album.name, album.artist)}
            alt={`${album.name} cover art`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = coverFallback(album.name, album.artist)
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[11px]">
            <Disc3 className="h-3 w-3" /> Album
          </span>
        </div>
        <div className="p-2 sm:p-3">
          <h3 className="truncate text-xs font-semibold sm:text-sm" title={album.name}>
            {album.name}
          </h3>
          <p className="truncate text-[11px] text-white/55 sm:text-xs" title={album.artist ?? ''}>
            {album.artist ?? 'Unknown artist'} • {album.songs.length} {album.songs.length === 1 ? 'track' : 'tracks'}
          </p>
        </div>
      </Link>
      <button
        onClick={handlePlay}
        aria-label={isCurrentAlbum && isPlaying ? `Pause album ${album.name}` : `Play album ${album.name}`}
        className="absolute bottom-[3.75rem] right-2 grid h-9 w-9 place-items-center rounded-full bg-white text-black shadow-card transition hover:scale-105 focus-ring sm:bottom-[4.5rem] sm:right-3 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:h-11 md:w-11"
      >
        {isCurrentAlbum && isPlaying ? <Pause className="h-4 w-4 sm:h-5 sm:w-5" /> : <Play className="ml-0.5 h-4 w-4 sm:h-5 sm:w-5" />}
      </button>
    </article>
  )
}
