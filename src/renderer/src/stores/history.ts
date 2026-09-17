import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useHistoryStore = defineStore('history', () => {
  const undoDepth = ref(0)
  const redoDepth = ref(0)
  const canUndo = computed(() => undoDepth.value > 0)
  const canRedo = computed(() => redoDepth.value > 0)

  return { undoDepth, redoDepth, canUndo, canRedo }
})
