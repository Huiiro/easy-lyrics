import { describe, expect, it } from 'vitest'

import {
  formatRulerLabel,
  selectRulerInterval
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
