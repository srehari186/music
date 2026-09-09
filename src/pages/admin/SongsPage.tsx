import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { Song } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { adminDeleteSong } from '../../services/songService'
import { LoadingScreen } from '../../components/Loading'
import { formatCount, friendlyError } from '../../utils'

type SortKey = 'newest' | 'title' | 'plays'

export function AdminSongsPage() {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('all')
  const [featured, setFeatured] = useState('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = async () => {
    try {
      const { data, error } = await supabase.from('songs').select('*').order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      setSongs((data ?? []) as Song[])
    } catch (e) {
      toast.error(friendlyError(e, 'Could not load songs'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const genres = useMemo(() => {
    const set = new Set(songs.map((s) => s.genre).filter(Boolean) as string[])
    return ['all', ...Array.from(set).sort()]
  }, [songs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = songs.filter((s) => {
      if (genre !== 'all' && s.genre !== genre) return false
      if (featured === 'featured' && !s.featured) return false
      if (featured === 'standard' && s.featured) return false
      if (!q) return true
      return `${s.title} ${s.artist ?? ''} ${s.album ?? ''} ${s.genre ?? ''}`.toLowerCase().includes(q)
    })
    if (sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'plays') list = [...list].sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0))
    return list
  }, [songs, query, genre, featured, sort])

  const onDelete = async (song: Song) => {
    if (!confirm(`Are you sure you want to delete "${song.title}"?`)) return
    setDeleting(song.id)
    try {
      await adminDeleteSong(song.id)
      toast.success('Song deleted')
      setSongs((prev) => prev.filter((s) => s.id !== song.id))
    } catch (e) {
      toast.error(friendlyError(e, 'Could not delete song'))
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <LoadingScreen label="Loading songs…" />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Songs</h1>
          <p className="mt-1 text-sm text-white/55">{filtered.length} of {songs.length} tracks</p>
        </div>
        <Link to="/admin/songs/new" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-5 py-2.5 text-sm font-bold shadow-glow hover:brightness-110 focus-ring">
          <Plus className="h-4 w-4" /> Add song
        </Link>
      </div>

      <div className="grid gap-3 rounded-2xl border border-line bg-panel/70 p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <label className="flex items-center gap-2 rounded-xl border border-line bg-abyss px-3 py-2.5">
          <Search className="h-4 w-4 text-white/40" aria-hidden />
          <span className="sr-only">Search songs</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, artist, album…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-white/30"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Filter by genre</span>
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className="rounded-xl border border-line bg-abyss px-3 py-2.5 text-sm focus-ring" aria-label="Filter by genre">
            {genres.map((g) => (
              <option key={g} value={g}>{g === 'all' ? 'All genres' : g}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Filter by featured</span>
          <select value={featured} onChange={(e) => setFeatured(e.target.value)} className="rounded-xl border border-line bg-abyss px-3 py-2.5 text-sm focus-ring" aria-label="Filter by featured">
            <option value="all">All</option>
            <option value="featured">Featured</option>
            <option value="standard">Standard</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Sort songs</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-xl border border-line bg-abyss px-3 py-2.5 text-sm focus-ring" aria-label="Sort songs">
            <option value="newest">Newest</option>
            <option value="title">Title A–Z</option>
            <option value="plays">Most played</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-panel/70">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-white/40">
                <th className="px-4 py-3">Track</th>
                <th className="px-4 py-3">Genre</th>
                <th className="px-4 py-3">Plays</th>
                <th className="px-4 py-3">Featured</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-line/60 hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {s.cover_url ? (
                        <img src={s.cover_url} alt="" className="h-9 w-9 rounded-lg object-cover" loading="lazy" />
                      ) : (
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-xs">♪</span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.title}</p>
                        <p className="truncate text-xs text-white/50">{s.artist}{s.album ? ` • ${s.album}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-white/60">{s.genre ?? '—'}</td>
                  <td className="px-4 py-2.5 text-white/60">{formatCount(s.play_count)}</td>
                  <td className="px-4 py-2.5">
                    {s.featured ? (
                      <span className="rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary-soft">Featured</span>
                    ) : (
                      <span className="text-white/35">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/admin/songs/${s.id}/edit`}
                        aria-label={`Edit ${s.title}`}
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-white/70 hover:text-white focus-ring"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => onDelete(s)}
                        disabled={deleting === s.id}
                        aria-label={`Delete ${s.title}`}
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-white/70 hover:bg-rose/20 hover:text-rose focus-ring disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="p-8 text-center text-sm text-white/50">No songs match your filters.</p>}
      </div>
    </div>
  )
}
