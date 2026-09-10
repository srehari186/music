/**
 * Real-duration probing for songs.
 *
 * The catalog stores each song's true length (seconds) so lists, album
 * pages and the player can display it without playing first.
 *
 * - Direct audio URLs: a metadata-only preload (the browser fetches just
 *   the headers — fast and cheap).
 * - MEGA links: resolved + decrypted to a blob first (reuses the session
 *   cache, so a later playback starts instantly), then measured locally.
 */
import { isMegaUrl } from '../utils'
import { resolveMegaAudio, type MegaProgress } from './megaService'

function probeElementDuration(src: string, timeoutMs = 30000): Promise<number | null> {
  return new Promise((resolve) => {
    const el = new Audio()
    el.preload = 'metadata'
    let done = false
    const finish = (v: number | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      el.removeAttribute('src')
      el.load()
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    el.addEventListener('loadedmetadata', () => {
      const d = el.duration
      finish(Number.isFinite(d) && d > 0 ? Math.round(d) : null)
    })
    el.addEventListener('error', () => finish(null))
    el.src = src
  })
}

export async function probeDuration(
  url: string,
  onProgress?: (p: MegaProgress) => void
): Promise<number | null> {
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    if (isMegaUrl(trimmed)) {
      const resolved = await resolveMegaAudio(trimmed, onProgress)
      return await probeElementDuration(resolved.objectUrl, 15000)
    }
    return await probeElementDuration(trimmed)
  } catch {
    return null
  }
}
