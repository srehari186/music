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
    target
  }
}

/** Download + decrypt all chunks, emitting progress. Rejects with raw errors. */
async function downloadChunks(
  target: MegaFileLike,
  total: number | null,
  onProgress?: (p: MegaProgress) => void,
  cancel?: CancelHandle,
  onData?: (chunk: Uint8Array) => void
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

function storeBlobCache(
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

// ---- Progressive streaming (play while fetching) ----------------------------

/** MSE-compatible stream type per extension, or null (full-download fallback). */
function mseTypeFor(fileName: string): string | null {
  const ext = extOf(fileName)
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'm4a' || ext === 'aac') return 'audio/mp4'
  return null
}

function mseSupported(type: string): boolean {
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
  /** Resolves when the fetch completes (MSE: endOfStream called). */
  done: Promise<void>
}

/**
 * Open a MEGA song for progressive playback: decrypted chunks stream into
 * the audio element via Media Source Extensions while the download
 * continues, so playback starts after the first chunks instead of the
 * whole file. Formats/browsers without MSE support fall back to
 * download-then-play automatically.
 */
export async function openMegaStream(
  url: string,
  onProgress?: (p: MegaProgress) => void,
  cancel?: CancelHandle
): Promise<MegaStreamSession> {
  const key = normalizeMegaUrl(url.trim())

  const hit = cache.get(key)
  if (hit) {
    onProgress?.({ bytesLoaded: hit.size ?? 0, bytesTotal: hit.size, ratio: 1 })
    return { url: hit.objectUrl, streaming: false, done: Promise.resolve() }
  }

  const { fileName, total, target } = await loadMegaTarget(key, cancel)
  if (cancel?.cancelled()) throw new MegaCancelledError()

  const mseType = mseTypeFor(fileName)
  if (!mseType || !mseSupported(mseType)) {
    let chunks: Uint8Array[]
    try {
      ;({ chunks } = await downloadChunks(target, total, onProgress, cancel))
    } catch (e) {
      if (e instanceof MegaCancelledError) throw e
      throw new Error(megaFriendlyError(e))
    }
    if (cancel?.cancelled()) throw new MegaCancelledError()
    const entry = storeBlobCache(key, fileName, total, chunks)
    onProgress?.({ bytesLoaded: total ?? 0, bytesTotal: total, ratio: 1 })
    return { url: entry.objectUrl, streaming: false, done: Promise.resolve() }
  }

  // --- MSE path: hand the element a live stream URL right away ---
  const ms = new MediaSource()
  const streamUrl = URL.createObjectURL(ms)
  let resolveDone!: () => void
  let rejectDone!: (e: unknown) => void
  const done = new Promise<void>((res, rej) => {
    resolveDone = res
    rejectDone = rej
  })
  let settled = false
  const finishOk = (held: Uint8Array[]) => {
    if (settled) return
    settled = true
    try {
      if (ms.readyState === 'open') ms.endOfStream()
    } catch {
      /* ignore */
    }
    try {
      // Completed streams become replay-instant blob cache entries.
      storeBlobCache(key, fileName, total, held)
    } catch {
      /* ignore */
    }
    onProgress?.({ bytesLoaded: total ?? 0, bytesTotal: total, ratio: 1 })
    resolveDone()
  }
  const fail = (e: unknown, reason: 'network' | 'decode' = 'network') => {
    if (settled) return
    settled = true
    try {
      if (ms.readyState === 'open') ms.endOfStream(reason)
    } catch {
      /* ignore */
    }
    rejectDone(e instanceof MegaCancelledError ? e : new Error(megaFriendlyError(e)))
  }

  const queue: Uint8Array[] = []
  const held: Uint8Array[] = []
  let sb: SourceBuffer | null = null
  let downloadEnded = false
  const pump = () => {
    if (!sb || sb.updating) return
    const chunk = queue.shift()
    if (!chunk) {
      if (downloadEnded) finishOk(held)
      return
    }
    try {
      sb.appendBuffer(chunk as unknown as ArrayBufferView<ArrayBuffer>)
    } catch (e) {
      fail(e, 'decode')
    }
  }

  ms.addEventListener(
    'sourceopen',
    () => {
      if (settled || cancel?.cancelled()) {
        fail(new MegaCancelledError())
        return
      }
      try {
        sb = ms.addSourceBuffer(mseType)
      } catch (e) {
        fail(e, 'decode')
        return
      }
      sb.addEventListener('updateend', pump)
      sb.addEventListener('error', () => fail(new Error('decode'), 'decode'))
      pump()
    },
    { once: true }
  )

  void downloadChunks(
    target,
    total,
    (p) => onProgress?.(p),
    cancel,
    (chunk) => {
      held.push(chunk)
      queue.push(chunk)
      pump()
    }
  ).then(
    () => {
      downloadEnded = true
      pump()
    },
    (e) => fail(e)
  )

  return { url: streamUrl, streaming: true, done }
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
