import { useState } from 'react'
import type { SongInput } from '../../services/songService'
import { classifyAudioUrl } from '../../utils'

interface Props {
  initial?: Partial<SongInput>
  busy: boolean
  busyLabel: string
  submitLabel: string
  onSubmit: (input: SongInput) => void
  extraSpinner?: React.ReactNode
}

export function SongFormFields({ initial, busy, busyLabel, submitLabel, onSubmit, extraSpinner }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [artist, setArtist] = useState(initial?.artist ?? '')
  const [album, setAlbum] = useState(initial?.album ?? '')
  const [genre, setGenre] = useState(initial?.genre ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url ?? '')
  const [audioUrl, setAudioUrl] = useState(initial?.audio_url ?? '')
  const [duration, setDuration] = useState(initial?.duration != null ? String(initial.duration) : '')
  const [year, setYear] = useState(initial?.release_year != null ? String(initial.release_year) : '')
  const [featured, setFeatured] = useState(Boolean(initial?.featured))
  const [error, setError] = useState<string | null>(null)
  const [audioHint, setAudioHint] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) {
      setError('Song title is required.')
      return
    }
    if (!artist.trim()) {
      setError('Artist is required.')
      return
    }
    if (!audioUrl.trim()) {
      setError('Audio URL is required.')
      return
    }
    const check = classifyAudioUrl(audioUrl)
    setAudioHint(check.warning ?? null)
    if (!check.playable) {
      setError(check.warning ?? 'Invalid audio URL.')
      return
    }
    onSubmit({
      title: title.trim(),
      artist: artist.trim(),
      album: album.trim() || null,
      genre: genre.trim() || null,
      description: description.trim() || null,
      cover_url: coverUrl.trim() || null,
      audio_url: audioUrl.trim(),
      duration: duration ? Number(duration) || null : null,
      release_year: year ? Number(year) || null : null,
      featured
    })
  }

  const inputCls =
    'w-full rounded-xl border border-line bg-abyss px-4 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-primary/60'

  return (
    <form onSubmit={submit} className="glass space-y-4 rounded-3xl p-6" noValidate>
      {error && (
        <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose" role="alert">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sf-title" className="mb-1.5 block text-sm font-medium">Song title *</label>
          <input id="sf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Midnight Frequency" className={inputCls} required />
        </div>
        <div>
          <label htmlFor="sf-artist" className="mb-1.5 block text-sm font-medium">Artist *</label>
          <input id="sf-artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Nova Rey" className={inputCls} required />
        </div>
        <div>
          <label htmlFor="sf-album" className="mb-1.5 block text-sm font-medium">Album</label>
          <input id="sf-album" value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="Afterglow" className={inputCls} />
        </div>
        <div>
          <label htmlFor="sf-genre" className="mb-1.5 block text-sm font-medium">Genre</label>
          <input id="sf-genre" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Electronic" className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor="sf-desc" className="mb-1.5 block text-sm font-medium">Description</label>
        <textarea id="sf-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="A shimmering late-night synth drive…" className={inputCls} />
      </div>
      <div>
        <label htmlFor="sf-cover" className="mb-1.5 block text-sm font-medium">Cover image URL</label>
        <input id="sf-cover" type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://example.com/cover.jpg" className={inputCls} />
      </div>
      <div>
        <label htmlFor="sf-audio" className="mb-1.5 block text-sm font-medium">Audio URL *</label>
        <input
          id="sf-audio"
          type="url"
          value={audioUrl}
          onChange={(e) => {
            setAudioUrl(e.target.value)
            if (e.target.value.trim()) {
              const c = classifyAudioUrl(e.target.value)
              setAudioHint(c.warning ?? null)
            } else setAudioHint(null)
          }}
          placeholder="https://example.com/song.mp3"
          className={inputCls}
          required
        />
        {audioHint && <p className="mt-1.5 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{audioHint}</p>}
        <p className="mt-1.5 text-xs text-white/40">Must be a direct, browser-streamable audio file. Only use URLs you have rights to stream.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sf-dur" className="mb-1.5 block text-sm font-medium">Duration (seconds)</label>
          <input id="sf-dur" type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="210" className={inputCls} />
        </div>
        <div>
          <label htmlFor="sf-year" className="mb-1.5 block text-sm font-medium">Release year</label>
          <input id="sf-year" type="number" min={1900} max={2100} value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025" className={inputCls} />
        </div>
      </div>
      <label htmlFor="sf-feat" className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-abyss px-4 py-3 text-sm">
        <input id="sf-feat" type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-[#7c5cff]" />
        <span><span className="font-semibold">Featured song</span><span className="block text-xs text-white/50">Show in the Featured section on Home</span></span>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-3 text-sm font-bold shadow-glow hover:brightness-110 disabled:opacity-60 focus-ring"
      >
        {busy && extraSpinner} {busy ? busyLabel : submitLabel}
      </button>
    </form>
  )
}
