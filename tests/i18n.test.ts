import { afterEach, describe, expect, it } from 'vitest'

import { setLocale, translate } from '../src/renderer/src/i18n'

describe('interface localization', () => {
  afterEach(() => setLocale('zh-CN'))

  it('switches languages and interpolates values', () => {
    setLocale('en-US')
    expect(translate('设置')).toBe('Settings')
    expect(translate('{lines} 行 · {tokens} 个 Token', { lines: 2, tokens: 8 })).toBe(
      '2 lines · 8 tokens'
    )
  })

  it('falls back to the source string when a translation is unavailable', () => {
    setLocale('en-US')
    expect(translate('Untranslated product name')).toBe('Untranslated product name')
  })
})
