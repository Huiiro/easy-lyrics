import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  markTokenAtTime,
  nextCursor,
  previousCursor,
  type TokenCursor
} from '@renderer/services/timing'
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
  const timingFinished = ref(false)
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
    timingFinished.value = false
    dirty.value = true
  }

  function selectToken(lineIndex: number, tokenIndex: number): void {
    const line = project.value.lines[lineIndex]
    if (!line || !line.tokens[tokenIndex]) return
    currentLineIndex.value = lineIndex
    currentTokenIndex.value = tokenIndex
    timingFinished.value = false
  }

  function currentCursor(): TokenCursor {
    return { lineIndex: currentLineIndex.value, tokenIndex: currentTokenIndex.value }
  }

  function navigateToken(direction: -1 | 1): void {
    const cursor =
      direction === -1
        ? previousCursor(project.value.lines, currentCursor())
        : nextCursor(project.value.lines, currentCursor())
    if (!cursor) return
    currentLineIndex.value = cursor.lineIndex
    currentTokenIndex.value = cursor.tokenIndex
    timingFinished.value = false
  }

  function navigateLine(direction: -1 | 1): void {
    if (!project.value.lines.length) return
    const lineIndex = Math.min(
      Math.max(currentLineIndex.value + direction, 0),
      project.value.lines.length - 1
    )
    const line = project.value.lines[lineIndex]
    if (!line?.tokens.length) return
    currentLineIndex.value = lineIndex
    currentTokenIndex.value = Math.min(currentTokenIndex.value, line.tokens.length - 1)
    timingFinished.value = false
  }

  function markCurrentToken(time: number): void {
    const result = markTokenAtTime(project.value.lines, currentCursor(), time)
    if (!result) return
    currentLineIndex.value = result.cursor.lineIndex
    currentTokenIndex.value = result.cursor.tokenIndex
    timingFinished.value = result.finished
    project.value.updatedAt = Date.now()
    dirty.value = true
  }

  function setTokenBoundary(boundary: 'start' | 'end', time: number | null): void {
    const token = activeToken.value
    if (!token || (time !== null && (!Number.isFinite(time) || time < 0))) return

    if (boundary === 'start') {
      token.start = time
      if (time === null) token.end = null
      else if (token.end !== null && token.end < time) token.end = time
    } else {
      token.end = time === null || token.start === null ? null : Math.max(time, token.start)
    }

    project.value.updatedAt = Date.now()
    dirty.value = true
    timingFinished.value = false
  }

  function setTimingOffset(offsetMs: number): void {
    if (!Number.isFinite(offsetMs)) return
    project.value.settings.timingOffsetMs = Math.round(Math.min(Math.max(offsetMs, -5000), 5000))
    project.value.updatedAt = Date.now()
    dirty.value = true
  }

  return {
    project,
    currentLineIndex,
    currentTokenIndex,
    dirty,
    timingFinished,
    activeLine,
    activeToken,
    setAudio,
    setAudioDuration,
    importLyrics,
    selectToken,
    navigateToken,
    navigateLine,
    markCurrentToken,
    setTokenBoundary,
    setTimingOffset
  }
})
