import { useState } from 'react'
import {
  AlertTriangle,
  ListMusic,
  Loader2,
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
import { useMusicPlayer } from '../../contexts/MusicPlayerContext'
import { coverFallback, formatTime } from '../../utils'
import { NowPlaying } from '../NowPlaying'

export function AudioPlayer() {
  const p = useMusicPlayer()
  const [queueOpen, setQueueOpen] = useState(false)
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false)
  const song = p.currentSong

  if (!song) return null

  const progress = p.duration > 0 ? (p.currentTime / p.duration) * 100 : 0
  // While a MEGA link is being fetched/decrypted there is no playable
  // timeline yet — the seek bar itself becomes the loading indicator.
  const fetching = p.isLoading && p.loadDetail != null

  return (
    <>
      {p.playbackError && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-36 md:pb-28" role="alert">
          <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-amber-400/30 bg-[#241a08]/95 p-3 text-sm shadow-card">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
            <p className="flex-1 text-amber-100">{p.playbackError}</p>
            <button onClick={p.clearError} aria-label="Dismiss playback error" className="rounded p-1 text-amber-200 hover:text-white focus-ring">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {queueOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-36 md:pb-28" role="dialog" aria-label="Up next queue">
          <div className="glass mx-auto max-h-72 max-w-3xl overflow-hidden rounded-2xl shadow-card">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ListMusic className="h-4 w-4" /> Up next ({p.queue.length})
              </p>
              <button onClick={() => setQueueOpen(false)} aria-label="Close queue" className="rounded p-1.5 text-white/60 hover:text-white focus-ring">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="max-h-56 overflow-y-auto p-2">
              {p.queue.map((q, i) => (
                <li key={q.id + i}>
                  <button
                    onClick={() => p.playSongs(p.queue, i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5 focus-ring ${
                      i === p.queueIndex ? 'text-flame' : ''
                    }`}
                  >
                    <span className="w-5 text-xs text-white/40">{i + 1}</span>
                    <span className="flex-1 truncate font-medium">{q.title}</span>
                    <span className="truncate text-xs text-white/50">{q.artist}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className="fixed inset-x-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 overflow-hidden rounded-2xl border border-line bg-abyss/95 shadow-card backdrop-blur-xl lg:inset-x-0 lg:bottom-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:border-t lg:shadow-none lg:pb-[env(safe-area-inset-bottom)]">
        {/* progress / fetch-loading bar. While streaming, the dim layer is
            fetched bytes (YouTube-style) and the bright layer is the playhead. */}
        <div className="group relative h-1 w-full bg-white/10" role="presentation">
          {fetching ? (
            <div className="absolute inset-0 overflow-hidden" aria-hidden>
              {p.loadProgress != null ? (
                <div className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${Math.round(p.loadProgress * 100)}%` }} />
              ) : (
                <div className="loading-slide h-full w-1/3 bg-gradient-to-r from-transparent via-flame to-transparent" />
              )}
              {p.loadProgress != null && (
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-flame" style={{ width: `${progress}%` }} />
              )}
            </div>
          ) : (
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-flame" style={{ width: `${progress}%` }} />
          )}
          <label htmlFor="wv-seek" className="sr-only">Seek</label>
          <input
            id="wv-seek"
            type="range"
            min={0}
            max={p.duration || 0}
            step={0.5}
            value={Math.min(p.currentTime, p.duration || 0)}
            onChange={(e) => p.seek(Number(e.target.value))}
            disabled={fetching && !p.streamSeekable}
            className="wv-range absolute inset-x-0 -top-1.5 h-4 w-full opacity-0 transition group-hover:opacity-100 disabled:opacity-0"
            aria-valuetext={fetching && !p.streamSeekable ? 'Loading audio' : `${formatTime(p.currentTime)} of ${formatTime(p.duration)}`}
          />
        </div>
        {fetching && (
          <p className="sr-only" role="status">
            {p.loadDetail}
          </p>
        )}

        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 md:gap-4 md:px-6 md:py-3">
          {/* Mobile bottom nav offset: player sits above nav on mobile */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:max-w-xs">
            <button
              onClick={() => setNowPlayingOpen(true)}
              aria-label={`Open full screen player for ${song.title}`}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left transition hover:opacity-90 focus-ring sm:gap-3"
            >
              <img
                src={song.cover_url || coverFallback(song.title, song.artist)}
                alt=""
                className="h-10 w-10 shrink-0 rounded-xl object-cover sm:h-11 sm:w-11 md:h-14 md:w-14"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{song.title}</span>
                <span className="block truncate text-xs text-white/55">{song.artist ?? 'Unknown artist'}</span>
              </span>
            </button>
            {p.isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-flame" aria-label="Loading audio" />}
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={p.toggleShuffle}
              aria-label="Toggle shuffle"
              aria-pressed={p.shuffle}
              className={`hidden rounded-full p-2 transition focus-ring sm:block ${p.shuffle ? 'text-flame' : 'text-white/50 hover:text-white'}`}
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button onClick={p.previous} aria-label="Previous song" className="rounded-full p-2 text-white/80 transition hover:text-white focus-ring">
              <SkipBack className="h-5 w-5 fill-current" />
            </button>
            <button
              onClick={p.togglePlay}
              aria-label={p.isPlaying ? 'Pause' : 'Play'}
              className="grid h-11 w-11 place-items-center rounded-full bg-white text-black transition hover:scale-105 focus-ring"
            >
              {p.isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>
            <button onClick={p.next} aria-label="Next song" className="rounded-full p-2 text-white/80 transition hover:text-white focus-ring">
              <SkipForward className="h-5 w-5 fill-current" />
            </button>
            <button
              onClick={p.cycleRepeat}
              aria-label={`Repeat mode: ${p.repeat}`}
              className={`hidden rounded-full p-2 transition focus-ring sm:block ${p.repeat !== 'off' ? 'text-flame' : 'text-white/50 hover:text-white'}`}
            >
              {p.repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </button>
          </div>

          <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
            <span className="w-10 text-right text-[11px] tabular-nums text-white/50">{formatTime(p.currentTime)}</span>
            {fetching && !p.streamSeekable ? (
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
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
              <div className="group/seek relative flex h-4 flex-1 items-center">
                {fetching && p.loadProgress != null && (
                  <div className="absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <div className="h-full rounded-full bg-white/25" style={{ width: `${Math.round(p.loadProgress * 100)}%` }} />
                  </div>
                )}
                <label htmlFor="wv-seek2" className="sr-only">Seek</label>
                <input
                  id="wv-seek2"
                  type="range"
                  min={0}
                  max={p.duration || 0}
                  step={0.5}
                  value={Math.min(p.currentTime, p.duration || 0)}
                  onChange={(e) => p.seek(Number(e.target.value))}
                  className="wv-range relative w-full"
                />
              </div>
            )}
            <span className="w-10 text-[11px] tabular-nums text-white/50">{formatTime(p.duration)}</span>
          </div>

          <div className="hidden items-center gap-1 lg:flex">
            <button onClick={p.toggleMute} aria-label={p.muted ? 'Unmute' : 'Mute'} className="rounded-full p-2 text-white/60 hover:text-white focus-ring">
              {p.muted || p.volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <label htmlFor="wv-vol" className="sr-only">Volume</label>
            <input
              id="wv-vol"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={p.muted ? 0 : p.volume}
              onChange={(e) => p.setVolume(Number(e.target.value))}
              className="wv-range w-24"
            />
            <button
              onClick={() => setQueueOpen((o) => !o)}
              aria-label="Toggle queue"
              aria-expanded={queueOpen}
              className={`rounded-full p-2 transition focus-ring ${queueOpen ? 'text-flame' : 'text-white/60 hover:text-white'}`}
            >
              <ListMusic className="h-4 w-4" />
            </button>
          </div>

          {/* mobile queue button */}
          <button
            onClick={() => setQueueOpen((o) => !o)}
            aria-label="Toggle queue"
            className="rounded-full p-2 text-white/60 hover:text-white focus-ring lg:hidden"
          >
            <ListMusic className="h-4 w-4" />
          </button>
        </div>
      </div>
      <NowPlaying open={nowPlayingOpen} onClose={() => setNowPlayingOpen(false)} />
    </>
  )
}
