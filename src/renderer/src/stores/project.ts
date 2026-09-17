import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  markTokenAtTime,
  nextCursor,
  previousCursor,
  type TokenCursor
} from '@renderer/services/timing'
import { MIN_TOKEN_DURATION } from '@renderer/timeline/editing'
import {
  createEmptyProject,
  type AudioSource,
  type LyricLine,
  type LyricProject,
  type LyricToken,
  type TokenizerMode
} from '@shared/models/project'

export interface TokenTimingUpdate {
  lineIndex: number
  tokenIndex: number
  start: LyricToken['start']
  end: LyricToken['end']
}

export const useProjectStore = defineStore('project', () => {
  const project = ref<LyricProject>(createEmptyProject())
  const currentLineIndex = ref(0)
  const currentTokenIndex = ref(0)
  const tokenSelected = ref(true)
  const dirty = ref(false)
  const timingFinished = ref(false)
  const activeLine = computed(() => project.value.lines[currentLineIndex.value] ?? null)
  const activeToken = computed(() =>
    tokenSelected.value ? (activeLine.value?.tokens[currentTokenIndex.value] ?? null) : null
  )

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
    tokenSelected.value = lines.length > 0
    timingFinished.value = false
    dirty.value = true
  }

  function selectToken(lineIndex: number, tokenIndex: number): void {
    const line = project.value.lines[lineIndex]
    if (!line || !line.tokens[tokenIndex]) return
    currentLineIndex.value = lineIndex
    currentTokenIndex.value = tokenIndex
    tokenSelected.value = true
    timingFinished.value = false
  }

  function clearTokenSelection(): void {
    tokenSelected.value = false
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
    tokenSelected.value = true
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
    tokenSelected.value = true
    timingFinished.value = false
  }

  function markCurrentToken(time: number): void {
    if (!activeToken.value) return
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

  function applyTokenTimingUpdates(updates: TokenTimingUpdate[]): void {
    let changed = false
    for (const update of updates) {
      const token = project.value.lines[update.lineIndex]?.tokens[update.tokenIndex]
      if (!token || (token.start === update.start && token.end === update.end)) continue
      token.start = update.start
      token.end = update.end
      changed = true
    }
    if (!changed) return
    project.value.updatedAt = Date.now()
    dirty.value = true
    timingFinished.value = false
  }

  function nudgeActiveToken(delta: number): void {
    const token = activeToken.value
    if (!token || token.start === null || !Number.isFinite(delta)) return
    const appliedDelta = Math.max(delta, -token.start)
    applyTokenTimingUpdates([
      {
        lineIndex: currentLineIndex.value,
        tokenIndex: currentTokenIndex.value,
        start: token.start + appliedDelta,
        end: token.end === null ? null : token.end + appliedDelta
      }
    ])
  }

  function nudgeSelection(delta: number, mode: 'token' | 'line', adjacentLocked: boolean): void {
    const token = activeToken.value
    const line = activeLine.value
    if (!token || !line || token.start === null || !Number.isFinite(delta)) return

    if (mode === 'line') {
      const timedTokens = line.tokens.filter((item) => item.start !== null)
      if (timedTokens.length === 0) return
      const firstStart = Math.min(...timedTokens.map((item) => item.start ?? 0))
      const appliedDelta = Math.max(delta, -firstStart)
      applyTokenTimingUpdates(
        line.tokens.map((item, tokenIndex) => ({
          lineIndex: currentLineIndex.value,
          tokenIndex,
          start: item.start === null ? null : item.start + appliedDelta,
          end: item.end === null ? null : item.end + appliedDelta
        }))
      )
      return
    }

    if (!adjacentLocked) {
      nudgeActiveToken(delta)
      return
    }

    const previous = line.tokens[currentTokenIndex.value - 1]
    const next = line.tokens[currentTokenIndex.value + 1]
    let appliedDelta = Math.max(delta, -token.start)
    if (previous?.start !== null && previous?.start !== undefined) {
      appliedDelta = Math.max(appliedDelta, previous.start + MIN_TOKEN_DURATION - token.start)
    }
    if (token.end !== null && next?.end !== null && next?.end !== undefined) {
      appliedDelta = Math.min(appliedDelta, next.end - MIN_TOKEN_DURATION - token.end)
    }
    const start = token.start + appliedDelta
    const end = token.end === null ? null : token.end + appliedDelta
    const updates: TokenTimingUpdate[] = [
      {
        lineIndex: currentLineIndex.value,
        tokenIndex: currentTokenIndex.value,
        start,
        end
      }
    ]
    if (previous?.start !== null && previous?.start !== undefined) {
      updates.push({
        lineIndex: currentLineIndex.value,
        tokenIndex: currentTokenIndex.value - 1,
        start: previous.start,
        end: start
      })
    }
    if (end !== null && next?.start !== null && next?.start !== undefined) {
      updates.push({
        lineIndex: currentLineIndex.value,
        tokenIndex: currentTokenIndex.value + 1,
        start: end,
        end: next.end
      })
    }
    applyTokenTimingUpdates(updates)
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
    clearTokenSelection,
    navigateToken,
    navigateLine,
    markCurrentToken,
    setTokenBoundary,
    applyTokenTimingUpdates,
    nudgeActiveToken,
    nudgeSelection,
    setTimingOffset
  }
})
