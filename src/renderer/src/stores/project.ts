import { defineStore } from 'pinia'
import { ref } from 'vue'

import { createEmptyProject, type AudioSource, type LyricProject } from '@shared/models/project'

export const useProjectStore = defineStore('project', () => {
  const project = ref<LyricProject>(createEmptyProject())
  const currentLineIndex = ref(0)
  const currentTokenIndex = ref(0)
  const dirty = ref(false)

  function setAudio(audio: AudioSource): void {
    project.value.audio = audio
    project.value.updatedAt = Date.now()
    dirty.value = true
  }

  function setAudioDuration(duration: number): void {
    if (!project.value.audio) return
    project.value.audio.duration = duration
    project.value.updatedAt = Date.now()
  }

  return {
    project,
    currentLineIndex,
    currentTokenIndex,
    dirty,
    setAudio,
    setAudioDuration
  }
})
