import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useProjectStore } from '../src/renderer/src/stores/project'
import type { LyricLine } from '../src/shared/models/project'

const lines: LyricLine[] = [
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
    text: 'hello',
    tokens: [{ id: 'token-3', text: 'hello', start: null, end: null }]
  }
]

describe('project store lyric selection', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('imports lyrics and activates the first token', () => {
    const store = useProjectStore()

    store.importLyrics(lines, 'smart')

    expect(store.project.lines).toEqual(lines)
    expect(store.project.settings.tokenizer).toBe('smart')
    expect(store.activeLine?.id).toBe('line-1')
    expect(store.activeToken?.id).toBe('token-1')
    expect(store.dirty).toBe(true)
  })

  it('selects only an existing token', () => {
    const store = useProjectStore()
    store.importLyrics(lines, 'smart')

    store.selectToken(1, 0)
    expect(store.activeToken?.id).toBe('token-3')

    store.selectToken(9, 9)
    expect(store.activeToken?.id).toBe('token-3')
  })

  it('clears the token selection without losing the current lyric line', () => {
    const store = useProjectStore()
    store.importLyrics(lines, 'smart')

    store.clearTokenSelection()

    expect(store.activeToken).toBeNull()
    expect(store.activeLine?.id).toBe('line-1')
    store.nudgeActiveToken(0.1)
    expect(store.project.lines[0]?.tokens[0]?.start).toBeNull()

    store.selectToken(0, 1)
    expect(store.activeToken?.id).toBe('token-2')
  })

  it('navigates tokens and lines without leaving valid bounds', () => {
    const store = useProjectStore()
    store.importLyrics(lines, 'smart')

    store.navigateToken(1)
    expect(store.activeToken?.id).toBe('token-2')
    store.navigateToken(1)
    expect(store.activeToken?.id).toBe('token-3')
    store.navigateToken(1)
    expect(store.activeToken?.id).toBe('token-3')

    store.navigateLine(-1)
    expect(store.activeToken?.id).toBe('token-1')
  })

  it('marks the current token and applies bounded project settings', () => {
    const store = useProjectStore()
    store.importLyrics(lines, 'smart')

    store.markCurrentToken(1.25)
    expect(store.project.lines[0]?.tokens[0]?.start).toBe(1.25)
    expect(store.activeToken?.id).toBe('token-2')

    store.setTimingOffset(9999)
    expect(store.project.settings.timingOffsetMs).toBe(5000)
    store.setTokenBoundary('start', 2)
    store.setTokenBoundary('end', 1)
    expect(store.activeToken).toMatchObject({ start: 2, end: 2 })
  })

  it('applies batch timing edits and nudges the active token', () => {
    const store = useProjectStore()
    store.importLyrics(structuredClone(lines), 'smart')
    store.applyTokenTimingUpdates([
      { lineIndex: 0, tokenIndex: 0, start: 0.5, end: 1 },
      { lineIndex: 0, tokenIndex: 1, start: 1, end: 1.5 }
    ])

    expect(store.project.lines[0]?.tokens).toMatchObject([
      { start: 0.5, end: 1 },
      { start: 1, end: 1.5 }
    ])

    store.nudgeActiveToken(-0.6)
    expect(store.activeToken).toMatchObject({ start: 0, end: 0.5 })
  })

  it('nudges according to token lock and line edit modes', () => {
    const store = useProjectStore()
    store.importLyrics(structuredClone(lines), 'smart')
    store.applyTokenTimingUpdates([
      { lineIndex: 0, tokenIndex: 0, start: 1, end: 2 },
      { lineIndex: 0, tokenIndex: 1, start: 2, end: 3 }
    ])

    store.selectToken(0, 1)
    store.nudgeSelection(0.1, 'token', false)
    expect(store.project.lines[0]?.tokens).toMatchObject([
      { start: 1, end: 2 },
      { start: 2.1, end: 3.1 }
    ])

    store.nudgeSelection(0.1, 'token', true)
    expect(store.project.lines[0]?.tokens).toMatchObject([
      { start: 1, end: 2.2 },
      { start: 2.2, end: 3.2 }
    ])

    store.nudgeSelection(0.2, 'line', true)
    expect(store.project.lines[0]?.tokens[0]?.start).toBeCloseTo(1.2)
    expect(store.project.lines[0]?.tokens[0]?.end).toBeCloseTo(2.4)
    expect(store.project.lines[0]?.tokens[1]?.start).toBeCloseTo(2.4)
    expect(store.project.lines[0]?.tokens[1]?.end).toBeCloseTo(3.4)
  })
})
