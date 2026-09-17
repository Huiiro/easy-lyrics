import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  createEmptyProject,
  type AudioSource,
  type LyricLine,
  type LyricProject,
  type TokenizerMode
} from '@shared/models/project'

export const useProjectStore = defineStore('project', () => {
  const project = ref<LyricProject>(createEmptyProject())
  const currentLineIndex = ref(0)
  const currentTokenIndex = ref(0)
  const dirty = ref(false)
  const activeLine = computed(() => project.value.lines[currentLineIndex.value] ?? null)
  const activeToken = computed(() => activeLine.value?.tokens[currentTokenIndex.value] ?? null)

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

  function importLyrics(lines: LyricLine[], tokenizer: TokenizerMode): void {
    project.value.lines = lines
    project.value.settings.tokenizer = tokenizer
    project.value.updatedAt = Date.now()
    currentLineIndex.value = 0
    currentTokenIndex.value = 0
    dirty.value = true
  }

  function selectToken(lineIndex: number, tokenIndex: number): void {
    const line = project.value.lines[lineIndex]
    if (!line || !line.tokens[tokenIndex]) return
    currentLineIndex.value = lineIndex
    currentTokenIndex.value = tokenIndex
  }

  return {
    project,
    currentLineIndex,
    currentTokenIndex,
    dirty,
    activeLine,
    activeToken,
    setAudio,
    setAudioDuration,
    importLyrics,
    selectToken
  }
})
