import { describe, expect, it } from 'vitest'

import {
  charTokenizer,
  createLyricLines,
  smartTokenizer,
  wordTokenizer
} from '../src/renderer/src/services/tokenizer'

describe('lyric tokenizers', () => {
  it('splits letters and CJK characters individually in char mode', () => {
    expect(charTokenizer.tokenize('徘徊 A-1！')).toEqual(['徘', '徊', 'A', '1'])
  })

  it('splits whitespace-delimited words and trims boundary punctuation', () => {
    expect(wordTokenizer.tokenize('  Take me home, via-via!  ')).toEqual([
      'Take',
      'me',
      'home',
      'via-via'
    ])
  })

  it('splits Chinese by character and English by word in smart mode', () => {
    expect(smartTokenizer.tokenize("你要走吗 via via, don't go 2026")).toEqual([
      '你',
      '要',
      '走',
      '吗',
      'via',
      'via',
      "don't",
      'go',
      '2026'
    ])
  })
})

describe('createLyricLines', () => {
  it('normalizes newlines, ignores empty and punctuation-only lines, and creates untimed tokens', () => {
    let id = 0
    const lines = createLyricLines(
      '第一行\r\n\r\n！！！\r\ntake me home',
      'smart',
      () => `id-${++id}`
    )

    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({
      text: '第一行',
      tokens: [
        { text: '第', start: null, end: null },
        { text: '一', start: null, end: null },
        { text: '行', start: null, end: null }
      ]
    })
    expect(lines[1]?.tokens.map((token) => token.text)).toEqual(['take', 'me', 'home'])
    expect(
      new Set(lines.flatMap((line) => [line.id, ...line.tokens.map((token) => token.id)]))
    ).toHaveProperty('size', 8)
  })
})
