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

export interface MegaFileLike {
  name?: string
  size?: number
  directory?: boolean
  children?: MegaFileLike[]
  nodeId?: string
  /** For files inside a shared folder this is [folderId, fileHandle]. */
  downloadId?: string | string[]
  loadedFile?: string
  api: { userAgent: string | null }
  loadAttributes(): Promise<unknown>
  download(options?: Record<string, unknown>): MegaStreamLike
}

/**
 * The node handle of a file. Children of a shared folder carry
 * `downloadId = [folderId, fileHandle]` (no `nodeId`), so the handle is
 * the LAST element — never the raw array.
 */
function extractNodeId(f: MegaFileLike): string | null {
  if (typeof f.nodeId === 'string' && f.nodeId) return f.nodeId
  if (Array.isArray(f.downloadId)) {
    const last = f.downloadId[f.downloadId.length - 1]
    return typeof last === 'string' && last ? last : null
  }
  if (typeof f.downloadId === 'string' && f.downloadId) return f.downloadId
  return null
}

/**
 * Heal per-file links stored before the node-id fix: the id segment looked
 * like `FOLDERID,NODEHANDLE` (a stringified array). Node handles are
 * base64url (never contain commas), so the real id is the last segment.
 */
export function normalizeMegaUrl(url: string): string {
  const t = url.trim()
  // New format: …/folder/FID#FKEY/file/<id> — <id> must be a bare handle.
  const fileIdx = t.indexOf('/file/')
  if (fileIdx !== -1) {
    const head = t.slice(0, fileIdx + 6)
    const after = t.slice(fileIdx + 6)
    const seg = after.split('/')[0]
    if (seg.includes(',')) {
      const fixed = seg.split(',').pop() ?? ''
      if (fixed) return head + fixed + after.slice(seg.length)
    }
    return t
  }
  // Legacy format: #F!FID!FKEY!FILEID — same comma problem, same fix.
  const m = t.match(/^(https:\/\/mega\.(?:nz|co\.nz)\/#F![^!]+![^!]+![^!,/]+),([^!/,]+)(.*)$/)
  if (m) return `${m[1].slice(0, m[1].lastIndexOf('!') + 1)}${m[2]}${m[3]}`
  return t
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
    const match = findRecursive(kids, (f) => extractNodeId(f) === wanted)
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

async function loadMegaLibrary(): Promise<{ File: MegaFileConstructor }> {
  let mega: unknown
  try {
    // Dynamic import: the MEGA SDK (~500KB) loads on demand, only when a
    // MEGA link is actually played — never in the initial bundle.
    mega = await import('megajs')
  } catch {
    throw new Error('The MEGA streamer failed to load (network). Please check your connection and try again.')
  }
  return mega as unknown as { File: MegaFileConstructor }
}

interface MegaTarget {
  fileName: string
  total: number | null
  target: MegaFileLike
  file: MegaFileLike
}

async function loadMegaTarget(key: string, cancel?: CancelHandle): Promise<MegaTarget> {
  const { File: MegaFile } = await loadMegaLibrary()

  let file: MegaFileLike
  try {
    file = MegaFile.fromURL(key)
  } catch (e) {
    throw new Error(megaFriendlyError(e))
  }
  // Per megajs docs: browsers must null the user-agent (some browsers block
  // overriding the User-Agent header, which breaks requests otherwise).
  file.api.userAgent = null

  let loadedNode: MegaFileLike | undefined
  try {
    // When the link embeds a file inside a shared folder
    // (…/folder/ID#KEY/file/FILEID), this resolves to that child node.
    loadedNode = (await file.loadAttributes()) as MegaFileLike | undefined
  } catch (e) {
    throw new Error(megaFriendlyError(e))
  }
  if (cancel?.cancelled()) throw new MegaCancelledError()

  // Per-file links inside a shared folder resolve loadAttributes() directly
  // to that child node. A bare folder link falls back to the
  // embedded/first audio file found inside.
  let target = file
  if (file.directory) {
    if (loadedNode && loadedNode !== file && !loadedNode.directory && loadedNode.name) {
      target = loadedNode
    } else {
      const picked = pickAudioFromFolder(file)
      if (!picked) {
        throw new Error('No playable audio file was found in this MEGA folder link. Link a file, or a folder containing audio (mp3, m4a, ogg, wav, flac…).')
      }
      target = picked
    }
  }

  return {
    fileName: target.name ?? 'mega-audio',
    total: typeof target.size === 'number' ? target.size : null,
    target,
    file
  }
}

/** Download + decrypt chunks (whole file or a byte range), emitting progress. Rejects with raw errors. */
async function downloadChunks(
  target: MegaFileLike,
  total: number | null,
  onProgress?: (p: MegaProgress) => void,
  cancel?: CancelHandle,
  onData?: (chunk: Uint8Array) => void,
  range?: { start: number; end: number }
): Promise<{ chunks: Uint8Array[]; loaded: number }> {
  const chunks: Uint8Array[] = []
  let loaded = 0
  const emit = (bytesTotal: number | null) => {
    onProgress?.({
      bytesLoaded: loaded,
      bytesTotal,
      ratio: bytesTotal && bytesTotal > 0 ? Math.min(1, loaded / bytesTotal) : null
    })
  }

  await new Promise<void>((resolve, reject) => {
    let stream: MegaStreamLike
    try {
      // Single-connection range fetch for header sniffing; chunked parallel
      // download for full files.
      stream = range
        ? target.download({ maxConnections: 1, start: range.start, end: range.end })
        : target.download({ maxConnections: 4 })
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
      onData?.(u8)
      if (loaded % 262144 < u8.length) emit(total)
    }) as (...args: never[]) => void)
    stream.on('end', done(() => resolve()) as (...args: never[]) => void)
    stream.on('error', ((e: unknown) => {
      clearInterval(watchdog)
      reject(e instanceof Error ? e : new Error(String(e)))
    }) as (...args: never[]) => void)
  })
  return { chunks, loaded }
}

export function storeBlobCache(
  key: string,
  fileName: string,
  total: number | null,
  chunks: Uint8Array[]
): { objectUrl: string; fileName: string; size: number | null } {
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
  return entry
}

export async function resolveMegaAudio(
  url: string,
  onProgress?: (p: MegaProgress) => void,
  cancel?: CancelHandle
): Promise<{ objectUrl: string; fileName: string; size: number | null }> {
  const key = normalizeMegaUrl(url.trim())

  const hit = cache.get(key)
  if (hit) {
    onProgress?.({ bytesLoaded: hit.size ?? 0, bytesTotal: hit.size, ratio: 1 })
    return hit
  }

  const { fileName, total, target } = await loadMegaTarget(key, cancel)
  if (cancel?.cancelled()) throw new MegaCancelledError()

  let chunks: Uint8Array[]
  try {
    ;({ chunks } = await downloadChunks(target, total, onProgress, cancel))
  } catch (e) {
    if (e instanceof MegaCancelledError) throw e
    throw new Error(megaFriendlyError(e))
  }
  if (cancel?.cancelled()) throw new MegaCancelledError()

  const emit = () => onProgress?.({ bytesLoaded: total ?? 0, bytesTotal: total, ratio: 1 })
  const entry = storeBlobCache(key, fileName, total, chunks)
  emit()
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

// ---- Duration from partial data (shows length while streaming) -------------

function u32be(b: Uint8Array, o: number): number {
  return (((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0)
}

function u32le(b: Uint8Array, o: number): number {
  return (((b[o + 3] << 24) | (b[o + 2] << 16) | (b[o + 1] << 8) | b[o]) >>> 0)
}

function u64le(b: Uint8Array, o: number): number {
  const lo = u32le(b, o)
  const hi = u32le(b, o + 4)
  return hi * 4294967296 + lo
}

function saneDuration(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 6 * 3600) return null
  return Math.round(seconds)
}

const MP3_BITRATES: Record<string, number[]> = {
  '1-3': [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG1 Layer III
  '1-2': [32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], // MPEG1 Layer II
  '1-1': [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448], // MPEG1 Layer I
  '2-3': [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG2/2.5 Layer III
  '2-2': [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG2/2.5 Layer II
  '2-1': [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256] // MPEG2/2.5 Layer I
}
const MP3_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000]
}

/** MP3 length from ID3 TLEN, Xing/Info header, or CBR bitrate estimate. */
export function parseMp3Duration(head: Uint8Array, totalBytes: number | null): number | null {
  try {
    let audioStart = 0
    // ID3v2 tag with optional TLEN (milliseconds) frame.
    if (head.length > 10 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
      const tagSize = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f)
      const major = head[3]
      audioStart = 10 + tagSize
      let pos = 10
      let guard = 0
      while (pos + 10 <= Math.min(head.length, 10 + tagSize) && guard++ < 64) {
        const id = String.fromCharCode(head[pos], head[pos + 1], head[pos + 2], head[pos + 3])
        if (id.charCodeAt(0) === 0) break
        const size = major >= 4
          ? ((head[pos + 4] & 0x7f) << 21) | ((head[pos + 5] & 0x7f) << 14) | ((head[pos + 6] & 0x7f) << 7) | (head[pos + 7] & 0x7f)
          : u32be(head, pos + 4)
        if (id === 'TLEN' && size > 0 && size < 16 && pos + 10 + size <= head.length) {
          const text = String.fromCharCode(...head.slice(pos + 11, pos + 10 + size)).replace(/\D/g, '')
          const ms = parseInt(text, 10)
          if (ms > 0) return saneDuration(ms / 1000)
        }
        if (size <= 0 || size > 1 << 20) break
        pos += 10 + size
      }
    }
    // First MPEG frame header.
    for (let i = audioStart; i + 4 < Math.min(head.length, audioStart + 8192); i++) {
      if (head[i] !== 0xff || (head[i + 1] & 0xe0) !== 0xe0) continue
      const ver = (head[i + 1] >> 3) & 3
      const layer = (head[i + 1] >> 1) & 3
      const brIdx = (head[i + 2] >> 4) & 15
      const srIdx = (head[i + 2] >> 2) & 3
      if (ver === 1 || layer === 0 || brIdx === 0 || brIdx === 15 || srIdx === 3) continue
      // layer field: 3 = Layer I, 2 = Layer II, 1 = Layer III
      const mpegGroup = ver === 3 ? '1' : '2'
      const layerName = layer === 3 ? '1' : layer === 2 ? '2' : '3'
      const table = MP3_BITRATES[`${mpegGroup}-${layerName}`]
      const rates = MP3_RATES[ver]
      if (!table || !rates) continue
      const bitrate = table[brIdx - 1] // kbps
      const rate = rates[srIdx]
      // Layer I: 384 samples, Layer II: 1152, Layer III: 1152 (MPEG1) / 576.
      const samples = layer === 3 ? 384 : layer === 2 ? 1152 : ver === 3 ? 1152 : 576
      const mono = ((head[i + 3] >> 6) & 3) === 3
      const sideLen = ver === 3 ? (mono ? 17 : 32) : mono ? 9 : 17
      const xp = i + 4 + sideLen
      if (xp + 12 <= head.length) {
        const tag = String.fromCharCode(head[xp], head[xp + 1], head[xp + 2], head[xp + 3])
        if ((tag === 'Xing' || tag === 'Info') && (head[xp + 7] & 1) === 1) {
          const frames = u32be(head, xp + 8)
          if (frames > 0) return saneDuration((frames * samples) / rate)
        }
      }
      // CBR fallback from total file size.
      if (totalBytes && totalBytes > i) {
        return saneDuration(((totalBytes - i) * 8) / (bitrate * 1000))
      }
      return null
    }
  } catch {
    /* fall through */
  }
  return null
}

/** WAV length from the fmt/data chunks (exact). */
export function parseWavDuration(head: Uint8Array): number | null {
  try {
    if (head.length < 16 || u32be(head, 0) !== 0x52494646 || u32be(head, 8) !== 0x57415645) return null // RIFF....WAVE
    let pos = 12
    let byteRate: number | null = null
    while (pos + 8 <= head.length) {
      const id = u32be(head, pos)
      const size = u32le(head, pos + 4)
      if (id === 0x666d7420 && size >= 16 && pos + 8 + 16 <= head.length) {
        byteRate = u32le(head, pos + 8 + 8)
      }
      if (id === 0x64617461) {
        if (byteRate && byteRate > 0) return saneDuration(size / byteRate)
        return null
      }
      if (size > 1 << 26) break
      pos += 8 + size + (size % 2)
    }
  } catch {
    /* fall through */
  }
  return null
}

/** FLAC length from STREAMINFO (exact). */
export function parseFlacDuration(head: Uint8Array): number | null {
  try {
    if (head.length < 42 || u32be(head, 0) !== 0x664c6143) return null // fLaC
    let pos = 4
    let guard = 0
    while (pos + 4 <= head.length && guard++ < 16) {
      const type = head[pos] & 0x7f
      const last = (head[pos] & 0x80) !== 0
      const len = (head[pos + 1] << 16) | (head[pos + 2] << 8) | head[pos + 3]
      if (type === 0 && len >= 34 && pos + 4 + 34 <= head.length) {
        const d = head.slice(pos + 4, pos + 4 + 34)
        const rate = (d[10] << 12) | (d[11] << 4) | (d[12] >> 4)
        const total = (d[12] & 0x0f) * 4294967296 + d[13] * 16777216 + d[14] * 65536 + d[15] * 256 + d[16]
        if (rate > 0 && total > 0) return saneDuration(total / rate)
        return null
      }
      pos += 4 + len
      if (last) break
    }
  } catch {
    /* fall through */
  }
  return null
}

/** MP4/M4A length from the mvhd box (head for faststart, tail otherwise). */
export function parseMp4Duration(buf: Uint8Array): number | null {
  try {
    for (let i = 0; i + 24 <= buf.length; i++) {
      if (buf[i] === 0x6d && buf[i + 1] === 0x76 && buf[i + 2] === 0x68 && buf[i + 3] === 0x64) {
        const ver = buf[i + 4]
        if (ver === 1 && i + 32 <= buf.length) {
          const ts = u32be(buf, i + 24)
          const hi = u32be(buf, i + 28)
          const lo = u32be(buf, i + 32)
          if (ts > 0) return saneDuration((hi * 4294967296 + lo) / ts)
        } else if (ver === 0 && i + 24 <= buf.length) {
          const ts = u32be(buf, i + 16)
          const dur = u32be(buf, i + 20)
          if (ts > 0 && dur > 0) return saneDuration(dur / ts)
        }
        return null
      }
    }
  } catch {
    /* fall through */
  }
  return null
}

/** OGG Vorbis/Opus length: sample rate from head + granule of last page in tail. */
export function parseOggDuration(head: Uint8Array, tail: Uint8Array | null): number | null {
  try {
    const findPage = (b: Uint8Array, from: number): number => {
      for (let i = from; i + 27 <= b.length; i++) {
        if (b[i] === 0x4f && b[i + 1] === 0x67 && b[i + 2] === 0x67 && b[i + 3] === 0x53) return i
      }
      return -1
    }
    const hp = findPage(head, 0)
    if (hp < 0) return null
    const segs = head[hp + 26]
    const pkt = hp + 27 + segs
    let rate = 0
    let opusPreSkip = 0
    let isOpus = false
    if (pkt + 30 <= head.length && head[pkt] === 1 && head[pkt + 1] === 0x76) {
      // Vorbis identification header
      rate = u32le(head, pkt + 12)
    } else if (pkt + 19 <= head.length && String.fromCharCode(...head.slice(pkt, pkt + 8)) === 'OpusHead') {
      isOpus = true
      opusPreSkip = head[pkt + 10] | (head[pkt + 11] << 8)
      rate = u32le(head, pkt + 12) || 48000
    } else {
      return null
    }
    if (!tail || rate <= 0) return null
    let last = -1
    let from = 0
    for (;;) {
      const p = findPage(tail, from)
      if (p < 0) break
      last = p
      from = p + 1
    }
    if (last < 0 || last + 14 > tail.length) return null
    const granule = u64le(tail, last + 6)
    if (granule <= 0 || granule === 0xfffffffffffff) return null
    void isOpus
    return saneDuration((granule - opusPreSkip) / rate)
  } catch {
    return null
  }
}

/**
 * Best-effort true length from raw file bytes (head, optional tail).
 * Pure function — fully unit-testable without network.
 */
export function parseAudioDuration(
  head: Uint8Array,
  tail: Uint8Array | null,
  fileName: string,
  totalBytes: number | null
): number | null {
  const ext = extOf(fileName)
  if (ext === 'mp3') return parseMp3Duration(head, totalBytes)
  if (ext === 'wav') return parseWavDuration(head)
  if (ext === 'flac') return parseFlacDuration(head)
  if (ext === 'm4a' || ext === 'aac' || ext === 'mp4') {
    return parseMp4Duration(head) ?? (tail ? parseMp4Duration(tail) : null)
  }
  if (ext === 'ogg' || ext === 'oga' || ext === 'opus' || ext === 'weba' || ext === 'webm') {
    return parseOggDuration(head, tail)
  }
  return null
}

// ---- Progressive streaming (play while fetching) ----------------------------

/** MSE-compatible stream type per extension, or null (full-download fallback). */
export function mseTypeFor(fileName: string): string | null {
  const ext = extOf(fileName)
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'm4a' || ext === 'aac') return 'audio/mp4'
  return null
}

export function mseSupported(type: string): boolean {
  try {
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(type)
  } catch {
    return false
  }
}

export interface MegaStreamSession {
  /**
   * Playable immediately. MSE sessions keep fetching in the background;
   * blob sessions are already complete.
   */
  url: string
  streaming: boolean
  /** True length in seconds when sniffed from headers, else null. */
  duration: number | null
  /** Resolves when the fetch completes (MSE: endOfStream called). */
  done: Promise<void>
  /** Jump to a time beyond the buffered data (YouTube-style). Absent when unsupported. */
  seekAhead?: (time: number, bufferedEnd: number) => Promise<boolean>
  destroy?: () => void
}

/**
 * Open a MEGA song for progressive playback: the true length is sniffed
 * from headers first (shown immediately), then decrypted chunks stream
 * into the audio element via Media Source Extensions while the download
 * continues. Formats/browsers without MSE support fall back to
 * download-then-play automatically.
 */
export async function openMegaStream(
  url: string,
  onProgress?: (p: MegaProgress) => void,
  cancel?: CancelHandle,
  durationHint?: number | null
): Promise<MegaStreamSession> {
  const key = normalizeMegaUrl(url.trim())

  const hit = cache.get(key)
  if (hit) {
    onProgress?.({ bytesLoaded: hit.size ?? 0, bytesTotal: hit.size, ratio: 1 })
    return { url: hit.objectUrl, streaming: false, duration: null, done: Promise.resolve() }
  }

  const { fileName, total, target, file } = await loadMegaTarget(key, cancel)
  if (cancel?.cancelled()) throw new MegaCancelledError()

  // YouTube-style custom pipeline first; legacy full download on any failure.
  try {
    const custom = await openCustomSession(key, fileName, total, target, file, cancel, onProgress, durationHint ?? null)
    if (custom) return custom
  } catch (e) {
    if (e instanceof MegaCancelledError || cancel?.cancelled()) throw e
    console.warn('[Waveora:MEGA] custom pipeline unavailable, using legacy fetch')
  }

  // Legacy: full download, then play (duration sniffed from the bytes).
  let chunks: Uint8Array[]
  try {
    ;({ chunks } = await downloadChunks(target, total, onProgress, cancel))
  } catch (e) {
    if (e instanceof MegaCancelledError) throw e
    throw new Error(megaFriendlyError(e))
  }
  if (cancel?.cancelled()) throw new MegaCancelledError()
  const entry = storeBlobCache(key, fileName, total, chunks)
  let legacyDuration: number | null = durationHint ?? null
  try {
    let headLen = 0
    const parts: Uint8Array[] = []
    for (const c of chunks) {
      parts.push(c)
      headLen += c.length
      if (headLen >= 262144) break
    }
    const head = new Uint8Array(headLen)
    let off = 0
    for (const c of parts) {
      head.set(c, off)
      off += c.length
    }
    legacyDuration = parseAudioDuration(head, null, fileName, total) ?? durationHint ?? null
  } catch {
    /* keep hint */
  }
  onProgress?.({ bytesLoaded: total ?? 0, bytesTotal: total, ratio: 1 })
  return { url: entry.objectUrl, streaming: false, duration: legacyDuration, done: Promise.resolve() }
}

function needsTail(ext: string): boolean {
  return (
    ext === 'm4a' || ext === 'aac' || ext === 'mp4' ||
    ext === 'ogg' || ext === 'oga' || ext === 'opus' ||
    ext === 'weba' || ext === 'webm'
  )
}

/**
 * YouTube-style path: download URL via the file's own API, true length
 * sniffed from head/tail ranges, then progressive MSE streaming with
 * seeking. Throws when unavailable (caller falls back to legacy).
 */
async function openCustomSession(
  key: string,
  fileName: string,
  total: number | null,
  target: MegaFileLike,
  file: MegaFileLike,
  cancel: CancelHandle | undefined,
  onProgress: ((p: MegaProgress) => void) | undefined,
  durationHint: number | null
): Promise<MegaStreamSession> {
  const t = await import('./megaTransport')
  const rawKey = (target as unknown as { key?: unknown }).key as Uint8Array | undefined
  if (!rawKey || (rawKey as Uint8Array).length < 32) throw new Error('no key')
  const mseType = mseTypeFor(fileName)
  if (!mseType || !mseSupported(mseType)) throw new Error('no-mse')

  const api = (file as unknown as { api?: { request?: (req: unknown, cb: (e: unknown, r: unknown) => void) => void } }).api
  const apiRequest = api?.request
  if (typeof apiRequest !== 'function') throw new Error('no api')
  const fDlId = (file as unknown as { downloadId?: unknown }).downloadId
  const tDlId = (target as unknown as { downloadId?: unknown }).downloadId
  // Same request shape the SDK downloader uses (folder context included).
  const req: Record<string, unknown> = { a: 'g', g: 1, ssl: 2 }
  if (typeof fDlId === 'string' && target !== file) {
    const handle = Array.isArray(tDlId) ? tDlId[1] : tDlId
    if (typeof handle !== 'string' || !handle) throw new Error('no handle')
    req._querystring = { n: fDlId }
    req.n = handle
  } else if (Array.isArray(tDlId)) {
    req._querystring = { n: tDlId[0] }
    req.n = tDlId[1]
  } else if (typeof tDlId === 'string') {
    req.p = tDlId
  } else if (typeof fDlId === 'string') {
    req.p = fDlId
  } else {
    throw new Error('no dl id')
  }
  const res = await new Promise<unknown>((resolve, reject) => {
    try {
      apiRequest(req, (e, r) => (e ? reject(e) : resolve(r)))
    } catch (e) {
      reject(e)
    }
  })
  const dlUrl = (res as { g?: unknown }).g
  if (typeof dlUrl !== 'string' || !dlUrl.startsWith('http')) throw new Error('bad dl url')
  if (cancel?.cancelled()) throw new MegaCancelledError()

  const { aesKey, iv } = t.deriveMegaAesIv(rawKey)
  const cryptoKey = await t.importMegaAesKey(aesKey)

  // Head sniff for instant true duration.
  const HEAD = 262144
  const headCipher = await t.fetchBytes(dlUrl, 0, HEAD - 1)
  if (!headCipher || headCipher.length === 0) throw new Error('head failed')
  const head = await t.megaDecryptRange(cryptoKey, iv, 0, headCipher)
  let duration = parseAudioDuration(head, null, fileName, total)
  if (!duration && total && total > HEAD + 1024 && needsTail(extOf(fileName))) {
    const tailLen = Math.min(total, 1048576)
    const ts = total - tailLen
    const aligned = ts - (ts % 16)
    const tailCipher = await t.fetchBytes(dlUrl, aligned, total - 1)
    if (tailCipher && tailCipher.length > 0) {
      try {
        const tailPlain = await t.megaDecryptRange(cryptoKey, iv, aligned, tailCipher)
        duration = parseAudioDuration(head, tailPlain.slice(ts - aligned), fileName, total)
      } catch {
        /* keep null */
      }
    }
  }
  if (cancel?.cancelled()) throw new MegaCancelledError()
  const effDuration = duration ?? durationHint ?? null

  const session = t.startCustomStream({
    downloadUrl: dlUrl,
    cryptoKey,
    iv,
    totalBytes: total,
    fileName,
    mseType,
    head: { bytes: head, offset: 0 },
    hooks: {
      onProgress: (p) => onProgress?.({ bytesLoaded: p.bytesLoaded, bytesTotal: p.bytesTotal, ratio: p.ratio }),
      cancel: { cancelled: () => cancel?.cancelled() ?? false }
    }
  })
  void session.done.then(
    () => {
      try {
        const held = session.held()
        if (held.length > 0) storeBlobCache(key, fileName, total, held)
      } catch {
        /* ignore */
      }
      onProgress?.({ bytesLoaded: total ?? 0, bytesTotal: total, ratio: 1 })
    },
    () => {}
  )
  return {
    url: session.url,
    streaming: true,
    duration: effDuration,
    done: session.done,
    seekAhead: (time, bufferedEnd) => session.seekAhead(time, bufferedEnd, effDuration),
    destroy: () => session.destroy()
  }
}

// ---- MEGA folder -> album import --------------------------------------------

export interface MegaFolderTrack {
  /** MEGA node id — embedded into the per-song link as …/file/<id> */
  id: string
  name: string
  size: number | null
}

function isFolderLink(url: string): boolean {
  const t = url.trim()
  try {
    const u = new URL(t)
    if (u.pathname.includes('/folder/')) return true
    // Legacy format: https://mega.nz/#F!FOLDER_ID!KEY[!FILE_ID]
    if (u.hash.startsWith('#F')) return true
  } catch {
    /* fall through */
  }
  return false
}

/** Strip an embedded …/file/<id> (or legacy !<id>) so we list the whole folder. */
function stripEmbeddedFile(url: string): string {
  const t = url.trim()
  const cut = t.indexOf('/file/')
  if (cut !== -1) return t.slice(0, cut)
  const m = t.match(/^(https:\/\/mega\.(nz|co\.nz)\/#F![^!]+![^!]+)!.+$/)
  if (m) return m[1]
  return t
}

/**
 * Build the per-song link for one file inside a shared folder:
 * new format appends `/file/<nodeId>` to the folder link's hash,
 * legacy `#F!FID!FKEY` links append `!<nodeId>`.
 */
export function buildMegaFileUrl(folderUrl: string, nodeId: string): string {
  const base = stripEmbeddedFile(folderUrl)
  if (base.includes('/file/')) return base // unreachable, but stay safe
  if (/#F![^!]+![^!]+$/.test(base)) return `${base}!${nodeId}`
  const hashIdx = base.indexOf('#')
  if (hashIdx === -1) return base
  return `${base}/file/${nodeId}`
}

/** "01 - Midnight Run_.mp3" -> "01 - Midnight Run" */
export function suggestTrackTitle(fileName: string): string {
  const withoutExt = fileName.replace(/\.[a-z0-9]{2,5}$/i, '')
  return withoutExt.replace(/[_]+/g, ' ').replace(/\s{2,}/g, ' ').trim() || fileName
}

function collectAudioTracks(files: MegaFileLike[], out: MegaFolderTrack[]): void {
  const sorted = [...files].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  for (const f of sorted) {
    if (f.directory) {
      if (f.children) collectAudioTracks(f.children, out)
    } else if (f.name && isAudioName(f.name)) {
      const id = extractNodeId(f)
      if (id) out.push({ id, name: f.name, size: typeof f.size === 'number' ? f.size : null })
    }
  }
}

/**
 * List the playable audio files inside a MEGA folder link (recursive).
 * Used by the admin "import folder as album" flow.
 */
export async function listMegaFolderTracks(folderUrl: string): Promise<MegaFolderTrack[]> {
  const key = stripEmbeddedFile(folderUrl)
  if (!isMegaUrl(key)) throw new Error('That does not look like a MEGA link.')
  if (!isFolderLink(key)) {
    throw new Error('That is a single-file link, not a folder. Use “Add song” for single files, or paste a mega.nz/folder/… link here.')
  }
  let mega: unknown
  try {
    mega = await import('megajs')
  } catch {
    throw new Error('The MEGA streamer failed to load (network). Please check your connection and try again.')
  }
  const { File: MegaFile } = mega as unknown as { File: MegaFileConstructor }
  let folder: MegaFileLike
  try {
    folder = MegaFile.fromURL(key)
  } catch (e) {
    throw new Error(megaFriendlyError(e))
  }
  folder.api.userAgent = null
  try {
    await folder.loadAttributes()
  } catch (e) {
    throw new Error(megaFriendlyError(e))
  }
  if (!folder.directory || !folder.children) {
    throw new Error('Could not read this folder. The link may be wrong or missing its key.')
  }
  const tracks: MegaFolderTrack[] = []
  collectAudioTracks(folder.children, tracks)
  return tracks
}
