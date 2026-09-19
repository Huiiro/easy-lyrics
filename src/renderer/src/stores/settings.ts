import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export const shortcutActions = [
  {
    id: 'openProject',
    group: 'project',
    label: 'open_project',
    description: 'open_an_existing_project_file'
  },
  {
    id: 'saveProject',
    group: 'project',
    label: 'save_project',
    description: 'save_the_current_project'
  },
  {
    id: 'importLyrics',
    group: 'project',
    label: 'import_edit_lyrics',
    description: 'open_the_lyrics_editor'
  },
  {
    id: 'exportLyrics',
    group: 'project',
    label: 'export_lyrics',
    description: 'open_the_lyrics_export_dialog'
  },
  {
    id: 'selectAudio',
    group: 'project',
    label: 'select_audio',
    description: 'select_or_replace_the_audio_file'
  },
  { id: 'undo', group: 'edit', label: 'undo', description: 'undo_the_last_change' },
  { id: 'redo', group: 'edit', label: 'redo', description: 'redo_the_last_undone_change' },
  { id: 'playPause', group: 'play', label: 'play_pause', description: 'toggle_audio_playback' },
  {
    id: 'markToken',
    group: 'timing',
    label: 'mark_current_token',
    description: 'set_timing_at_the_current_playhead'
  },
  {
    id: 'previousToken',
    group: 'navigation',
    label: 'previous_token',
    description: 'select_the_previous_token'
  },
  {
    id: 'nextToken',
    group: 'navigation',
    label: 'next_token',
    description: 'select_the_next_token'
  },
  {
    id: 'previousLine',
    group: 'navigation',
    label: 'previous_line',
    description: 'go_to_the_previous_lyric_line'
  },
  {
    id: 'nextLine',
    group: 'navigation',
    label: 'next_line',
    description: 'go_to_the_next_lyric_line'
  },
  {
    id: 'nudgeEarlierFine',
    group: 'edit',
    label: 'nudge_earlier_1_ms',
    description: 'move_the_selection_earlier'
  },
  {
    id: 'nudgeLaterFine',
    group: 'edit',
    label: 'nudge_later_1_ms',
    description: 'move_the_selection_later'
  },
  {
    id: 'nudgeEarlierCoarse',
    group: 'edit',
    label: 'nudge_earlier_50_ms',
    description: 'move_the_selection_earlier_by_a_larger_step'
  },
  {
    id: 'nudgeLaterCoarse',
    group: 'edit',
    label: 'nudge_later_50_ms',
    description: 'move_the_selection_later_by_a_larger_step'
  },
  {
    id: 'locateToken',
    group: 'navigation',
    label: 'locate_selected_token',
    description: 'center_the_selected_token_and_move_the_playhead'
  },
  {
    id: 'toggleLoop',
    group: 'play',
    label: 'toggle_token_loop',
    description: 'enable_or_disable_looping_the_current_token'
  },
  {
    id: 'toggleLyricsFollow',
    group: 'play',
    label: 'toggle_lyrics_follow',
    description: 'control_automatic_lyric_scrolling'
  },
  {
    id: 'toggleTimelineFollow',
    group: 'play',
    label: 'toggle_timeline_follow',
    description: 'control_whether_the_timeline_follows_the_playhead'
  },
  {
    id: 'copyLineTiming',
    group: 'edit',
    label: 'copy_line_timing',
    description: 'copy_token_timing_from_the_current_line'
  },
  {
    id: 'pasteLineTiming',
    group: 'edit',
    label: 'paste_line_timing',
    description: 'paste_timing_at_the_playhead'
  },
  {
    id: 'preprocessLyrics',
    group: 'edit',
    label: 'lyrics_preprocessing',
    description: 'clean_lyrics_with_rules_or_regular_expressions'
  },
  {
    id: 'automaticTiming',
    group: 'timing',
    label: 'auto_timing',
    description: 'generate_initial_timing_from_the_audio_duration'
  },
  {
    id: 'focusTokenSplit',
    group: 'token',
    label: 'split_token',
    description: 'focus_the_token_split_field'
  },
  {
    id: 'mergePreviousToken',
    group: 'token',
    label: 'merge_previous_token',
    description: 'merge_the_current_token_with_the_previous_one'
  },
  {
    id: 'mergeNextToken',
    group: 'token',
    label: 'merge_next_token',
    description: 'merge_the_current_token_with_the_next_one'
  },
  {
    id: 'tokenEditMode',
    group: 'timeline',
    label: 'token_edit_mode',
    description: 'switch_to_single_token_editing'
  },
  {
    id: 'lineEditMode',
    group: 'timeline',
    label: 'line_edit_mode',
    description: 'switch_to_moving_an_entire_line'
  },
  {
    id: 'toggleAdjacentLock',
    group: 'timeline',
    label: 'toggle_adjacent_lock',
    description: 'control_linked_token_boundaries'
  },
  { id: 'zoomOut', group: 'timeline', label: 'zoom_out', description: 'decrease_timeline_zoom' },
  { id: 'zoomIn', group: 'timeline', label: 'zoom_in', description: 'increase_timeline_zoom' },
  {
    id: 'fitTimeline',
    group: 'timeline',
    label: 'fit',
    description: 'show_the_full_audio_time_range'
  }
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
  preprocessLyrics: 'Alt+P',
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

interface StoredSettings {
  shortcuts: ShortcutBindings
  autosaveEnabled: boolean
  autosaveIntervalMs: number
}

export const DEFAULT_AUTOSAVE_INTERVAL_MS = 60_000

function loadSettings(): StoredSettings {
  const defaults: StoredSettings = {
    shortcuts: { ...defaultShortcutBindings },
    autosaveEnabled: true,
    autosaveIntervalMs: DEFAULT_AUTOSAVE_INTERVAL_MS
  }
  if (typeof localStorage === 'undefined') return defaults
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as {
      shortcuts?: Partial<ShortcutBindings>
      autosaveEnabled?: unknown
      autosaveIntervalMs?: unknown
    }
    return {
      shortcuts: { ...defaultShortcutBindings, ...value.shortcuts },
      autosaveEnabled: typeof value.autosaveEnabled === 'boolean' ? value.autosaveEnabled : true,
      autosaveIntervalMs:
        typeof value.autosaveIntervalMs === 'number' &&
        Number.isFinite(value.autosaveIntervalMs) &&
        value.autosaveIntervalMs >= 10_000
          ? value.autosaveIntervalMs
          : DEFAULT_AUTOSAVE_INTERVAL_MS
    }
  } catch {
    return defaults
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

export function formatShortcut(shortcut: string, mac = false): string {
  return shortcut
    .replace('Mod', mac ? '⌘' : 'Ctrl')
    .replace('Alt', mac ? '⌥' : 'Alt')
    .replace('Shift', mac ? '⇧' : 'Shift')
    .replaceAll('+', mac ? ' ' : ' + ')
    .replace('ArrowLeft', '←')
    .replace('ArrowRight', '→')
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
}

export const useSettingsStore = defineStore('settings', () => {
  const stored = loadSettings()
  const shortcuts = ref<ShortcutBindings>(stored.shortcuts)
  const autosaveEnabled = ref(stored.autosaveEnabled)
  const autosaveIntervalMs = ref(stored.autosaveIntervalMs)
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

  function setAutosave(value: { enabled: boolean; intervalMs: number }): void {
    autosaveEnabled.value = value.enabled
    autosaveIntervalMs.value = value.intervalMs
  }

  watch(
    [shortcuts, autosaveEnabled, autosaveIntervalMs],
    ([bindings, enabled, intervalMs]) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            shortcuts: bindings,
            autosaveEnabled: enabled,
            autosaveIntervalMs: intervalMs
          })
        )
      }
      window.desktopApi?.setShortcuts({ ...bindings })
    },
    { deep: true, immediate: true }
  )

  return {
    shortcuts,
    theme,
    autosaveEnabled,
    autosaveIntervalMs,
    conflicts,
    setShortcuts,
    resetShortcuts,
    setAutosave
  }
})
