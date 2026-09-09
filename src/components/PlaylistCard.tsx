import { Link } from 'react-router-dom'
import { ListMusic, Play } from 'lucide-react'
import type { Playlist } from '../types/database'

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Link
      to={`/playlist/${playlist.id}`}
      className="card-hover group block overflow-hidden rounded-2xl border border-line bg-panel/80 focus-ring"
      aria-label={`Open playlist ${playlist.name}`}
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-primary/40 via-panel2 to-abyss">
        {playlist.cover_url ? (
          <img src={playlist.cover_url} alt={`${playlist.name} cover`} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <ListMusic className="h-12 w-12 text-white/25" aria-hidden />
          </div>
        )}
        <span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white text-black opacity-0 transition group-hover:opacity-100">
          <Play className="ml-0.5 h-4 w-4" />
        </span>
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold">{playlist.name}</h3>
        <p className="truncate text-xs text-white/55">{playlist.song_count ?? 0} songs</p>
      </div>
    </Link>
  )
}
