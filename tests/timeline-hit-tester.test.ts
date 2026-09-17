import { describe, expect, it } from 'vitest'

import { TimelineHitTester } from '../src/renderer/src/timeline/TimelineHitTester'

describe('timeline hit tester', () => {
  it('returns the topmost matching region', () => {
    const tester = new TimelineHitTester()
    tester.setRegions([
      { type: 'token-body', id: 'token', x: 10, y: 10, width: 100, height: 20 },
      { type: 'token-left', id: 'token', x: 8, y: 10, width: 16, height: 20 }
    ])

    expect(tester.hitTest(15, 15)?.type).toBe('token-left')
    expect(tester.hitTest(50, 15)?.type).toBe('token-body')
    expect(tester.hitTest(200, 15)).toBeNull()
  })
})
