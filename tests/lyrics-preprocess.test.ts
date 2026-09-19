import { describe, expect, it } from 'vitest'

import { preprocessLyrics } from '../src/renderer/src/services/lyrics-preprocess'

const defaults = {
  removeMetadata: true,
  removeParentheses: true,
  removeBraces: true,
  customPattern: '',
  customFlags: 'giu'
}

describe('lyrics preprocessing', () => {
  it('removes LRC metadata and bracketed annotations while preserving timestamps', () => {
    const result = preprocessLyrics(
      '[ti:Song]\n[ar:Singer]\n[00:01.20]Hello (backing vocal)\n下一句｛合唱｝',
      defaults
    )

    expect(result.error).toBeNull()
    expect(result.replacements).toBe(4)
    expect(result.text).toBe('[00:01.20]Hello\n下一句')
  })

  it('applies a custom global regular expression', () => {
    const result = preprocessLyrics('[Verse 1]\nHello\n[Chorus]\nWorld', {
      ...defaults,
      customPattern: '^\\[(?:Verse|Chorus).*?\\]$',
      customFlags: 'imu'
    })
    expect(result.error).toBeNull()
    expect(result.text).toBe('Hello\nWorld')
  })

  it('removes deeply nested full-width and half-width annotations', () => {
    const result = preprocessLyrics(
      '歌词 {外层 {内层｛更深｝} 尾部} 保留\n次行（和声 (低声部（叠加）)）结束',
      defaults
    )
    expect(result.error).toBeNull()
    expect(result.replacements).toBe(2)
    expect(result.text).toBe('歌词 保留\n次行结束')
  })

  it('preserves an unclosed annotation instead of deleting the rest of the line', () => {
    const result = preprocessLyrics('歌词 {未闭合内容', defaults)
    expect(result.text).toBe('歌词 {未闭合内容')
  })

  it('returns a readable error for invalid custom patterns', () => {
    const result = preprocessLyrics('lyrics', {
      ...defaults,
      customPattern: '[',
      customFlags: 'u'
    })
    expect(result.error).toBeTruthy()
    expect(result.text).toBe('lyrics')
  })
})
