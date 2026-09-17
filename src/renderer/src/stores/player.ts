import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePlayerStore = defineStore('player', () => {
  const source = ref<string | null>(null)
  const currentTime = ref(0)
  const duration = ref(0)
  const playing = ref(false)
  const volume = ref(1)
  const playbackRate = ref(1)

  return { source, currentTime, duration, playing, volume, playbackRate }
})
