import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useHistoryStore } from '../src/renderer/src/stores/history'

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
})
