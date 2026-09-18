import { describe, expect, it } from 'vitest'
import { lyricTokenDisplayTexts } from '../src/renderer/src/utils/lyrics-preview'

describe('lyrics preview text reconstruction', () => {
  it('preserves spaces and punctuation omitted by word tokenization', () => {
    const line = {
      id: 'line',
      text: 'Hello,  beautiful world!',
      tokens: [
        { id: '1', text: 'Hello', start: 0, end: 1 },
        { id: '2', text: 'beautiful', start: 1, end: 2 },
        { id: '3', text: 'world', start: 2, end: 3 }
      ]
    }
    const pieces = lyricTokenDisplayTexts(line)
    expect(pieces.join('')).toBe(line.text)
    expect(pieces).toEqual(['Hello,  ', 'beautiful ', 'world!'])
  })

  it('preserves mixed-language spacing', () => {
    const line = {
      id: 'line',
      text: '你 好，Codex!',
      tokens: [
        { id: '1', text: '你', start: 0, end: 1 },
        { id: '2', text: '好', start: 1, end: 2 },
        { id: '3', text: 'Codex', start: 2, end: 3 }
      ]
    }
    expect(lyricTokenDisplayTexts(line).join('')).toBe(line.text)
  })
})
