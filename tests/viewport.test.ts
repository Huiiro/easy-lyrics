import { describe, expect, it } from 'vitest'

import {
  centerViewportOnTime,
  followViewportToTime,
  panViewportByPixels,
  timeToX,
  xToTime,
  zoomViewportAt,
  type TimelineViewport
} from '../src/renderer/src/timeline/viewport'

const viewport: TimelineViewport = { startTime: 10, pixelsPerSecond: 100, width: 800 }

describe('timeline viewport transforms', () => {
  it('converts between time and pixels', () => {
    expect(timeToX(12.5, viewport)).toBe(250)
    expect(xToTime(250, viewport)).toBe(12.5)
  })

  it('keeps the anchor time fixed while zooming', () => {
    const anchorX = 320
    const anchorTime = xToTime(anchorX, viewport)
    const zoomed = zoomViewportAt(viewport, anchorX, 2, 120)

    expect(zoomed.pixelsPerSecond).toBe(200)
    expect(xToTime(anchorX, zoomed)).toBeCloseTo(anchorTime)
  })

  it('pans and clamps to the audio range', () => {
    expect(panViewportByPixels(viewport, -200, 120).startTime).toBe(12)
    expect(panViewportByPixels(viewport, 5000, 120).startTime).toBe(0)
    expect(panViewportByPixels(viewport, -50_000, 20).startTime).toBe(12)
  })

  it('pages forward when playback crosses the visible edge', () => {
    expect(followViewportToTime(viewport, 17.99, 120).startTime).toBe(10)
    expect(followViewportToTime(viewport, 18, 120).startTime).toBe(18)
    expect(followViewportToTime(viewport, 35, 120).startTime).toBe(34)
  })

  it('pages backward and clamps the last playback page', () => {
    expect(followViewportToTime(viewport, 2, 120).startTime).toBe(0)
    expect(followViewportToTime(viewport, 119, 120).startTime).toBe(112)
  })

  it('centers a selected time and clamps at the audio edges', () => {
    expect(centerViewportOnTime(viewport, 30, 120).startTime).toBe(26)
    expect(centerViewportOnTime(viewport, 2, 120).startTime).toBe(0)
    expect(centerViewportOnTime(viewport, 119, 120).startTime).toBe(112)
  })
})
