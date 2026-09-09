import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { Playlist, Song } from '../../types/database'
import { useAuth } from '../../contexts/AuthContext'
import { SearchBar } from '../../components/SearchBar'
import { SongRow } from '../../components/SongRow'
import { AddToPlaylistModal } from '../../components/AddToPlaylistModal'
import { searchSongs, getLikedSongIds } from '../../services/songService'
import { fetchPlaylists } from '../../services/playlistService'
import { friendlyError } from '../../utils'

export function SearchPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [results, setResults] = useState<Song[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [modalSong, setModalSong] = useState<Song | null>(null)
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (!user) return
    getLikedSongIds(user.id).then(setLikedIds).catch(() => {})
    fetchPlaylists(user.id).then(setPlaylists).catch(() => {})
  }, [user])

  useEffect(() => {
    const q = query.trim()
    setParams(q ? { q } : {}, { replace: true })
    if (!q) {
      setResults([])
      setSearched(false)
      return
    }
    setBusy(true)
    const t = setTimeout(async () => {
      try {
        // Server-side query with limit — never downloads the whole table
        const data = await searchSongs(q, 30)
        setResults(data)
        setSearched(true)
      } catch (e) {
        toast.error(friendlyError(e, 'Search failed'))
      } finally {
        setBusy(false)
      }
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Search</h1>
        <p className="mt-1 text-sm text-white/55">Find songs by title, artist, album or genre.</p>
      </div>
      <SearchBar value={query} onChange={setQuery} />
      {busy && <p className="text-sm text-white/50" role="status">Searching…</p>}
      {!busy && searched && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-panel/40 px-6 py-12 text-center">
          <p className="font-semibold">No results found.</p>
          <p className="mt-1 text-sm text-white/50">Try a different title, artist, album or genre.</p>
        </div>
      )}
      {!searched && !busy && (
        <div className="rounded-2xl border border-line bg-panel/60 p-6 text-sm text-white/55">
          <p className="font-semibold text-white">Browse ideas</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['chill', 'pop', 'lofi', 'rock', 'jazz', 'electronic'].map((g) => (
              <button
                key={g}
                onClick={() => setQuery(g)}
                className="rounded-full bg-white/8 border border-line bg-white/5 px-4 py-2 text-xs capitalize hover:bg-white/10 focus-ring"
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}
      {results.length > 0 && (
        <div className="rounded-2xl border border-line bg-panel/60 p-2">
          {results.map((s, i) => (
            <SongRow
              key={s.id}
              song={s}
              context={results}
              index={i}
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
