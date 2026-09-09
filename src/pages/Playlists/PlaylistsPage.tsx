import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Playlist } from '../../types/database'
import { useAuth } from '../../contexts/AuthContext'
import { PlaylistCard } from '../../components/PlaylistCard'
import { ButtonSpinner, LoadingScreen } from '../../components/Loading'
import { createPlaylist, deletePlaylist, fetchPlaylists, updatePlaylist } from '../../services/playlistService'
import { friendlyError } from '../../utils'

export function PlaylistsPage() {
  const { user } = useAuth()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Playlist | null>(null)

  const load = async () => {
    if (!user) return
    try {
      setPlaylists(await fetchPlaylists(user.id))
    } catch (e) {
      toast.error(friendlyError(e, 'Could not load playlists'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !name.trim()) return
    setCreating(true)
    try {
      await createPlaylist(user.id, name.trim(), desc.trim() || undefined)
      toast.success('Playlist created')
      setName('')
      setDesc('')
      await load()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not create playlist'))
    } finally {
      setCreating(false)
    }
  }

  const onDelete = async (id: string, pname: string) => {
    if (!confirm(`Delete playlist "${pname}"? Songs themselves will not be deleted.`)) return
    try {
      await deletePlaylist(id)
      toast.success('Playlist deleted')
      setPlaylists((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      toast.error(friendlyError(e, 'Could not delete playlist'))
    }
  }

  const onRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !editing.name.trim()) return
    try {
      await updatePlaylist(editing.id, { name: editing.name.trim(), description: editing.description })
      toast.success('Playlist updated')
      setEditing(null)
      await load()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not update playlist'))
    }
  }

  if (loading) return <LoadingScreen label="Loading playlists…" />

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Playlists</h1>
        <p className="mt-1 text-sm text-white/55">Create collections for every mood, then play or shuffle them.</p>
      </div>

      <form onSubmit={onCreate} className="glass rounded-2xl p-4 sm:p-5" aria-label="Create playlist">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/70">
          <Plus className="h-4 w-4" /> New playlist
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="sr-only" htmlFor="pl-name">Playlist name</label>
          <input
            id="pl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name (required)"
            className="rounded-xl border border-line bg-abyss px-4 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-primary/60"
            required
          />
          <label className="sr-only" htmlFor="pl-desc">Description</label>
          <input
            id="pl-desc"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="rounded-xl border border-line bg-abyss px-4 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-primary/60"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-5 py-2.5 text-sm font-bold hover:brightness-110 disabled:opacity-50 focus-ring"
          >
            {creating && <ButtonSpinner />} Create
          </button>
        </div>
      </form>

      {playlists.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-8 text-center text-sm text-white/50">
          No playlists yet — create your first one above.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {playlists.map((p) => (
            <div key={p.id} className="relative">
              <PlaylistCard playlist={p} />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setEditing(p)}
                  aria-label={`Rename ${p.name}`}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/8 bg-white/5 px-2 py-1.5 text-xs font-semibold text-white/70 hover:text-white focus-ring"
                >
                  <Pencil className="h-3 w-3" /> Rename
                </button>
                <button
                  onClick={() => onDelete(p.id, p.name)}
                  aria-label={`Delete ${p.name}`}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/5 px-2 py-1.5 text-xs font-semibold text-white/70 hover:bg-rose/20 hover:text-white focus-ring"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
              <Link to={`/playlist/${p.id}`} className="sr-only">
                Open {p.name}
              </Link>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Rename playlist">
          <form onSubmit={onRename} className="glass w-full max-w-sm rounded-2xl p-5">
            <h2 className="font-display font-bold">Rename playlist</h2>
            <label className="mt-4 block text-xs font-semibold text-white/60" htmlFor="edit-name">Name</label>
            <input
              id="edit-name"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-line bg-abyss px-3 py-2.5 text-sm outline-none focus:border-primary/60"
              required
            />
            <label className="mt-3 block text-xs font-semibold text-white/60" htmlFor="edit-desc">Description</label>
            <input
              id="edit-desc"
              value={editing.description ?? ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="mt-1 w-full rounded-xl border border-line bg-abyss px-3 py-2.5 text-sm outline-none focus:border-primary/60"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15 focus-ring">
                Cancel
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-2.5 text-sm font-bold hover:brightness-110 focus-ring">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
