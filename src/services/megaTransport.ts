/**
 * YouTube-style MEGA transport: metadata via megajs, media bytes via direct
 * HTTPS range requests + native WebCrypto decryption (construction verified
 * byte-for-byte against megajs's own codec), appended progressively to a
 * Media Source Extensions buffer.
 *
 * This gives: playback that starts after the first chunks, true length
 * sniffed from headers up front, and seeking (exact for MP3 via an
 * incremental frame index, estimated otherwise).
 *
 * Anything that fails before playback starts falls back to the legacy
 * full-download path in megaService — never a dead player.
 */

export interface TransportCancel {
  cancelled: () => boolean
}

export interface TransportProgress {
  bytesLoaded: number
  bytesTotal: number | null
  ratio: number | null
}

function u32be(b: Uint8Array, o: number): number {
  return (((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0)
}

/**
 * Key derivation for 256-bit MEGA file keys — VERIFIED against megajs's
 * codec (mergeKeyMac/getCipher/CTR in its shipped bundle):
 * AES key = XOR of the two 16-byte halves, IV = bytes 16-24 + zeros,
 * counter = byteOffset/16 in the low 64 bits.
 */
export function deriveMegaAesIv(fullKey: Uint8Array): { aesKey: Uint8Array; iv: Uint8Array } {
  if (fullKey.length < 32) throw new Error('bad key length')
  const k: number[] = []
  for (let i = 0; i < 8; i++) k.push(u32be(fullKey, i * 4))
  const aesKey = new Uint8Array(16)
  const folded = [k[0] ^ k[4], k[1] ^ k[5], k[2] ^ k[6], k[3] ^ k[7]]
  folded.forEach((w, i) => {
    aesKey[i * 4] = (w >>> 24) & 0xff
    aesKey[i * 4 + 1] = (w >>> 16) & 0xff
    aesKey[i * 4 + 2] = (w >>> 8) & 0xff
    aesKey[i * 4 + 3] = w & 0xff
  })
  const iv = new Uint8Array(16)
  iv.set(fullKey.subarray(16, 24), 0)
  return { aesKey, iv }
}

function counterBlock(iv: Uint8Array, blockIndex: number): ArrayBuffer {
  const c = new Uint8Array(16)
  c.set(iv.subarray(0, 16))
  const dv = new DataView(c.buffer)
  dv.setUint32(8, Math.floor(blockIndex / 4294967296))
  dv.setUint32(12, blockIndex >>> 0)
  return c.buffer
}

export async function importMegaAesKey(raw: Uint8Array): Promise<CryptoKey> {
  const view = new Uint8Array(raw.byteLength)
  view.set(raw)
  return crypto.subtle.importKey('raw', view.buffer as ArrayBuffer, { name: 'AES-CTR' }, false, ['decrypt'])
}

/** Decrypt ciphertext starting at a 16-aligned file offset. */
export async function megaDecryptRange(
  cryptoKey: CryptoKey,
  iv: Uint8Array,
  byteOffset: number,
  cipher: Uint8Array
): Promise<Uint8Array> {
  if (byteOffset % 16 !== 0) throw new Error('offset must be 16-aligned')
  const out = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: counterBlock(iv, byteOffset / 16), length: 64 },
    cryptoKey,
    cipher as BufferSource
  )
  return new Uint8Array(out)
}

/**
 * Single byte-range fetch. MEGA serves ranges via a `/start-end` URL suffix
 * on a plain GET — deliberately NOT the `Range` header, which would trigger
 * a CORS preflight that content servers may reject.
 * Returns null on any failure (caller falls back).
 */
export async function fetchBytes(
  url: string,
  start: number,
  end: number,
  signal?: AbortSignal
): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${url}/${start}-${end}`, { signal })
    if (res.status === 509) return null // bandwidth quota — handled as rate limit upstream
    if (res.status !== 200 && res.status !== 206) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.length === 0) return null
    const want = end - start + 1
    if (buf.length > want) {
      // Server ignored the suffix and sent the whole file: only usable for offset 0.
      if (start !== 0) return null
      return buf.slice(0, want)
    }
    return buf
  } catch {
    return null
  }
}

/** Fetch + decrypt one 16-aligned range. Null on any failure. */
export async function fetchDecryptRange(
  url: string,
  cryptoKey: CryptoKey,
  iv: Uint8Array,
  start: number,
  length: number,
  totalBytes: number | null,
  signal?: AbortSignal
): Promise<{ bytes: Uint8Array; offset: number } | null> {
  try {
    const aligned = start - (start % 16)
    const end = totalBytes != null ? Math.min(totalBytes - 1, start + length - 1) : start + length - 1
    if (end < start) return { bytes: new Uint8Array(0), offset: start }
    const cipher = await fetchBytes(url, aligned, end, signal)
    if (!cipher) return null
    const plain = await megaDecryptRange(cryptoKey, iv, aligned, cipher)
    const skip = start - aligned
    return { bytes: skip > 0 ? plain.slice(skip) : plain, offset: start }
  } catch {
    return null
  }
}

// ---- Incremental MP3 frame index (exact seeks) -------------------------------

const MP3_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000]
}

const MP3_BR: Record<string, number[]> = {
  '1-1': [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  '1-2': [32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  '1-3': [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  '2-1': [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  '2-2': [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  '2-3': [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
}

function mp3BitrateKbps(ver: number, layerField: number, idx: number): number | null {
  const group = ver === 3 ? '1' : '2'
  const layerName = layerField === 3 ? '1' : layerField === 2 ? '2' : '3'
  const table = MP3_BR[`${group}-${layerName}`]
  return table?.[idx - 1] ?? null
}

export interface Mp3Mark {
  time: number
  offset: number
}

/**
 * Scans MP3 frames as bytes stream in and records time->offset marks.
 * Feeds should be sequential from a known offset; a restart feed simply
 * continues the timeline from its own offset.
 */
export class Mp3SeekIndex {
  private marks: Mp3Mark[] = [{ time: 0, offset: 0 }]
  private carry = new Uint8Array(0)
  private time = 0
  private nextOffset: number | null = null

  /** Feed decrypted bytes starting at absolute file offset. */
  feed(chunk: Uint8Array, fileOffset: number): void {
    // A non-contiguous feed (after a seek restart) invalidates the carry.
    if (this.nextOffset !== null && fileOffset !== this.nextOffset) this.carry = new Uint8Array(0)
    const buf = new Uint8Array(this.carry.length + chunk.length)
    buf.set(this.carry, 0)
    buf.set(chunk, this.carry.length)
    let pos = 0
    let guard = 0
    let consumed = 0
    while (pos + 4 <= buf.length && guard++ < 8192) {
      if (buf[pos] !== 0xff || (buf[pos + 1] & 0xe0) !== 0xe0) {
        pos++
        continue
      }
      const ver = (buf[pos + 1] >> 3) & 3
      const layer = (buf[pos + 1] >> 1) & 3
      const brIdx = (buf[pos + 2] >> 4) & 15
      const srIdx = (buf[pos + 2] >> 2) & 3
      const pad = (buf[pos + 2] >> 1) & 1
      if (ver === 1 || layer === 0 || brIdx === 0 || brIdx === 15 || srIdx === 3) {
        pos++
        continue
      }
      const rate = MP3_RATES[ver]?.[srIdx]
      const br = mp3BitrateKbps(ver, layer, brIdx)
      if (!rate || !br) {
        pos++
        continue
      }
      const samples = layer === 3 ? 384 : layer === 2 ? 1152 : ver === 3 ? 1152 : 576
      const frameLen = layer === 3
        ? Math.floor((12 * br * 1000) / rate + pad) * 4
        : Math.floor(((ver === 3 ? 144 : 72) * br * 1000) / rate + pad)
      if (frameLen < 21 || pos + frameLen > buf.length) break // need more data
      const absOff = fileOffset - this.carry.length + pos
      const last = this.marks[this.marks.length - 1]
      if (this.time - last.time >= 0.2 || absOff - last.offset >= 65536) {
        this.marks.push({ time: this.time, offset: absOff })
        if (this.marks.length > 20000) this.marks.splice(0, this.marks.length - 20000)
      }
      this.time += samples / rate
      pos += frameLen
      consumed = pos
    }
    this.carry = buf.slice(consumed)
    // Safety cap: never retain more than 256KB of unscanned bytes.
    if (this.carry.length > 262144) this.carry = this.carry.slice(-65536)
    this.nextOffset = fileOffset + chunk.length
  }

  /** Greatest mark with time <= t (frame-aligned offset, exact). */
  offsetForTime(t: number): Mp3Mark {
    let lo = this.marks[0]
    for (const m of this.marks) {
      if (m.time > t) break
      lo = m
    }
    return lo
  }

  get count(): number {
    return this.marks.length
  }
}

// ---- Custom streaming session ------------------------------------------------

export interface CustomStreamHooks {
  onProgress: (p: TransportProgress) => void
  cancel: TransportCancel
}

export interface CustomStreamSession {
  url: string
  done: Promise<void>
  seekAhead: (time: number, bufferedEnd: number, duration: number | null) => Promise<boolean>
  destroy: () => void
  held: () => Uint8Array[]
}

export interface CustomStreamInput {
  downloadUrl: string
  cryptoKey: CryptoKey
  iv: Uint8Array
  totalBytes: number | null
  fileName: string
  mseType: string
  /** Head bytes already fetched (offset 0) — reused, never re-downloaded. */
  head: { bytes: Uint8Array; offset: number }
  hooks: CustomStreamHooks
}

const SEGMENT = 2097152 // 2MB 16-aligned fetch segments
const WORKERS = 4 // parallel connections: MEGA throttles per connection

export function startCustomStream(input: CustomStreamInput): CustomStreamSession {
  const { downloadUrl, cryptoKey, iv, totalBytes, fileName, mseType, head, hooks } = input
  const ext = (fileName.split('.').pop() ?? '').toLowerCase()
  const ms = new MediaSource()
  const url = URL.createObjectURL(ms)

  let settled = false
  let resolveDone!: () => void
  let rejectDone!: (e: unknown) => void
  const done = new Promise<void>((res, rej) => {
    resolveDone = res
    rejectDone = rej
  })
  const finishOk = () => {
    if (settled) return
    settled = true
    clearTimeout(openTimer)
    clearInterval(stallTimer)
    try {
      if (ms.readyState === 'open') ms.endOfStream()
    } catch {
      /* ignore */
    }
    resolveDone()
  }
  const fail = (e: unknown) => {
    if (settled) return
    settled = true
    clearTimeout(openTimer)
    clearInterval(stallTimer)
    try {
      if (ms.readyState === 'open') ms.endOfStream('network')
    } catch {
      /* ignore */
    }
    rejectDone(e)
  }

  const index = ext === 'mp3' ? new Mp3SeekIndex() : null
  const queue: Uint8Array[] = []
  const held: Uint8Array[] = []
  // Blob cache stays valid only while bytes arrive in file order end-to-end.
  // Any seek-ahead restarts mid-file, so caching is disabled from then on.
  let cacheable = true
  let sb: SourceBuffer | null = null
  let downloadEnded = false
  // fetchCursor: next range workers claim. appendOffset: next offset MSE needs.
  // pending: completed out-of-order segments waiting for their turn.
  let fetchCursor = head.offset + head.bytes.length
  let appendOffset = fetchCursor
  let receivedBytes = head.bytes.length
  const pending = new Map<number, Uint8Array>()
  let controller = new AbortController()
  let runToken = 0
  let lastBytesAt = Date.now()
  const touch = () => {
    lastBytesAt = Date.now()
  }

  // Watchdogs: never hang silently. No SourceBuffer within 12s (attach
  // problem) or no bytes for 45s mid-stream (stalled/rate-limited) surfaces
  // a real error instead of an endless spinner.
  const openTimer = setTimeout(() => {
    if (!sb && !settled) fail(new Error('source-timeout'))
  }, 12000)
  const stallTimer = setInterval(() => {
    if (!settled && !downloadEnded && Date.now() - lastBytesAt > 45000) {
      fail(new Error('stalled'))
    }
  }, 10000)

  const reportProgress = () => {
    hooks.onProgress({
      bytesLoaded: receivedBytes,
      bytesTotal: totalBytes,
      ratio: totalBytes && totalBytes > 0 ? Math.min(1, receivedBytes / totalBytes) : null
    })
  }

  const pump = () => {
    if (!sb || sb.updating) return
    // Move in-order completed segments into the append queue.
    while (pending.has(appendOffset)) {
      const chunk = pending.get(appendOffset) as Uint8Array
      pending.delete(appendOffset)
      if (index) index.feed(chunk, appendOffset)
      appendOffset += chunk.length
      held.push(chunk)
      queue.push(chunk)
    }
    const chunk = queue.shift()
    if (!chunk) {
      if (downloadEnded && pending.size === 0) finishOk()
      return
    }
    try {
      sb.appendBuffer(chunk as unknown as ArrayBufferView<ArrayBuffer>)
    } catch {
      fail(new Error('append'))
    }
  }

  const fetchRange = async (
    offset: number,
    length: number,
    signal: AbortSignal,
    token: number
  ): Promise<Uint8Array | null> => {
    const end = totalBytes != null ? Math.min(totalBytes - 1, offset + length - 1) : offset + length - 1
    if (totalBytes != null && offset >= totalBytes) return new Uint8Array(0)
    const cipher = await fetchBytes(downloadUrl, offset, end, signal)
    if (!cipher || token !== runToken || hooks.cancel.cancelled()) return null
    try {
      return await megaDecryptRange(cryptoKey, iv, offset, cipher)
    } catch {
      return null
    }
  }

  /** Fetch loop for one worker: claims 2MB ranges until EOF or supersede. */
  const worker = async (token: number): Promise<void> => {
    for (;;) {
      if (token !== runToken || hooks.cancel.cancelled()) return // superseded: silent
      const off = fetchCursor
      if (totalBytes != null && off >= totalBytes) return
      fetchCursor = off + SEGMENT
      const plain = await fetchRange(off, SEGMENT, controller.signal, token)
      // Re-check after the await: a seek may have superseded this worker
      // while it was in flight — never store stale segments.
      if (token !== runToken || hooks.cancel.cancelled()) return
      if (plain === null) {
        throw new Error('fetch failed')
      }
      if (plain.length === 0) {
        if (totalBytes == null) return // unknown size: nothing more to claim
        throw new Error('short read')
      }
      pending.set(off, plain)
      receivedBytes += plain.length
      touch()
      reportProgress()
      pump()
    }
  };

  /** (Re)starts the parallel fetch from an offset. */
  const startWorkers = (fromOffset: number, token: number) => {
    fetchCursor = fromOffset
    let finished = 0
    const onWorkerDone = () => {
      finished++
      if (finished === WORKERS && token === runToken && !hooks.cancel.cancelled()) {
        downloadEnded = true
        pump()
      }
    }
    const onWorkerError = (e: unknown) => {
      if (token !== runToken) return
      runToken++
      fail(e)
    }
    for (let i = 0; i < WORKERS; i++) {
      void worker(token).then(onWorkerDone, onWorkerError)
    }
  }

  ms.addEventListener(
    'sourceopen',
    () => {
      if (settled || hooks.cancel.cancelled()) {
        fail(new Error('__cancelled__'))
        return
      }
      try {
        sb = ms.addSourceBuffer(mseType)
        clearTimeout(openTimer)
      } catch {
        fail(new Error('sourcebuffer'))
        return
      }
      sb.addEventListener('updateend', pump)
      sb.addEventListener('error', () => fail(new Error('sb-error')))
      // Seed with the preloaded head, then stream the rest on 4 workers.
      if (index) index.feed(head.bytes, head.offset)
      held.push(head.bytes)
      queue.push(head.bytes)
      touch()
      reportProgress()
      pump()
      startWorkers(fetchCursor, runToken)
    },
    { once: true }
  )

  const removeRange = (start: number, end: number): Promise<void> =>
    new Promise((resolve) => {
      if (!sb) return resolve()
      try {
        const to = setTimeout(resolve, 1500)
        sb.addEventListener('updateend', () => {
          clearTimeout(to)
          resolve()
        }, { once: true })
        sb.remove(start, end)
      } catch {
        resolve()
      }
    })

  const seekAhead = async (time: number, bufferedEnd: number, totalDuration: number | null): Promise<boolean> => {
    try {
      if (!sb || settled || hooks.cancel.cancelled()) return false
      if (time <= bufferedEnd - 0.5) return true // native path handles it
      let offset: number
      let anchorTime: number
      if (index && index.count > 1) {
        const mark = index.offsetForTime(Math.max(0, time - 0.3))
        offset = mark.offset - (mark.offset % 16)
        anchorTime = mark.time
      } else if (totalDuration && totalDuration > 0 && totalBytes) {
        offset = Math.floor((time / totalDuration) * totalBytes)
        offset -= offset % 16
        anchorTime = time
      } else {
        return false
      }
      if (offset < 0) offset = 0
      // Abort in-flight fetch and invalidate its loop first.
      runToken++
      const token = runToken
      controller.abort()
      controller = new AbortController()
      await removeRange(0, 1000000)
      if (settled || hooks.cancel.cancelled() || token !== runToken) return false
      try {
        sb.timestampOffset = Math.max(0, anchorTime)
      } catch {
        return false
      }
      queue.length = 0
      pending.clear()
      downloadEnded = false
      cacheable = false // mid-file restart: bytes are no longer end-to-end
      appendOffset = offset
      startWorkers(offset, token)
      return true
    } catch {
      return false
    }
  }

  const destroy = () => {
    runToken++
    try {
      controller.abort()
    } catch {
      /* ignore */
    }
    if (!settled) fail(new Error('__cancelled__'))
  }

  return { url, done, seekAhead, destroy, held: () => (cacheable ? held : []) }
}
