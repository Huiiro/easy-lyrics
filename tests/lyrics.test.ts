import { describe, expect, it } from 'vitest'

import { getLineTimingStatus } from '../src/renderer/src/utils/lyrics'
import type { LyricLine } from '../src/shared/models/project'

function lineWithStarts(starts: Array<number | null>): LyricLine {
  return {
    id: 'line',
    text: 'test',
    tokens: starts.map((start, index) => ({ id: String(index), text: 'x', start, end: null }))
  }
}

describe('getLineTimingStatus', () => {
  it('reports pending, partial and complete lines', () => {
    expect(getLineTimingStatus(lineWithStarts([null, null]))).toBe('pending')
    expect(getLineTimingStatus(lineWithStarts([1, null]))).toBe('partial')
    expect(getLineTimingStatus(lineWithStarts([1, 2]))).toBe('complete')
  })
})
