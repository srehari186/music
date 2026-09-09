import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminCreateSong, type SongInput } from '../../services/songService'
import { ButtonSpinner } from '../../components/Loading'
import { classifyAudioUrl, friendlyError } from '../../utils'
import { SongFormFields } from './SongFormFields'

export function AddSongPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const onSubmit = async (input: SongInput) => {
    const check = classifyAudioUrl(input.audio_url)
    if (!check.playable) {
      toast.error(check.warning ?? 'Invalid audio URL')
      return
    }
    if (check.warning) toast(check.warning, { icon: '⚠️' });
    setBusy(true)
    try {
      await adminCreateSong(input)
      toast.success('Song added')
      navigate('/admin/songs', { replace: true })
    } catch (e) {
      toast.error(friendlyError(e, 'Could not add song'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to="/admin/songs" className="text-sm text-white/55 hover:text-white">← Back to songs</Link>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Add song</h1>
        <p className="mt-1 text-sm text-white/55">Paste a browser-compatible audio URL (e.g. https://…/song.mp3). MEGA share pages are not playable directly.</p>
      </div>
      <SongFormFields busy={busy} busyLabel="Adding…" submitLabel="Add song" onSubmit={onSubmit} extraSpinner={<ButtonSpinner />} />
    </div>
  )
}
