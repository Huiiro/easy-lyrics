export interface AudioPlayerSnapshot {
  currentTime: number
  duration: number
  playing: boolean
  volume: number
  playbackRate: number
  ready: boolean
  error: string | null
}

export type AudioPlayerListener = (snapshot: AudioPlayerSnapshot) => void

export class AudioPlayer {
  private readonly audio: HTMLAudioElement
  private readonly listeners = new Set<AudioPlayerListener>()
  private animationFrame: number | null = null
  private loopRange: { start: number; end: number } | null = null

  constructor(audio = new Audio()) {
    this.audio = audio
    this.audio.preload = 'metadata'
    this.bindEvents()
  }

  subscribe(listener: AudioPlayerListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  load(source: string): void {
    this.stopFrameLoop()
    this.audio.pause()
    this.audio.src = source
    this.audio.load()
    this.emit()
  }

  async play(): Promise<void> {
    await this.audio.play()
  }

  pause(): void {
    this.audio.pause()
  }

  async toggle(): Promise<void> {
    if (this.audio.paused) await this.play()
    else this.pause()
  }

  seek(time: number): void {
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0
    this.audio.currentTime = Math.min(Math.max(time, 0), duration)
    this.emit()
  }

  setVolume(volume: number): void {
    this.audio.volume = Math.min(Math.max(volume, 0), 1)
    this.emit()
  }

  setPlaybackRate(rate: number): void {
    this.audio.playbackRate = Math.min(Math.max(rate, 0.25), 4)
    this.emit()
  }

  setLoopRange(start: number | null, end: number | null): void {
    this.loopRange =
      start !== null && end !== null && Number.isFinite(start) && end > start
        ? { start, end }
        : null
  }

  destroy(): void {
    this.stopFrameLoop()
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.listeners.clear()
  }

  private bindEvents(): void {
    for (const event of ['loadedmetadata', 'durationchange', 'pause', 'ended', 'seeked']) {
      this.audio.addEventListener(event, () => this.emit())
    }

    this.audio.addEventListener('play', () => {
      this.startFrameLoop()
      this.emit()
    })
    this.audio.addEventListener('error', () => this.emit())
  }

  private snapshot(): AudioPlayerSnapshot {
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0
    return {
      currentTime: this.audio.currentTime,
      duration,
      playing: !this.audio.paused && !this.audio.ended,
      volume: this.audio.volume,
      playbackRate: this.audio.playbackRate,
      ready: this.audio.readyState >= 1,
      error: this.audio.error ? '音频无法解码或已损坏' : null
    }
  }

  private emit(): void {
    if (
      this.loopRange &&
      !this.audio.paused &&
      this.audio.currentTime >= this.loopRange.end
    ) {
      this.audio.currentTime = this.loopRange.start
    }
    const snapshot = this.snapshot()
    for (const listener of this.listeners) listener(snapshot)
    if (!snapshot.playing) this.stopFrameLoop()
  }

  private startFrameLoop(): void {
    if (this.animationFrame !== null) return
    const tick = (): void => {
      this.animationFrame = null
      this.emit()
      if (!this.audio.paused && !this.audio.ended) this.animationFrame = requestAnimationFrame(tick)
    }
    this.animationFrame = requestAnimationFrame(tick)
  }

  private stopFrameLoop(): void {
    if (this.animationFrame === null) return
    cancelAnimationFrame(this.animationFrame)
    this.animationFrame = null
  }
}

let sharedPlayer: AudioPlayer | null = null

export function getAudioPlayer(): AudioPlayer {
  sharedPlayer ??= new AudioPlayer()
  return sharedPlayer
}
