import { readonly, ref } from 'vue'

import enUS from '@shared/i18n/locales/en-US'
import zhCN from '@shared/i18n/locales/zh-CN'

export type AppLocale = 'zh-CN' | 'en-US'
type Params = Record<string, string | number>

const STORAGE_KEY = 'lyric-timeline.locale'
const messages: Record<AppLocale, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

function detectLocale(): AppLocale {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh-CN' || saved === 'en-US') return saved
  }
  return typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('zh')
    ? 'en-US'
    : 'zh-CN'
}

const currentLocale = ref<AppLocale>(detectLocale())

export function translate(key: string, params: Params = {}): string {
  const template = messages[currentLocale.value][key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

export function setLocale(locale: AppLocale): void {
  currentLocale.value = locale
  if (typeof document !== 'undefined') document.documentElement.lang = locale
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, locale)
  if (typeof window !== 'undefined') void window.desktopApi?.setLocale(locale)
}

export function useI18n() {
  return { locale: readonly(currentLocale), setLocale, t: translate }
}

export const locale = readonly(currentLocale)
