import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import type { Song } from '../types/database'
import { createAudioProvider, type AudioProvider } from '../services/audioService'
import { incrementPlayCount, recordRecentlyPlayed } from '../services/songService'
import { supabase } from '../lib/supabase'
import { PLAYBACK_ERROR_MESSAGE, isMegaUrl } from '../utils'
import { MegaCancelledError, openMegaStream } from '../services/megaService'

export type RepeatMode = 'off' | 'all' | 'one'

interface PlayerState {
  currentSong: Song | null
  queue: Song[]
  queueIndex: number
  isPlaying: boolean
  isLoading: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  playbackError: string | null
  /** 0..1 while a MEGA link is being fetched/decrypted, else null */
  loadProgress: number | null
  /** Human-readable fetch status (e.g. "Fetching from MEGA… 42%"), else null */
  loadDetail: string | null
  playSongs: (songs: Song[], startIndex?: number) => void
  playSong: (song: Song, context?: Song[]) => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  clearError: () => void
}

const MusicPlayerContext = createContext<PlayerState | null>(null)

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Song[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.85)
  const [muted, setMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState<number | null>(null)
  const [loadDetail, setLoadDetail] = useState<string | null>(null)

  const providerRef = useRef<AudioProvider | null>(null)
  const countedForRef = useRef<string | null>(null)
  const resolveGen = useRef(0)
  const cancelInflight = useRef<(() => void) | null>(null)
  const shuffleRef = useRef(shuffle)
  const repeatRef = useRef(repeat)
  shuffleRef.current = shuffle
  repeatRef.current = repeat

  const currentSong = queue[queueIndex] ?? null

  useEffect(() => {
    const provider = createAudioProvider()
    providerRef.current = provider
    const el = provider.getElement()
    el.volume = 0.85

    const onTime = () => setCurrentTime(el.currentTime)
    const onMeta = () => setDuration(el.duration || 0)
    const onWaiting = () => setIsLoading(true)
    const onPlaying = () => {
      setIsLoading(false)
      setIsPlaying(true)
      setPlaybackError(null)
    }
    const onPause = () => setIsPlaying(false)
    const onError = () => {
      setIsLoading(false)
      setIsPlaying(false)
      setLoadProgress(null)
      setLoadDetail(null)
      setPlaybackError(PLAYBACK_ERROR_MESSAGE)
      toast.error(PLAYBACK_ERROR_MESSAGE)
    }
    const onEnded = () => handleEnded()

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('waiting', onWaiting)
    el.addEventListener('playing', onPlaying)
    el.addEventListener('pause', onPause)
    el.addEventListener('error', onError)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('playing', onPlaying)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('error', onError)
      el.removeEventListener('ended', onEnded)
      provider.dispose()
      providerRef.current = null
      resolveGen.current++
      cancelInflight.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEnded = useCallback(() => {
    if (repeatRef.current === 'one') {
      const el = providerRef.current?.getElement()
      if (el) {
        el.currentTime = 0
        void el.play().catch(() => {})
      }
      return
    }
    nextRef.current()
  }, [])

  const loadAndPlay = useCallback(async (song: Song) => {
    const provider = providerRef.current
    if (!provider) return
    // Invalidate any in-flight source resolution (e.g. a MEGA fetch) so a
    // stale download can never hijack the newly requested song.
    const gen = ++resolveGen.current
    cancelInflight.current?.()
    let cancelled = false
    cancelInflight.current = () => {
      cancelled = true
    }
    const isStale = () => cancelled || resolveGen.current !== gen

    countedForRef.current = null
    setPlaybackError(null)
    setIsLoading(true)
    setCurrentTime(0)
    setDuration(song.duration ?? 0)
    const needsMega = isMegaUrl(song.audio_url)
    setLoadProgress(needsMega ? 0 : null)
    setLoadDetail(needsMega ? 'Connecting to MEGA…' : null)
    try {
      if (!needsMega) {
        provider.load(song.audio_url)
        await provider.play()
      } else {
        // MEGA: sniff the true length, then open a progressive stream and
        // start playback immediately — chunks flow in while fetching
        // continues, with the real duration shown from the start.
        const session = await openMegaStream(
          song.audio_url,
          (p) => {
            if (isStale()) return
            setLoadProgress(p.ratio)
            setLoadDetail(
              p.ratio != null
                ? `Fetching from MEGA… ${Math.round(p.ratio * 100)}%`
                : 'Fetching from MEGA…'
            )
          },
          { cancelled: isStale }
        )
        if (isStale()) return
        if (session.duration && session.duration > 0) setDuration(session.duration)
        provider.load(session.url)
        if (!session.streaming) {
          setLoadProgress(null)
          setLoadDetail(null)
          await provider.play()
        } else {
          // Race playback start against stream death: if the fetch dies
          // before the first audio plays, surface the error now instead of
          // hanging on a silent loader. Later failures surface through the
          // element's own error handler (endOfStream('network')).
          const never = new Promise<never>(() => {})
          await Promise.race([provider.play(), session.done.then(() => never)])
          // Keep the fetch indicator (and disabled seeking) until fully done.
          void session.done.then(
            () => {
              if (!isStale()) {
                setLoadProgress(null)
                setLoadDetail(null)
              }
            },
            () => {
              if (!isStale()) {
                setLoadProgress(null)
                setLoadDetail(null)
              }
            }
          )
        }
      }
      // Count a play only after playback actually started (threshold met)
      if (countedForRef.current !== song.id) {
        countedForRef.current = song.id
        void incrementPlayCount(song.id)
        const { data } = await supabase.auth.getUser()
        if (data.user) void recordRecentlyPlayed(data.user.id, song.id)
      }
    } catch (e) {
      if (e instanceof MegaCancelledError || isStale()) return
      setIsLoading(false)
      setIsPlaying(false)
      setLoadProgress(null)
      setLoadDetail(null)
      const message = e instanceof Error ? e.message : PLAYBACK_ERROR_MESSAGE
      setPlaybackError(message)
      toast.error(message)
    }
  }, [])

  const playSongs = useCallback(
    (songs: Song[], startIndex = 0) => {
      if (songs.length === 0) return
      const idx = Math.min(Math.max(0, startIndex), songs.length - 1)
      setQueue(songs)
      setQueueIndex(idx)
      void loadAndPlay(songs[idx])
    },
    [loadAndPlay]
  )

  const playSong = useCallback(
    (song: Song, context?: Song[]) => {
      if (context && context.length > 0) {
        const i = context.findIndex((s) => s.id === song.id)
        playSongs(context, i >= 0 ? i : 0)
      } else {
        playSongs([song], 0)
      }
    },
    [playSongs]
  )

  const togglePlay = useCallback(() => {
    const provider = providerRef.current
    if (!provider || !currentSong) return
    const el = provider.getElement()
    if (el.paused) {
      setPlaybackError(null)
      void el.play().catch(() => {
        setPlaybackError(PLAYBACK_ERROR_MESSAGE)
        toast.error(PLAYBACK_ERROR_MESSAGE)
      })
    } else {
      el.pause()
    }
  }, [currentSong])

  const pickNextIndex = useCallback((): number | null => {
    if (queue.length === 0) return null
    if (shuffleRef.current) {
      if (queue.length === 1) return repeatRef.current === 'all' ? 0 : null
      let n = queueIndex
      while (n === queueIndex) n = Math.floor(Math.random() * queue.length)
      return n
    }
    if (queueIndex + 1 < queue.length) return queueIndex + 1
    return repeatRef.current === 'all' ? 0 : null
  }, [queue.length, queueIndex])

  const next = useCallback(() => {
    const n = pickNextIndex()
    if (n == null) {
      setIsPlaying(false)
      return
    }
    setQueueIndex(n)
    void loadAndPlay(queue[n])
  }, [pickNextIndex, queue, loadAndPlay])

  const nextRef = useRef(next)
  nextRef.current = next

  const previous = useCallback(() => {
    const el = providerRef.current?.getElement()
    if (el && el.currentTime > 3) {
      el.currentTime = 0
      return
    }
    if (queueIndex > 0) {
      const n = queueIndex - 1
      setQueueIndex(n)
      void loadAndPlay(queue[n])
    } else if (el) {
      el.currentTime = 0
    }
  }, [queue, queueIndex, loadAndPlay])

  const seek = useCallback((seconds: number) => {
    providerRef.current?.seek(seconds)
    setCurrentTime(seconds)
  }, [])

  const setVolume = useCallback((v: number) => {
    setVolumeState(v)
    providerRef.current?.setVolume(v)
    if (v > 0) {
      setMuted(false)
      providerRef.current?.setMuted(false)
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      providerRef.current?.setMuted(!m)
      return !m
    })
  }, [])

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), [])
  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
  }, [])
  const clearError = useCallback(() => setPlaybackError(null), [])

  const value = useMemo<PlayerState>(
    () => ({
      currentSong,
      queue,
      queueIndex,
      isPlaying,
      isLoading,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      playbackError,
      loadProgress,
      loadDetail,
      playSongs,
      playSong,
      togglePlay,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      clearError
    }),
    [currentSong, queue, queueIndex, isPlaying, isLoading, currentTime, duration, volume, muted, shuffle, repeat, playbackError, loadProgress, loadDetail, playSongs, playSong, togglePlay, next, previous, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat, clearError]
  )

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>
}

export function useMusicPlayer(): PlayerState {
  const ctx = useContext(MusicPlayerContext)
  if (!ctx) throw new Error('useMusicPlayer must be used within MusicPlayerProvider')
  return ctx
}
