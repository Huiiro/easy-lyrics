import { describe, expect, it } from 'vitest'

import {
  DEFAULT_AUTOSAVE_INTERVAL_MS,
  defaultShortcutBindings,
  shortcutActions,
  shortcutFromEvent
} from '../src/renderer/src/stores/settings'

describe('shortcut settings', () => {
  it('defaults autosave to a one-minute interval', () => {
    expect(DEFAULT_AUTOSAVE_INTERVAL_MS).toBe(60_000)
  })

  it('provides a unique default binding for every action', () => {
    const actionIds = shortcutActions.map((action) => action.id)
    const bindings = actionIds.map((id) => defaultShortcutBindings[id])

    expect(Object.keys(defaultShortcutBindings)).toHaveLength(actionIds.length)
    expect(bindings.every(Boolean)).toBe(true)
    expect(new Set(bindings).size).toBe(bindings.length)
  })

  it('normalizes configurable modifier shortcuts', () => {
    expect(
      shortcutFromEvent({
        key: 'o',
        code: 'KeyO',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true
      } as KeyboardEvent)
    ).toBe('Mod+Shift+O')
    expect(
      shortcutFromEvent({
        key: ' ',
        code: 'Space',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false
      } as KeyboardEvent)
    ).toBe('Space')
  })
})
