import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface Command {
  label: string
  execute: () => void
  undo: () => void
}

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<Command[]>([])
  const redoStack = ref<Command[]>([])
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const undoDepth = computed(() => undoStack.value.length)
  const redoDepth = computed(() => redoStack.value.length)

  function execute(command: Command): void {
    command.execute()
    recordExecuted(command)
  }

  function recordExecuted(command: Command): void {
    undoStack.value.push(command)
    redoStack.value = []
  }

  function undo(): void {
    const command = undoStack.value.pop()
    if (!command) return
    command.undo()
    redoStack.value.push(command)
  }

  function redo(): void {
    const command = redoStack.value.pop()
    if (!command) return
    command.execute()
    undoStack.value.push(command)
  }

  function clear(): void {
    undoStack.value = []
    redoStack.value = []
  }

  return { undoDepth, redoDepth, canUndo, canRedo, execute, recordExecuted, undo, redo, clear }
})
