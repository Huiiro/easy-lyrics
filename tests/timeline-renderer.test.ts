import { describe, expect, it } from 'vitest'

import {
  formatRulerLabel,
  selectRulerInterval,
  TimelineRenderer
} from '../src/renderer/src/timeline/TimelineRenderer'

describe('timeline ruler', () => {
  it('selects readable intervals for different zoom levels', () => {
    expect(selectRulerInterval(20)).toBe(5)
    expect(selectRulerInterval(100)).toBe(1)
    expect(selectRulerInterval(1000)).toBe(0.1)
  })

  it('formats coarse and fine ruler labels', () => {
    expect(formatRulerLabel(65, 1)).toBe('01:05')
    expect(formatRulerLabel(10.36, 0.1)).toBe('00:10.36')
    expect(formatRulerLabel(1.005, 0.001)).toBe('00:01.005')
  })
})

describe('timeline playback rendering', () => {
  it('updates the playhead without redrawing the waveform layer', () => {
    let staticClears = 0
    let playheadClears = 0
    const context = (onClear: () => void): CanvasRenderingContext2D =>
      new Proxy({} as CanvasRenderingContext2D, {
        get: (_target, property) =>
          property === 'clearRect' ? onClear : () => undefined
      })
    const renderer = new TimelineRenderer(
      context(() => staticClears++),
      context(() => playheadClears++)
    )
    const viewport = { startTime: 0, pixelsPerSecond: 100, width: 300 }
    const height = 190
    renderer.drawStatic({
      viewport,
      height,
      duration: 10,
      waveform: null,
      lines: [],
      activeTokenId: null,
      selectedTokenIds: [],
      selectionRect: null,
      snapGuideTime: null,
      loopStart: null,
      loopEnd: null
    })
    renderer.drawPlayhead({ viewport, height, currentTime: 1 })
    renderer.drawPlayhead({ viewport, height, currentTime: 2 })

    expect(staticClears).toBe(1)
    expect(playheadClears).toBe(2)
    expect(renderer.hitTest(200, 50)?.type).toBe('playhead')
    expect(renderer.hitTest(100, 50)).toBeNull()
  })
})
