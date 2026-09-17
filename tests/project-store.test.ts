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
})
