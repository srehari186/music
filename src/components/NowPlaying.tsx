import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useMusicPlayer } from '../contexts/MusicPlayerContext'
import { getLikedSongIds, likeSong, unlikeSong } from '../services/songService'
import { coverFallback, formatTime, friendlyError } from '../utils'

export function NowPlaying({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = useMusicPlayer()
  const { user } = useAuth()
  const song = p.currentSong
  const [liked, setLiked] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)

  // Lock background scroll + close on Escape while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open || !user || !song) return
    let cancelled = false
    getLikedSongIds(user.id)
      .then((ids) => {
        if (!cancelled) setLiked(ids.has(song.id))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, user, song])

  if (!open || !song) return null

  const progress = p.duration > 0 ? (p.currentTime / p.duration) * 100 : 0
  const fetching = p.isLoading && p.loadDetail != null

  const toggleLike = async () => {
    if (!user || likeBusy) return
    setLikeBusy(true)
    try {
      if (liked) {
        await unlikeSong(user.id, song.id)
        toast.success('Removed from Liked Songs')
      } else {
        await likeSong(user.id, song.id)
        toast.success('Added to Liked Songs')
      }
      setLiked(!liked)
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update like'))
    } finally {
      setLikeBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-void"
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing ${song.title}`}
    >
      {/* Blurred cover backdrop */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img
          src={song.cover_url || coverFallback(song.title, song.artist)}
          alt=""
          className="h-full w-full scale-110 object-cover opacity-30 blur-3xl"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-void/60 via-void/80 to-void" />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 pt-4 sm:px-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <button
          onClick={onClose}
          aria-label="Close full screen player"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 focus-ring"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/50">Now playing</p>
        <button
          onClick={toggleLike}
          disabled={likeBusy}
          aria-label={liked ? `Unlike ${song.title}` : `Like ${song.title}`}
          aria-pressed={liked}
          className={`grid h-10 w-10 place-items-center rounded-full transition focus-ring ${
            liked ? 'bg-rose/20 text-rose' : 'bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
        </button>
      </header>

      {/* Cover + info */}
      <main className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-4 px-6 py-4 sm:gap-5">
          <img
            src={song.cover_url || coverFallback(song.title, song.artist)}
            alt={`${song.title} cover art`}
            className="mx-auto aspect-square w-full max-w-[280px] rounded-3xl object-cover shadow-card sm:max-w-[320px]"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = coverFallback(song.title, song.artist)
            }}
          />
          <div className="text-center">
            <h1 className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{song.title}</h1>
            <p className="mt-1 truncate text-sm text-white/60">{song.artist ?? 'Unknown artist'}</p>
          </div>

        {/* Progress: dim layer = fetched bytes, bright = playhead */}
        <div>
          {fetching && !p.streamSeekable ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
              {p.loadProgress != null ? (
                <div
                  className="loading-fill h-full rounded-full bg-gradient-to-r from-primary via-flame to-primary"
                  style={{ width: `${Math.round(p.loadProgress * 100)}%` }}
                />
              ) : (
                <div className="loading-slide h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-flame to-transparent" />
              )}
            </div>
          ) : (
            <div className="relative">
              {fetching && p.loadProgress != null && (
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div className="h-full rounded-full bg-white/25" style={{ width: `${Math.round(p.loadProgress * 100)}%` }} />
                </div>
              )}
              <label htmlFor="np-seek" className="sr-only">Seek</label>
              <input
                id="np-seek"
                type="range"
                min={0}
                max={p.duration || 0}
                step={0.5}
                value={Math.min(p.currentTime, p.duration || 0)}
                onChange={(e) => p.seek(Number(e.target.value))}
                className="wv-range relative w-full"
                aria-valuetext={`${formatTime(p.currentTime)} of ${formatTime(p.duration)}`}
              />
            </div>
          )}
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/50">
            <span>{formatTime(p.currentTime)}</span>
            <span>{fetching ? (p.loadDetail ?? 'Loading…') : formatTime(p.duration)}</span>
          </div>
          {fetching && (
            <p className="sr-only" role="status">
              {p.loadDetail}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-1 sm:gap-4">
          <button
            onClick={p.toggleShuffle}
            aria-label="Toggle shuffle"
            aria-pressed={p.shuffle}
            className={`rounded-full p-2 transition focus-ring sm:p-3 ${p.shuffle ? 'text-flame' : 'text-white/50 hover:text-white'}`}
          >
            <Shuffle className="h-5 w-5" />
          </button>
          <button onClick={p.previous} aria-label="Previous song" className="rounded-full p-2 text-white/85 transition hover:text-white focus-ring sm:p-3">
            <SkipBack className="h-6 w-6 fill-current sm:h-7 sm:w-7" />
          </button>
          <button
            onClick={p.togglePlay}
            aria-label={p.isPlaying ? 'Pause' : 'Play'}
            className="grid h-14 w-14 place-items-center rounded-full bg-white text-black shadow-glow transition hover:scale-105 focus-ring sm:h-16 sm:w-16"
          >
            {p.isPlaying ? <Pause className="h-6 w-6 fill-current sm:h-7 sm:w-7" /> : <Play className="ml-1 h-6 w-6 fill-current sm:h-7 sm:w-7" />}
          </button>
          <button onClick={p.next} aria-label="Next song" className="rounded-full p-2 text-white/85 transition hover:text-white focus-ring sm:p-3">
            <SkipForward className="h-6 w-6 fill-current sm:h-7 sm:w-7" />
          </button>
          <button
            onClick={p.cycleRepeat}
            aria-label={`Repeat mode: ${p.repeat}`}
            className={`rounded-full p-2 transition focus-ring sm:p-3 ${p.repeat !== 'off' ? 'text-flame' : 'text-white/50 hover:text-white'}`}
          >
            {p.repeat === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3">
          <button onClick={p.toggleMute} aria-label={p.muted ? 'Unmute' : 'Mute'} className="rounded-full p-2 text-white/60 hover:text-white focus-ring">
            {p.muted || p.volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <label htmlFor="np-vol" className="sr-only">Volume</label>
          <input
            id="np-vol"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={p.muted ? 0 : p.volume}
            onChange={(e) => p.setVolume(Number(e.target.value))}
            className="wv-range w-full"
          />
        </div>

        {/* Up next */}
        {p.queue.length > 1 && (
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/50">
              <ListMusic className="h-4 w-4" /> Up next
            </h2>
            <ol className="max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-line bg-black/30 p-2">
              {p.queue.map((track, i) => (
                <li key={track.id + i}>
                  <button
                    onClick={() => p.playSongs(p.queue, i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-white/5 focus-ring ${
                      i === p.queueIndex ? 'text-flame' : ''
                    }`}
                  >
                    <span className="w-5 shrink-0 text-xs text-white/40">{i + 1}</span>
                    <span className="flex-1 truncate font-medium">{track.title}</span>
                    <span className="max-w-[40%] truncate text-xs text-white/50">{track.artist}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-hidden />
        </div>
      </main>
    </div>
  )
}
