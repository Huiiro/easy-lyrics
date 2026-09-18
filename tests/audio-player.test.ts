import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AudioPlayer } from '../src/renderer/src/services/audio-player'

class FakeAudio extends EventTarget {
  src = ''
  currentTime = 0
  duration = 120
  paused = true
  ended = false
  volume = 1
  playbackRate = 1
  readyState = 1
  error: MediaError | null = null
  preload = ''

  load = vi.fn()
  removeAttribute = vi.fn()

  async play(): Promise<void> {
    this.paused = false
    this.dispatchEvent(new Event('play'))
  }

  pause(): void {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }
}

describe('AudioPlayer', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1)
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => vi.unstubAllGlobals())

  it('loads a source and emits a ready snapshot', () => {
    const audio = new FakeAudio()
    const player = new AudioPlayer(audio as unknown as HTMLAudioElement)
    const listener = vi.fn()
    player.subscribe(listener)

    player.load('lyric-audio://media/example')

    expect(audio.src).toBe('lyric-audio://media/example')
    expect(audio.load).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ duration: 120, currentTime: 0, ready: true, error: null })
    )
  })

  it('clamps seek, volume and playback rate to safe ranges', () => {
    const audio = new FakeAudio()
    const player = new AudioPlayer(audio as unknown as HTMLAudioElement)

    player.seek(200)
    expect(audio.currentTime).toBe(120)
    player.seek(-10)
    expect(audio.currentTime).toBe(0)

    player.setVolume(2)
    expect(audio.volume).toBe(1)
    player.setVolume(-1)
    expect(audio.volume).toBe(0)

    player.setPlaybackRate(10)
    expect(audio.playbackRate).toBe(4)
    player.setPlaybackRate(0)
    expect(audio.playbackRate).toBe(0.25)
  })

  it('toggles playback based on the media element state', async () => {
    const audio = new FakeAudio()
    const player = new AudioPlayer(audio as unknown as HTMLAudioElement)

    await player.toggle()
    expect(audio.paused).toBe(false)
    await player.toggle()
    expect(audio.paused).toBe(true)
  })

  it('loops playback inside the configured token range', async () => {
    const audio = new FakeAudio()
    const player = new AudioPlayer(audio as unknown as HTMLAudioElement)
    player.setLoopRange(2, 3)
    await player.play()
    audio.currentTime = 3.01
    audio.dispatchEvent(new Event('seeked'))
    expect(audio.currentTime).toBe(2)

    player.setLoopRange(null, null)
    audio.currentTime = 4
    audio.dispatchEvent(new Event('seeked'))
    expect(audio.currentTime).toBe(4)
  })
})
