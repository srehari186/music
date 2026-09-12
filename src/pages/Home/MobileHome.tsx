import { Link } from 'react-router-dom'
import { AudioLines, Heart, Library, ListMusic, Shuffle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useMusicPlayer } from '../../contexts/MusicPlayerContext'
import type { Profile, Song } from '../../types/database'
import type { AlbumGroup } from '../../utils'
import { AlbumRow } from '../../components/AlbumRow'
import { EmptyState } from '../../components/AlbumShelf'
import { SearchBar } from '../../components/SearchBar'

interface MobileHomeProps {
  greeting: string
  profile: Profile | null
  query: string
  onQuery: (q: string) => void
  recentAlbums: AlbumGroup[]
  featuredAlbums: AlbumGroup[]
  recommendedAlbums: AlbumGroup[]
  featuredSongs: Song[]
  hasMusic: boolean
}

/**
 * Phone-only home layout (rendered below the lg breakpoint): app bar with
 * profile, filter search, quick chips, and compact row shelves — no cards,
 * no swipe strips, no pagination. Everything reachable by vertical scroll.
 */
export function MobileHome({
  greeting,
  profile,
  query,
  onQuery,
  recentAlbums,
  featuredAlbums,
  recommendedAlbums,
  featuredSongs,
  hasMusic
}: MobileHomeProps) {
  const { playSongs } = useMusicPlayer()
  const initial = ((profile?.display_name ?? profile?.email ?? 'W') as string).slice(0, 1).toUpperCase()

  const shuffleAll = () => {
    const all = featuredAlbums.flatMap((a) => a.songs)
    const pool = all.length > 0 ? all : featuredSongs
    if (pool.length === 0) {
      toast.error('No music to shuffle yet')
      return
    }
    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    playSongs(shuffled, 0)
    toast.success('Shuffling featured music')
  }

  const chips = [
    { to: '/liked', label: 'Liked', Icon: Heart },
    { to: '/playlists', label: 'Playlists', Icon: ListMusic },
    { to: '/library', label: 'Library', Icon: Library }
  ]

  return (
    <div className="space-y-6">
      {/* App bar */}
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-flame shadow-glow">
          <AudioLines className="h-5 w-5 text-white" aria-hidden />
        </span>
        <span className="font-display text-lg font-extrabold tracking-tight">Waveora</span>
        <Link
          to="/profile"
          aria-label="Open your profile"
          className="ml-auto block focus-ring rounded-full"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-flame text-sm font-extrabold">
              {initial}
            </span>
          )}
        </Link>
      </div>

      <div>
        <h1 className="break-words font-display text-2xl font-extrabold leading-tight tracking-tight">
          {greeting}
          {profile?.display_name ? `, ${profile.display_name}` : ''}
        </h1>
        <p className="mt-1 text-xs text-white/55">Fresh drops and featured albums, ready to play.</p>
      </div>

      <SearchBar value={query} onChange={onQuery} placeholder="Filter albums by name or artist…" />

      {/* Quick chips */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {chips.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-panel/80 px-4 py-2.5 text-sm font-semibold focus-ring"
          >
            <Icon className="h-4 w-4 text-flame" /> {label}
          </Link>
        ))}
        <button
          onClick={shuffleAll}
          className="flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-black focus-ring"
        >
          <Shuffle className="h-4 w-4" /> Shuffle
        </button>
      </div>

      <MobileShelf title="Recently added" albums={recentAlbums} emptyMessage={hasMusic ? 'No recent albums found.' : 'No music yet. Ask an admin to add songs or import an album.'} />
      <MobileShelf title="Featured" albums={featuredAlbums} emptyMessage="No featured albums yet." />
      <MobileShelf title="Recommended for you" albums={recommendedAlbums} emptyMessage="More recommendations coming soon." />
    </div>
  )
}

function MobileShelf({ title, albums, emptyMessage }: { title: string; albums: AlbumGroup[]; emptyMessage: string }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 font-display text-lg font-bold tracking-tight">{title}</h2>
      {albums.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="rounded-2xl border border-line bg-panel/60 p-1.5">
          {albums.map((a, i) => (
            <AlbumRow key={a.key} album={a} index={i} />
          ))}
        </div>
      )}
    </section>
  )
}
