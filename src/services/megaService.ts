/**
 * MEGA streaming service.
 *
 * A pasted `mega.nz` share link is not a playable audio file — it is an
 * encrypted file ID + key. This service resolves it entirely in the browser:
 *
 *   1. Parse the share link (megajs `File.fromURL` supports new
 *      `mega.nz/file|folder/...` links and legacy `/#!...` links).
 *   2. Fetch file metadata over MEGA's public JSON API (fetch-based, no backend).
 *   3. Download the ciphertext in chunks and decrypt it client-side
 *      (AES-128-CTR, handled by megajs).
 *   4. Expose the plaintext as a Blob object URL the HTMLAudio player can play.
 *
 * Only use MEGA links for files you have the legal right to stream.
 * Resolved audio is cached in memory for the session so replays are instant.
 */
import { isMegaUrl } from '../utils'

export interface MegaProgress {
  bytesLoaded: number
  bytesTotal: number | null
  /** 0..1, or null when the total size is unknown */
  ratio: number | null
}

export interface CancelHandle {
  cancelled: () => boolean
}

/** Thrown when a resolve is superseded (user skipped tracks). Never shown to users. */
export class MegaCancelledError extends Error {
  constructor() {
    super('__mega_cancelled__')
  }
}

interface MegaStreamLike {
  on(event: 'data' | 'end' | 'error' | 'progress', cb: (...args: never[]) => void): unknown
  destroy?: () => void
}

interface MegaFileLike {
  name?: string
  size?: number
  directory?: boolean
  children?: MegaFileLike[]
  nodeId?: string
  downloadId?: string
  loadedFile?: string
  api: { userAgent: string | null }
  loadAttributes(): Promise<unknown>
  download(options?: Record<string, unknown>): MegaStreamLike
}

interface MegaFileConstructor {
  fromURL(url: string): MegaFileLike
}

const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'webm', 'weba', 'mp4']

/** Session cache: share-link -> playable blob URL (avoids re-downloading). */
const cache = new Map<string, { objectUrl: string; fileName: string; size: number | null }>()
const MAX_CACHE = 12

function extOf(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase()
}

function isAudioName(name: string): boolean {
  return AUDIO_EXTS.includes(extOf(name))
}

function mimeFor(name: string): string {
  switch (extOf(name)) {
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'ogg':
    case 'oga':
    case 'opus':
      return 'audio/ogg'
    case 'm4a':
    case 'aac':
      return 'audio/mp4'
    case 'flac':
      return 'audio/flac'
    case 'webm':
    case 'weba':
      return 'audio/webm'
    case 'mp4':
      return 'audio/mp4'
    default:
      return 'audio/mpeg'
  }
}

function findRecursive(files: MegaFileLike[], pred: (f: MegaFileLike) => boolean): MegaFileLike | null {
  for (const f of files) {
    if (pred(f)) return f
    if (f.children && f.children.length > 0) {
      const hit = findRecursive(f.children, pred)
      if (hit) return hit
    }
  }
  return null
}

/**
 * A folder link is ambiguous as a "song": prefer the file embedded in the
 * link (…/file/<id>), otherwise the first playable audio file inside.
 */
function pickAudioFromFolder(folder: MegaFileLike): MegaFileLike | null {
  const kids = folder.children ?? []
  if (folder.loadedFile) {
    const wanted = folder.loadedFile
    const match = findRecursive(kids, (f) => f.nodeId === wanted || f.downloadId === wanted)
    if (match && !match.directory) return match
  }
  return findRecursive(kids, (f) => !f.directory && !!f.name && isAudioName(f.name))
}

export function megaFriendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const msg = raw.toLowerCase()
  // eslint-disable-next-line no-console
  console.warn('[Waveora:MEGA]', raw)
  if (
    msg.includes('invalid url') ||
    msg.includes('format not recognized') ||
    msg.includes('wrong hostname') ||
    msg.includes('no hash') ||
    msg.includes('too few arguments') ||
    msg.includes('too many arguments')
  ) {
    return 'That MEGA link looks invalid. Paste the full share link, e.g. https://mega.nz/file/XXXX…#KEY…'
  }
  if (msg.includes('enoent') || msg.includes('not found') || msg.includes('elink') || msg.includes('-8')) {
    return 'This MEGA file was not found. It may have been deleted, or the link is wrong.'
  }
  if (msg.includes('eaccess') || msg.includes('access denied') || msg.includes('-9') || msg.includes('private')) {
    return 'MEGA denied access to this file. Make sure it is a public link that includes the key.'
  }
  if (msg.includes('elink') || msg.includes('key') || msg.includes('decrypt') || msg.includes('mac') || msg.includes(' padded') || msg.includes('padding')) {
    return 'This MEGA link is missing its decryption key (the part after #). Copy the full share link including the key.'
  }
  if (
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed') ||
    msg.includes('econn') ||
    msg.includes('eside') ||
    msg.includes('-4') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('bandwidth')
  ) {
    return 'Could not reach MEGA right now (network, rate limit or bandwidth quota). Please try again in a bit.'
  }
  if (msg.includes('no playable audio')) return raw
  return 'Could not load this MEGA link. Please check the link and try again.'
}

export async function resolveMegaAudio(
  url: string,
  onProgress?: (p: MegaProgress) => void,
  cancel?: CancelHandle
): Promise<{ objectUrl: string; fileName: string; size: number | null }> {
  const key = url.trim()

  const hit = cache.get(key)
  if (hit) {
    onProgress?.({ bytesLoaded: hit.size ?? 0, bytesTotal: hit.size, ratio: 1 })
    return hit
  }

  let mega: unknown
  try {
    // Dynamic import: the MEGA SDK (~500KB) loads on demand, only when a
    // MEGA link is actually played — never in the initial bundle.
    mega = await import('megajs')
  } catch {
    throw new Error('The MEGA streamer failed to load (network). Please check your connection and try again.')
  }
  const { File: MegaFile } = mega as unknown as { File: MegaFileConstructor }

  let file: MegaFileLike
  try {
    file = MegaFile.fromURL(key)
  } catch (e) {
    throw new Error(megaFriendlyError(e))
  }
  // Per megajs docs: browsers must null the user-agent (some browsers block
  // overriding the User-Agent header, which breaks requests otherwise).
  file.api.userAgent = null

  try {
    await file.loadAttributes()
  } catch (e) {
    throw new Error(megaFriendlyError(e))
  }
  if (cancel?.cancelled()) throw new MegaCancelledError()

  let target = file
  if (file.directory) {
    const picked = pickAudioFromFolder(file)
    if (!picked) {
      throw new Error('No playable audio file was found in this MEGA folder link. Link a file, or a folder containing audio (mp3, m4a, ogg, wav, flac…).')
    }
    target = picked
  }

  const total: number | null = typeof target.size === 'number' ? target.size : null
  const chunks: Uint8Array[] = []
  let loaded = 0
  const emit = (bytesTotal: number | null) => {
    onProgress?.({
      bytesLoaded: loaded,
      bytesTotal,
      ratio: bytesTotal && bytesTotal > 0 ? Math.min(1, loaded / bytesTotal) : null
    })
  }

  try {
    await new Promise<void>((resolve, reject) => {
      let stream: MegaStreamLike
      try {
        stream = target.download({ maxConnections: 4 })
      } catch (e) {
        reject(e)
        return
      }
      const watchdog = setInterval(() => {
        if (cancel?.cancelled()) {
          clearInterval(watchdog)
          try {
            stream.destroy?.()
          } catch {
            /* ignore */
          }
          reject(new MegaCancelledError())
        }
      }, 200)
      const done = (fn: () => void) => () => {
        clearInterval(watchdog)
        fn()
      }
      stream.on('progress', ((info: unknown) => {
        const p = info as { bytesLoaded?: number; bytesTotal?: number }
        if (typeof p.bytesLoaded === 'number') loaded = p.bytesLoaded
        emit(typeof p.bytesTotal === 'number' ? p.bytesTotal : total)
      }) as (...args: never[]) => void)
      stream.on('data', ((d: unknown) => {
        const u8 = d instanceof Uint8Array ? d : new Uint8Array(d as ArrayLike<number>)
        chunks.push(u8)
        loaded += u8.length
        if (loaded % 262144 < u8.length) emit(total)
      }) as (...args: never[]) => void)
      stream.on('end', done(() => resolve()) as (...args: never[]) => void)
      stream.on('error', ((e: unknown) => {
        clearInterval(watchdog)
        reject(e instanceof Error ? e : new Error(String(e)))
      }) as (...args: never[]) => void)
    })
  } catch (e) {
    if (e instanceof MegaCancelledError) throw e
    throw new Error(megaFriendlyError(e))
  }
  if (cancel?.cancelled()) throw new MegaCancelledError()

  const fileName = target.name ?? 'mega-audio'
  // Zero-copy: Blob accepts the raw chunks as parts.
  const blob = new Blob(chunks as BlobPart[], { type: mimeFor(fileName) })
  const objectUrl = URL.createObjectURL(blob)
  const entry = { objectUrl, fileName, size: total }
  cache.set(key, entry)
  while (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next()
    if (oldest.done) break
    const evicted = cache.get(oldest.value)
    cache.delete(oldest.value)
    if (evicted && evicted.objectUrl !== objectUrl) {
      try {
        URL.revokeObjectURL(evicted.objectUrl)
      } catch {
        /* ignore */
      }
    }
  }
  emit(total)
  return entry
}

/**
 * Resolve any song URL to something `<audio>` can play:
 * MEGA share links -> decrypted blob URL, everything else -> unchanged.
 */
export async function resolveAudioSource(
  url: string,
  onProgress?: (p: MegaProgress) => void,
  cancel?: CancelHandle
): Promise<string> {
  if (!isMegaUrl(url)) return url
  const resolved = await resolveMegaAudio(url, onProgress, cancel)
  return resolved.objectUrl
}
