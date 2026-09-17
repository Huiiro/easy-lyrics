import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePlayerStore = defineStore('player', () => {
  const source = ref<string | null>(null)
  const fileName = ref<string | null>(null)
  const currentTime = ref(0)
  const duration = ref(0)
  const playing = ref(false)
  const volume = ref(1)
  const playbackRate = ref(1)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function beginLoad(nextSource: string, nextFileName: string): void {
    source.value = nextSource
    fileName.value = nextFileName
    currentTime.value = 0
    duration.value = 0
    playing.value = false
    loading.value = true
    error.value = null
  }

  function fail(message: string): void {
    loading.value = false
    playing.value = false
    error.value = message
  }

  return {
    source,
    fileName,
    currentTime,
    duration,
    playing,
    volume,
    playbackRate,
    loading,
    error,
    beginLoad,
    fail
  }
})
