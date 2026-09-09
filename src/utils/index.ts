import type { Song } from '../types/database'

export function formatTime(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const s = Math.floor(totalSeconds)
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${m}:${rest.toString().padStart(2, '0')}`
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function formatCount(n: number | null | undefined): string {
  if (n == null) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${n}`
}

export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('invalid login credentials')) return 'Incorrect email or password. Please try again.'
    if (msg.includes('user already registered') || msg.includes('already registered')) return 'An account with this email already exists. Try logging in.'
    if (msg.includes('email not confirmed')) return 'Please verify your email, or contact support. (Email confirmation should be disabled in Supabase Auth settings.)'
    if (msg.includes('network') || msg.includes('fetch')) return 'Network error. Check your connection and try again.'
    if (msg.includes('jwt') || msg.includes('session')) return 'Your session expired. Please log in again.'
    return err.message
  }
  return fallback
}

export const PLAYBACK_ERROR_MESSAGE =
  'Playback could not be started. This audio source may not support browser streaming. Please try another source.'

export function isMegaUrl(url: string): boolean {
  try {
    const h = new URL(url.trim()).hostname.toLowerCase()
    return h === 'mega.nz' || h === 'mega.co.nz' || h.endsWith('.mega.nz') || h.endsWith('.mega.co.nz')
  } catch {
    return false
  }
}

/**
 * MEGA share links are streamable: Waveora resolves them in the browser
 * (public API + client-side decrypt) before handing audio to the player.
 */
export function classifyAudioUrl(url: string): { playable: boolean; warning?: string } {
  const trimmed = url.trim()
  if (!trimmed) return { playable: false, warning: 'Audio URL is required.' }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { playable: false, warning: 'That does not look like a valid URL.' }
  }
  if (isMegaUrl(trimmed)) {
    if (!trimmed.includes('#')) {
      return {
        playable: false,
        warning: 'This MEGA link is missing its decryption key (the part after #). Copy the full share link.'
      }
    }
    return { playable: true }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { playable: false, warning: 'Audio URL must use http(s), or be a MEGA share link.' }
  }
  return { playable: true }
}

export function coverFallback(title: string, artist?: string | null): string {
  const seed = encodeURIComponent(`${title}-${artist ?? 'waveora'}`)
  // Deterministic gradient placeholder (no external copyrighted art)
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}&backgroundColor=2c1114,1f0c0e`
}

export interface AlbumGroup {
  key: string
  name: string
  artist: string | null
  cover: string | null
  /** Tracks in album order (oldest first). */
  songs: Song[]
  /** ISO timestamp of the newest track — used to order albums. */
  latest: string
}

/**
 * Group songs sharing an `album` (as set by the MEGA folder import) into
 * single albums; songs without an album come back as singles.
 */
export function groupSongsByAlbum(songs: Song[]): { albums: AlbumGroup[]; singles: Song[] } {
  const map = new Map<string, AlbumGroup>()
  const singles: Song[] = []
  const newestFirst = [...songs].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  for (const s of newestFirst) {
    const name = s.album?.trim()
    if (!name) {
      singles.push(s)
      continue
    }
    const key = `${(s.artist ?? '').trim().toLowerCase()}|||${name.toLowerCase()}`
    let g = map.get(key)
    if (!g) {
      g = { key, name, artist: s.artist, cover: s.cover_url, songs: [], latest: s.created_at }
      map.set(key, g)
    }
    g.songs.push(s)
    if (!g.cover && s.cover_url) g.cover = s.cover_url
  }
  for (const g of map.values()) g.songs.reverse()
  const albums = [...map.values()].sort((a, b) => +new Date(b.latest) - +new Date(a.latest))
  return { albums, singles }
}
