import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const timingOffsetMs = ref(0)
  const theme = ref<'dark' | 'light'>('dark')

  return { timingOffsetMs, theme }
})
