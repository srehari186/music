import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { adminUpdateSong, type SongInput } from '../../services/songService'
import type { Song } from '../../types/database'
import { ButtonSpinner, LoadingScreen } from '../../components/Loading'
import { friendlyError } from '../../utils'
import { SongFormFields } from './SongFormFields'

export function EditSongPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [song, setSong] = useState<Song | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase.from('songs').select('*').eq('id', id).single()
        if (error) throw error
        if (!cancelled) setSong(data as Song)
      } catch (e) {
        toast.error(friendlyError(e, 'Song not found'))
        navigate('/admin/songs', { replace: true })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  const onSubmit = async (input: SongInput) => {
    if (!id) return
    setBusy(true)
    try {
      await adminUpdateSong(id, input)
      toast.success('Song updated')
      navigate('/admin/songs', { replace: true })
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update song'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingScreen label="Loading song…" />
  if (!song) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to="/admin/songs" className="text-sm text-white/55 hover:text-white">← Back to songs</Link>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Edit song</h1>
        <p className="mt-1 text-sm text-white/55">{song.title} — {song.artist}</p>
      </div>
      <SongFormFields
        initial={{
          title: song.title,
          artist: song.artist ?? '',
          album: song.album,
          genre: song.genre,
          description: song.description,
          cover_url: song.cover_url,
          audio_url: song.audio_url,
          duration: song.duration,
          release_year: song.release_year,
          featured: song.featured
        }}
        busy={busy}
        busyLabel="Saving…"
        submitLabel="Save changes"
        onSubmit={onSubmit}
        extraSpinner={<ButtonSpinner />}
      />
    </div>
  )
}
