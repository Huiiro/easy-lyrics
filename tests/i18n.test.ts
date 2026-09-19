import { afterEach, describe, expect, it } from 'vitest'

import { setLocale, translate } from '../src/renderer/src/i18n'
import enUS from '../src/shared/i18n/locales/en-US'
import zhCN from '../src/shared/i18n/locales/zh-CN'

describe('interface localization', () => {
  afterEach(() => setLocale('zh-CN'))

  it('switches languages and interpolates values', () => {
    setLocale('en-US')
    expect(translate('settings')).toBe('Settings')
    expect(translate('lines_lines_tokens_tokens', { lines: 2, tokens: 8 })).toBe(
      '2 lines · 8 tokens'
    )
  })

  it('falls back to the source string when a translation is unavailable', () => {
    setLocale('en-US')
    expect(translate('untranslated_product_name')).toBe('untranslated_product_name')
  })

  it('keeps locale files aligned and uses English-only keys', () => {
    expect(Object.keys(zhCN).sort()).toEqual(Object.keys(enUS).sort())
    expect(Object.keys(enUS).every((key) => /^[a-z0-9_]+$/.test(key))).toBe(true)
  })
})
