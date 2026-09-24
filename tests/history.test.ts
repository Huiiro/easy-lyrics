import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_HISTORY_ENTRIES, useHistoryStore } from '../src/renderer/src/stores/history'

describe('command history', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('executes, undoes and redoes commands', () => {
    const history = useHistoryStore()
    const execute = vi.fn()
    const undo = vi.fn()

    history.execute({ label: 'edit', execute, undo })
    expect(execute).toHaveBeenCalledOnce()
    expect(history.canUndo).toBe(true)

    history.undo()
    expect(undo).toHaveBeenCalledOnce()
    expect(history.canRedo).toBe(true)

    history.redo()
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('drops redo commands after a new edit', () => {
    const history = useHistoryStore()
    const command = { label: 'edit', execute: vi.fn(), undo: vi.fn() }
    history.execute(command)
    history.undo()
    history.recordExecuted(command)
    expect(history.canRedo).toBe(false)
  })

  it('bounds stored commands while preserving the newest undo actions', () => {
    const history = useHistoryStore()
    const undone: number[] = []
    for (let index = 0; index < MAX_HISTORY_ENTRIES + 2; index++) {
      history.recordExecuted({ label: String(index), execute: () => {}, undo: () => undone.push(index) })
    }

    expect(history.undoDepth).toBe(MAX_HISTORY_ENTRIES)
    for (let index = 0; index < MAX_HISTORY_ENTRIES; index++) history.undo()
    expect(undone[0]).toBe(MAX_HISTORY_ENTRIES + 1)
    expect(undone.at(-1)).toBe(2)
    expect(history.canUndo).toBe(false)
  })
})
