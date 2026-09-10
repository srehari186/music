/**
 * Audio service — thin, swappable wrapper around HTMLAudioElement.
 * Designed so another provider (e.g. HLS, Supabase Storage signed URLs)
 * can be added later behind the same interface.
 */
export interface AudioProvider {
  load(url: string): void
  play(): Promise<void>
  pause(): void
  seek(seconds: number): void
  setVolume(v: number): void
  setMuted(m: boolean): void
  getElement(): HTMLAudioElement
  dispose(): void
}

export class HtmlAudioProvider implements AudioProvider {
  private el: HTMLAudioElement

  constructor() {
    this.el = new Audio()
    this.el.preload = 'metadata'
    this.el.crossOrigin = 'anonymous'
  }

  load(url: string) {
    // Blob URLs (decrypted MEGA audio, MSE live streams) must buffer
    // aggressively — metadata-only preload can stall stream startup.
    try {
      this.el.preload = url.startsWith('blob:') ? 'auto' : 'metadata'
    } catch {
      /* ignore */
    }
    this.el.src = url
    this.el.load()
  }
  async play() {
    await this.el.play()
  }
  pause() {
    this.el.pause()
  }
  seek(seconds: number) {
    this.el.currentTime = seconds
  }
  setVolume(v: number) {
    this.el.volume = Math.min(1, Math.max(0, v))
  }
  setMuted(m: boolean) {
    this.el.muted = m
  }
  getElement() {
    return this.el
  }
  dispose() {
    this.el.pause()
    this.el.removeAttribute('src')
    this.el.load()
  }
}

export function createAudioProvider(): AudioProvider {
  return new HtmlAudioProvider()
}
