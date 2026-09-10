import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CheckSquare, Disc3, FolderDown, Square } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ButtonSpinner } from '../../components/Loading'
import { classifyAudioUrl, friendlyError } from '../../utils'
import {
  buildMegaFileUrl,
  listMegaFolderTracks,
  suggestTrackTitle,
  type MegaFolderTrack
} from '../../services/megaService'

interface DraftTrack extends MegaFolderTrack {
  selected: boolean
  title: string
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export function FolderImportPage() {
  const navigate = useNavigate()
  const [folderUrl, setFolderUrl] = useState('')
  const [album, setAlbum] = useState('')
  const [artist, setArtist] = useState('')
  const [genre, setGenre] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [year, setYear] = useState('')
  const [featured, setFeatured] = useState(false)
  const [tracks, setTracks] = useState<DraftTrack[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFetch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const check = classifyAudioUrl(folderUrl)
    if (!check.playable) {
      setError(check.warning ?? 'Invalid folder link.')
      return
    }
    if (!album.trim()) {
      setError('Album name is required — it will be applied to every imported song.')
      return
    }
    if (!artist.trim()) {
      setError('Artist is required — it will be applied to every imported song.')
      return
    }
    setFetching(true)
    try {
      const list = await listMegaFolderTracks(folderUrl.trim())
      if (list.length === 0) {
        setError('No playable audio files were found in this folder (looking for mp3, m4a, ogg, wav, flac, opus…).')
        setTracks(null)
        return
      }
      setTracks(list.map((t) => ({ ...t, selected: true, title: suggestTrackTitle(t.name) })))
      toast.success(`Found ${list.length} audio ${list.length === 1 ? 'file' : 'files'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this folder.')
      setTracks(null)
    } finally {
      setFetching(false)
    }
  }

  const selected = tracks?.filter((t) => t.selected) ?? []

  const onImport = async () => {
    if (!tracks || selected.length === 0) return
    const base = folderUrl.trim()
    const albumName = album.trim()
    const artistName = artist.trim()
    // Final guard: every title must be non-empty
    if (selected.some((t) => !t.title.trim())) {
      setError('Every selected track needs a title.')
      return
    }
    setImporting(true)
    setError(null)
    try {
      const rows = selected.map((t) => ({
        title: t.title.trim(),
        artist: artistName,
        album: albumName,
        genre: genre.trim() || null,
        description: null,
        cover_url: coverUrl.trim() || null,
        audio_url: buildMegaFileUrl(base, t.id),
        duration: null,
        release_year: year ? Number(year) || null : null,
        featured
      }))
      const { error: insertError } = await supabase.from('songs').insert(rows as never)
      if (insertError) throw insertError
      toast.success(`Imported “${albumName}” — ${rows.length} songs`)
      navigate('/admin/songs', { replace: true })
    } catch (err) {
      setError(friendlyError(err, 'Could not import these songs.'))
    } finally {
      setImporting(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-line bg-abyss px-4 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-primary/60'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/admin/songs" className="text-sm text-white/55 hover:text-white">← Back to songs</Link>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight">
          <FolderDown className="h-7 w-7 text-flame" /> Import MEGA folder as album
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Paste a <code className="text-flame">mega.nz/folder/…#key…</code> link. Every audio file inside becomes a song
          with the same album name and cover image. Only import folders you have the right to stream.
        </p>
      </div>

      <form onSubmit={onFetch} className="glass space-y-4 rounded-3xl p-6" noValidate>
        {error && (
          <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose" role="alert">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="fi-url" className="mb-1.5 block text-sm font-medium">MEGA folder link *</label>
          <input
            id="fi-url"
            type="url"
            value={folderUrl}
            onChange={(e) => setFolderUrl(e.target.value)}
            placeholder="https://mega.nz/folder/XXXX…#KEY…"
            className={inputCls}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fi-album" className="mb-1.5 block text-sm font-medium">Album name *</label>
            <input id="fi-album" value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="Afterglow" className={inputCls} required />
          </div>
          <div>
            <label htmlFor="fi-artist" className="mb-1.5 block text-sm font-medium">Artist *</label>
            <input id="fi-artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Nova Rey" className={inputCls} required />
          </div>
          <div>
            <label htmlFor="fi-genre" className="mb-1.5 block text-sm font-medium">Genre</label>
            <input id="fi-genre" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Electronic" className={inputCls} />
          </div>
          <div>
            <label htmlFor="fi-year" className="mb-1.5 block text-sm font-medium">Release year</label>
            <input id="fi-year" type="number" min={1900} max={2100} value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025" className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="fi-cover" className="mb-1.5 block text-sm font-medium">Cover image URL (shared by all songs)</label>
          <input
            id="fi-cover"
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://example.com/album-cover.jpg"
            className={inputCls}
          />
        </div>
        <label htmlFor="fi-feat" className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-abyss px-4 py-3 text-sm">
          <input id="fi-feat" type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-[#e8262f]" />
          <span className="font-semibold">Mark all as featured</span>
        </label>
        <button
          type="submit"
          disabled={fetching}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-3 text-sm font-bold shadow-glow hover:brightness-110 disabled:opacity-60 focus-ring"
        >
          {fetching && <ButtonSpinner />} {fetching ? 'Reading folder…' : tracks ? 'Re-read folder' : 'Fetch tracks from folder'}
        </button>
      </form>

      {tracks && (
        <section className="glass rounded-3xl p-6" aria-label="Tracks found">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display font-bold">
              <Disc3 className="h-5 w-5 text-flame" /> {tracks.length} tracks found ({selected.length} selected)
            </h2>
            <div className="flex gap-2 text-xs font-semibold">
              <button
                onClick={() => setTracks(tracks.map((t) => ({ ...t, selected: true })))}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15 focus-ring"
              >
                <CheckSquare className="h-3.5 w-3.5" /> All
              </button>
              <button
                onClick={() => setTracks(tracks.map((t) => ({ ...t, selected: false })))}
                className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-white/70 hover:bg-white/10 hover:text-white focus-ring"
              >
                <Square className="h-3.5 w-3.5" /> None
              </button>
            </div>
          </div>
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {tracks.map((t, i) => (
              <li key={t.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${t.selected ? 'border-line bg-abyss' : 'border-transparent bg-white/[0.02] opacity-60'}`}>
                <input
                  type="checkbox"
                  checked={t.selected}
                  onChange={() => setTracks(tracks.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)))}
                  aria-label={`Include ${t.name}`}
                  className="h-4 w-4 shrink-0 accent-[#e8262f]"
                />
                <span className="hidden w-6 shrink-0 text-right text-xs text-white/35 sm:block">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <label htmlFor={`fi-track-${i}`} className="sr-only">Title for {t.name}</label>
                  <input
                    id={`fi-track-${i}`}
                    value={t.title}
                    onChange={(e) => setTracks(tracks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium outline-none focus:border-primary/60 focus:bg-white/5"
                  />
                  <p className="truncate px-2 text-[11px] text-white/40">{t.name}{t.size != null && ` • ${formatSize(t.size)}`}</p>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={onImport}
            disabled={importing || selected.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black hover:bg-white/85 disabled:opacity-40 focus-ring"
          >
            {importing && <ButtonSpinner />} {importing ? 'Importing…' : `Import ${selected.length} ${selected.length === 1 ? 'track' : 'tracks'} as “${album.trim() || 'album'}”`}
          </button>
        </section>
      )}
    </div>
  )
}
