import { describe, expect, it } from 'vitest'

import { markTokenAtTime, nextCursor, previousCursor } from '../src/renderer/src/services/timing'
import type { LyricLine } from '../src/shared/models/project'

function createLines(): LyricLine[] {
  return [
    {
      id: 'line-1',
      text: '你好',
      tokens: [
        { id: 'token-1', text: '你', start: null, end: null },
        { id: 'token-2', text: '好', start: null, end: null }
      ]
    },
    {
      id: 'line-2',
      text: 'world',
      tokens: [{ id: 'token-3', text: 'world', start: null, end: null }]
    }
  ]
}

describe('timing cursor navigation', () => {
  it('moves across lyric line boundaries', () => {
    const lines = createLines()
    expect(nextCursor(lines, { lineIndex: 0, tokenIndex: 1 })).toEqual({
      lineIndex: 1,
      tokenIndex: 0
    })
    expect(previousCursor(lines, { lineIndex: 1, tokenIndex: 0 })).toEqual({
      lineIndex: 0,
      tokenIndex: 1
    })
    expect(previousCursor(lines, { lineIndex: 0, tokenIndex: 0 })).toBeNull()
    expect(nextCursor(lines, { lineIndex: 1, tokenIndex: 0 })).toBeNull()
  })
})

describe('markTokenAtTime', () => {
  it('sets starts, closes the previous token and advances continuously', () => {
    const lines = createLines()

    expect(markTokenAtTime(lines, { lineIndex: 0, tokenIndex: 0 }, 1)).toEqual({
      cursor: { lineIndex: 0, tokenIndex: 1 },
      finished: false
    })
    expect(markTokenAtTime(lines, { lineIndex: 0, tokenIndex: 1 }, 1.5)).toEqual({
      cursor: { lineIndex: 1, tokenIndex: 0 },
      finished: false
    })
    expect(lines[0]?.tokens[0]).toMatchObject({ start: 1, end: 1.5 })

    markTokenAtTime(lines, { lineIndex: 1, tokenIndex: 0 }, 2)
    expect(lines[0]?.tokens[1]).toMatchObject({ start: 1.5, end: 2 })
    expect(lines[1]?.tokens[0]).toMatchObject({ start: 2, end: null })

    expect(markTokenAtTime(lines, { lineIndex: 1, tokenIndex: 0 }, 3)).toEqual({
      cursor: { lineIndex: 1, tokenIndex: 0 },
      finished: true
    })
    expect(lines[1]?.tokens[0]?.end).toBe(3)
  })

  it('clamps negative and backwards timing to a monotonic boundary', () => {
    const lines = createLines()
    markTokenAtTime(lines, { lineIndex: 0, tokenIndex: 0 }, -1)
    markTokenAtTime(lines, { lineIndex: 0, tokenIndex: 1 }, -2)

    expect(lines[0]?.tokens[0]).toMatchObject({ start: 0, end: 0 })
    expect(lines[0]?.tokens[1]?.start).toBe(0)
  })
})
