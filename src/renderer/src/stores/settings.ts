import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export const shortcutActions = [
  { id: 'openProject', group: '工程', label: '打开工程', description: '打开已有工程文件' },
  { id: 'saveProject', group: '工程', label: '保存工程', description: '保存当前工程' },
  { id: 'importLyrics', group: '工程', label: '导入 / 编辑歌词', description: '打开歌词编辑窗口' },
  { id: 'exportLyrics', group: '工程', label: '导出歌词', description: '打开歌词导出窗口' },
  { id: 'selectAudio', group: '工程', label: '选择音频', description: '选择或更换音频文件' },
  { id: 'undo', group: '编辑', label: '撤销', description: '撤销上一次修改' },
  { id: 'redo', group: '编辑', label: '重做', description: '恢复上一次撤销' },
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
  },
  { id: 'locateToken', group: '导航', label: '定位选中 Token', description: '将选中 Token 居中并移动播放头' },
  { id: 'toggleLoop', group: '播放', label: '切换 Token Loop', description: '开启或退出当前 Token 循环' },
  { id: 'toggleLyricsFollow', group: '播放', label: '切换歌词跟随', description: '控制左侧歌词自动跟随播放' },
  { id: 'toggleTimelineFollow', group: '播放', label: '切换时间轴跟随', description: '控制时间轴自动跟随播放头' },
  { id: 'copyLineTiming', group: '编辑', label: '复制整句时间', description: '复制当前句的 Token 时间结构' },
  { id: 'pasteLineTiming', group: '编辑', label: '粘贴整句时间', description: '在播放头位置粘贴时间结构' },
  { id: 'automaticTiming', group: '打轴', label: '智能打轴', description: '根据音频时长生成初始时间' },
  { id: 'focusTokenSplit', group: 'Token', label: '拆分 Token', description: '聚焦 Token 拆分输入框' },
  { id: 'mergePreviousToken', group: 'Token', label: '合并前一个 Token', description: '将当前 Token 与前项合并' },
  { id: 'mergeNextToken', group: 'Token', label: '合并后一个 Token', description: '将当前 Token 与后项合并' },
  { id: 'tokenEditMode', group: '时间轴', label: 'Token 编辑模式', description: '切换为单 Token 编辑' },
  { id: 'lineEditMode', group: '时间轴', label: '整句编辑模式', description: '切换为整句移动' },
  { id: 'toggleAdjacentLock', group: '时间轴', label: '切换相邻锁定', description: '控制 Token 边界联动' },
  { id: 'zoomOut', group: '时间轴', label: '缩小时间轴', description: '降低时间轴缩放比例' },
  { id: 'zoomIn', group: '时间轴', label: '放大时间轴', description: '提高时间轴缩放比例' },
  { id: 'fitTimeline', group: '时间轴', label: '适合窗口', description: '显示完整音频时间范围' }
] as const

export type ShortcutAction = (typeof shortcutActions)[number]['id']
export type ShortcutBindings = Record<ShortcutAction, string>

export const defaultShortcutBindings: ShortcutBindings = {
  openProject: 'Mod+O',
  saveProject: 'Mod+S',
  importLyrics: 'Mod+I',
  exportLyrics: 'Mod+E',
  selectAudio: 'Mod+Shift+O',
  undo: 'Mod+Z',
  redo: 'Mod+Shift+Z',
  playPause: 'Space',
  markToken: 'F',
  previousToken: 'ArrowLeft',
  nextToken: 'ArrowRight',
  previousLine: 'ArrowUp',
  nextLine: 'ArrowDown',
  nudgeEarlierFine: 'Mod+ArrowLeft',
  nudgeLaterFine: 'Mod+ArrowRight',
  nudgeEarlierCoarse: 'Shift+ArrowLeft',
  nudgeLaterCoarse: 'Shift+ArrowRight',
  locateToken: 'L',
  toggleLoop: 'R',
  toggleLyricsFollow: 'Shift+F',
  toggleTimelineFollow: 'T',
  copyLineTiming: 'Alt+C',
  pasteLineTiming: 'Alt+V',
  automaticTiming: 'Alt+A',
  focusTokenSplit: 'S',
  mergePreviousToken: '[',
  mergeNextToken: ']',
  tokenEditMode: '1',
  lineEditMode: '2',
  toggleAdjacentLock: 'A',
  zoomOut: '-',
  zoomIn: '=',
  fitTimeline: '0'
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
