import { describe, expect, it } from 'vitest'

import {
  charTokenizer,
  createLyricLines,
  parseLyricSource,
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

  it('parses LRC timestamps without turning them into lyric tokens', () => {
    let id = 0
    const lines = createLyricLines(
      '[ar:测试歌手]\n[00:03.20]Hello world\n[01:02.345]再见',
      'smart',
      () => `id-${++id}`
    )

    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({
      text: 'Hello world',
      tokens: [
        { text: 'Hello', start: 3.2, end: null },
        { text: 'world', start: null, end: null }
      ]
    })
    expect(lines[1]).toMatchObject({
      text: '再见',
      tokens: [
        { text: '再', start: 62.345, end: null },
        { text: '见', start: null, end: null }
      ]
    })
  })

  it('expands multiple LRC timestamps and keeps untimed plain lyrics', () => {
    expect(parseLyricSource('[00:01.5][00:04.05]Chorus\nPlain line')).toEqual([
      { text: 'Chorus', start: 1.5 },
      { text: 'Chorus', start: 4.05 },
      { text: 'Plain line', start: null }
    ])
  })
})
