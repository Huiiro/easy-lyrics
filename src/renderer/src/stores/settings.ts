import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export const shortcutActions = [
  { id: 'playPause', group: '播放', label: '播放 / 暂停', description: '切换当前音频的播放状态' },
  {
    id: 'markToken',
    group: '打轴',
    label: '记录当前 Token',
    description: '在当前播放位置写入时间点'
  },
  {
    id: 'previousToken',
    group: '导航',
    label: '上一个 Token',
    description: '将选择移动到上一个 Token'
  },
  {
    id: 'nextToken',
    group: '导航',
    label: '下一个 Token',
    description: '将选择移动到下一个 Token'
  },
  { id: 'previousLine', group: '导航', label: '上一句', description: '跳转到上一句歌词' },
  { id: 'nextLine', group: '导航', label: '下一句', description: '跳转到下一句歌词' },
  {
    id: 'nudgeEarlierFine',
    group: '编辑',
    label: '向前微调 1 ms',
    description: '向前移动当前选区'
  },
  { id: 'nudgeLaterFine', group: '编辑', label: '向后微调 1 ms', description: '向后移动当前选区' },
  {
    id: 'nudgeEarlierCoarse',
    group: '编辑',
    label: '向前微调 50 ms',
    description: '大步向前移动当前选区'
  },
  {
    id: 'nudgeLaterCoarse',
    group: '编辑',
    label: '向后微调 50 ms',
    description: '大步向后移动当前选区'
  }
] as const

export type ShortcutAction = (typeof shortcutActions)[number]['id']
export type ShortcutBindings = Record<ShortcutAction, string>

export const defaultShortcutBindings: ShortcutBindings = {
  playPause: 'Space',
  markToken: 'F',
  previousToken: 'ArrowLeft',
  nextToken: 'ArrowRight',
  previousLine: 'ArrowUp',
  nextLine: 'ArrowDown',
  nudgeEarlierFine: 'Mod+ArrowLeft',
  nudgeLaterFine: 'Mod+ArrowRight',
  nudgeEarlierCoarse: 'Shift+ArrowLeft',
  nudgeLaterCoarse: 'Shift+ArrowRight'
}

const storageKey = 'lyric-timeline.settings.v1'

function loadBindings(): ShortcutBindings {
  if (typeof localStorage === 'undefined') return { ...defaultShortcutBindings }
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as {
      shortcuts?: Partial<ShortcutBindings>
    }
    return { ...defaultShortcutBindings, ...value.shortcuts }
  } catch {
    return { ...defaultShortcutBindings }
  }
}

export function shortcutFromEvent(event: KeyboardEvent): string | null {
  const modifierCodes = ['Control', 'Shift', 'Alt', 'Meta']
  if (modifierCodes.includes(event.key)) return null
  const key =
    event.code === 'Space' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key
  const parts: string[] = []
  if (event.metaKey || event.ctrlKey) parts.push('Mod')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  return shortcutFromEvent(event) === shortcut
}

export const useSettingsStore = defineStore('settings', () => {
  const shortcuts = ref<ShortcutBindings>(loadBindings())
  const theme = ref<'dark' | 'light'>('dark')
  const conflicts = computed(() => {
    const counts = Object.values(shortcuts.value).reduce<Record<string, number>>(
      (result, value) => {
        if (value) result[value] = (result[value] ?? 0) + 1
        return result
      },
      {}
    )
    return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 1))
  })

  function setShortcuts(value: ShortcutBindings): void {
    shortcuts.value = { ...value }
  }

  function resetShortcuts(): void {
    shortcuts.value = { ...defaultShortcutBindings }
  }

  watch(
    shortcuts,
    (value) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify({ shortcuts: value }))
      }
    },
    { deep: true }
  )

  return { shortcuts, theme, conflicts, setShortcuts, resetShortcuts }
})
