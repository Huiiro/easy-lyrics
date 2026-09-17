import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTimelineStore = defineStore('timeline', () => {
  const startTime = ref(0)
  const pixelsPerSecond = ref(100)
  const selectedTokenId = ref<string | null>(null)

  return { startTime, pixelsPerSecond, selectedTokenId }
})
