import { useState } from 'react'
import { ListPlus, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Playlist, Song } from '../types/database'
import { addSongToPlaylist } from '../services/playlistService'
import { friendlyError } from '../utils'

export function AddToPlaylistModal({
  song,
  playlists,
  onClose,
  onCreated
}: {
  song: Song | null
  playlists: Playlist[]
  onClose: () => void
  onCreated?: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  if (!song) return null

  const add = async (playlistId: string, name: string) => {
    setBusyId(playlistId)
    try {
      await addSongToPlaylist(playlistId, song.id)
      toast.success(`Added to ${name}`)
      onCreated?.()
      onClose()
    } catch (e) {
      toast.error(friendlyError(e, 'Could not add to playlist'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`Add ${song.title} to playlist`}>
      <div className="glass w-full max-w-sm rounded-2xl p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display font-bold">
            <ListPlus className="h-5 w-5 text-aqua" /> Add to playlist
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1.5 text-white/60 hover:text-white focus-ring">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 truncate text-sm text-white/60">{song.title} — {song.artist}</p>
        {playlists.length === 0 ? (
          <p className="rounded-xl bg-white/5 p-4 text-center text-sm text-white/60">
            No playlists yet. Create one from the Playlists page first.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {playlists.map((pl) => (
              <li key={pl.id}>
                <button
                  onClick={() => add(pl.id, pl.name)}
                  disabled={busyId === pl.id}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/5 focus-ring disabled:opacity-60"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/50 to-aqua/40">
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate font-medium">{pl.name}</span>
                  <span className="text-xs text-white/40">{pl.song_count ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
