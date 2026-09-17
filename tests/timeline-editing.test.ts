import { describe, expect, it } from 'vitest'

import {
  clampGroupDelta,
  clampTokenEnd,
  clampTokenMove,
  clampTokenStart,
  snapTime
} from '../src/renderer/src/timeline/editing'

describe('timeline editing math', () => {
  it('snaps to the closest boundary inside the threshold', () => {
    expect(snapTime(1.047, [1, 1.05, 2], 0.01)).toEqual({ time: 1.05, snappedTo: 1.05 })
    expect(snapTime(1.02, [1, 1.05], 0.01)).toEqual({ time: 1.02, snappedTo: null })
  })

  it('moves a token without crossing zero or the media duration', () => {
    expect(clampTokenMove(1, 2, -3, 10)).toEqual({ start: 0, end: 1 })
    expect(clampTokenMove(8, 9, 4, 10)).toEqual({ start: 9, end: 10 })
  })

  it('keeps resized tokens at least ten milliseconds long', () => {
    expect(clampTokenStart(2, 1.5)).toBeCloseTo(1.49)
    expect(clampTokenEnd(2, 1, 10)).toBeCloseTo(2.01)
  })

  it('clamps a line move using the earliest start and latest end', () => {
    const tokens = [
      { id: 'a', lineIndex: 0, tokenIndex: 0, start: 1, end: 2 },
      { id: 'b', lineIndex: 0, tokenIndex: 1, start: 2, end: 4 }
    ]
    expect(clampGroupDelta(tokens, -5, 8)).toBe(-1)
    expect(clampGroupDelta(tokens, 9, 8)).toBe(4)
  })
})
