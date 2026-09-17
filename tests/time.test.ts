import { describe, expect, it } from 'vitest'

import { formatTime } from '../src/renderer/src/utils/time'

describe('formatTime', () => {
  it.each([
    [0, '00:00.000'],
    [10.36, '00:10.360'],
    [65.009, '01:05.009'],
    [3599.999, '59:59.999']
  ])('formats %s seconds', (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('guards invalid value %s', (seconds) => {
    expect(formatTime(seconds)).toBe('00:00.000')
  })
})
