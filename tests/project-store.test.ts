import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useProjectStore } from '../src/renderer/src/stores/project'
import { useHistoryStore } from '../src/renderer/src/stores/history'
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

  it('does not rewrite project metadata for repeated audio duration updates', () => {
    const store = useProjectStore()
    store.setAudio({ path: 'song.mp3', name: 'song.mp3', duration: null })
    store.setAudioDuration(12.5)
    expect(store.project.audio?.duration).toBe(12.5)

    store.project.updatedAt = 123
    store.setAudioDuration(12.5)
    expect(store.project.updatedAt).toBe(123)
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

  it('undoes and redoes an edit as one command', () => {
    const store = useProjectStore()
    const history = useHistoryStore()
    const untimedLines = structuredClone(lines)
    for (const line of untimedLines) {
      for (const token of line.tokens) {
        token.start = null
        token.end = null
      }
    }
    store.importLyrics(untimedLines, 'smart')
    history.clear()

    store.setTokenBoundary('start', 1.5)
    expect(store.activeToken?.start).toBe(1.5)
    expect(history.undoDepth).toBe(1)

    history.undo()
    expect(store.activeToken?.start).toBeNull()
    history.redo()
    expect(store.activeToken?.start).toBe(1.5)
  })

  it('copies a line timing pattern and pastes it at the playhead', () => {
    const store = useProjectStore()
    const repeatedLines = [structuredClone(lines[0]!), structuredClone(lines[0]!)]
    repeatedLines[0]!.tokens[0]!.start = 1
    repeatedLines[0]!.tokens[0]!.end = 1.5
    repeatedLines[0]!.tokens[1]!.start = 1.5
    repeatedLines[0]!.tokens[1]!.end = 2
    for (const token of repeatedLines[1]!.tokens) {
      token.start = null
      token.end = null
    }
    store.importLyrics(repeatedLines, 'smart')

    expect(store.copyActiveLineTiming()).toBe(true)
    store.selectToken(1, 0)
    expect(store.canPasteLineTiming).toBe(true)
    expect(store.pasteLineTimingAt(10)).toBe(true)
    expect(store.project.lines[1]?.tokens).toMatchObject([
      { start: 10, end: 10.5 },
      { start: 10.5, end: 11 }
    ])
  })

  it('only pastes timing onto a line with the same token structure', () => {
    const store = useProjectStore()
    const timedLines = structuredClone(lines)
    timedLines[0]!.tokens[0]!.start = 1
    timedLines[0]!.tokens[1]!.start = 2
    store.importLyrics(timedLines, 'smart')
    store.copyActiveLineTiming()
    store.selectToken(1, 0)

    expect(store.canPasteLineTiming).toBe(false)
    expect(store.pasteLineTimingAt(10)).toBe(false)
  })

  it('splits a token and distributes its complete timing interval', () => {
    const store = useProjectStore()
    store.importLyrics(structuredClone(lines), 'smart')
    store.selectToken(1, 0)
    store.setTokenBoundary('start', 4)
    store.setTokenBoundary('end', 6)

    expect(store.splitActiveToken(['he', 'llo'])).toBe(true)
    expect(store.project.lines[1]?.tokens).toMatchObject([
      { text: 'he', start: 4, end: 5 },
      { text: 'llo', start: 5, end: 6 }
    ])
  })

  it('merges adjacent tokens and keeps their outer timing bounds', () => {
    const store = useProjectStore()
    const timedLines = structuredClone(lines)
    timedLines[0]!.tokens[0]!.start = 1
    timedLines[0]!.tokens[0]!.end = 2
    timedLines[0]!.tokens[1]!.start = 2
    timedLines[0]!.tokens[1]!.end = 3
    store.importLyrics(timedLines, 'smart')

    expect(store.mergeActiveToken(1)).toBe(true)
    expect(store.project.lines[0]?.tokens).toMatchObject([
      { text: '你好', start: 1, end: 3 }
    ])
    expect(store.currentTokenIndex).toBe(0)
  })

  it('merges a contiguous token selection in lyric order', () => {
    const store = useProjectStore()
    const selectedLines = structuredClone(lines)
    selectedLines[0]!.tokens.push({ id: 'token-4', text: '呀', start: 3, end: 4 })
    selectedLines[0]!.tokens[0]!.start = 1
    selectedLines[0]!.tokens[0]!.end = 2
    selectedLines[0]!.tokens[1]!.start = 2
    selectedLines[0]!.tokens[1]!.end = 3
    store.importLyrics(selectedLines, 'smart')

    expect(store.mergeSelectedTokens(['token-4', 'token-1', 'token-2'])).toBe(true)
    expect(store.project.lines[0]?.tokens).toMatchObject([
      { id: 'token-1', text: '你好呀', start: 1, end: 4 }
    ])
    expect(store.activeToken?.id).toBe('token-1')
  })

  it('does not merge a selection across lyric lines', () => {
    const store = useProjectStore()
    store.importLyrics(structuredClone(lines), 'smart')

    expect(store.mergeSelectedTokens(['token-1', 'token-3'])).toBe(false)
    expect(store.project.lines[0]?.tokens).toHaveLength(2)
  })

  it('deletes selected tokens and selects the nearest remaining token', () => {
    const store = useProjectStore()
    store.importLyrics(structuredClone(lines), 'smart')

    expect(store.deleteTokens(['token-1', 'token-3'])).toBe(true)
    expect(store.project.lines).toHaveLength(1)
    expect(store.project.lines[0]?.tokens.map((token) => token.id)).toEqual(['token-2'])
    expect(store.activeToken?.id).toBe('token-2')
  })

  it('clears selection after deleting every token', () => {
    const store = useProjectStore()
    store.importLyrics(structuredClone(lines), 'smart')

    expect(store.deleteTokens(['token-1', 'token-2', 'token-3'])).toBe(true)
    expect(store.project.lines).toHaveLength(0)
    expect(store.activeToken).toBeNull()
  })

  it('inserts a token between adjacent timing intervals', () => {
    const store = useProjectStore()
    const timedLines = structuredClone(lines)
    timedLines[0]!.tokens[0]!.start = 1
    timedLines[0]!.tokens[0]!.end = 2
    timedLines[0]!.tokens[1]!.start = 3
    timedLines[0]!.tokens[1]!.end = 4
    store.importLyrics(timedLines, 'smart')

    expect(store.insertTokenAdjacent(1, '啊')).toBe(true)
    expect(store.project.lines[0]?.tokens).toMatchObject([
      { text: '你', start: 1, end: 2 },
      { text: '啊', start: 2, end: 3 },
      { text: '好', start: 3, end: 4 }
    ])
    expect(store.activeToken?.text).toBe('啊')
  })

  it('inserts beside a token by sharing its timing interval when there is no gap', () => {
    const store = useProjectStore()
    const timedLines = structuredClone(lines)
    timedLines[0]!.tokens[0]!.start = 1
    timedLines[0]!.tokens[0]!.end = 3
    store.importLyrics(timedLines, 'smart')

    expect(store.insertTokenAdjacent(-1, '新')).toBe(true)
    expect(store.project.lines[0]?.tokens.slice(0, 2)).toMatchObject([
      { text: '新', start: 1, end: 2 },
      { text: '你', start: 2, end: 3 }
    ])
  })
})
