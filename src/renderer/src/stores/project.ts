import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'

import {
  createAutomaticTiming,
  markTokenAtTime,
  nextCursor,
  previousCursor,
  type TokenCursor
} from '@renderer/services/timing'
import { MIN_TOKEN_DURATION } from '@renderer/timeline/editing'
import { useHistoryStore } from '@renderer/stores/history'
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

interface LineTimingClipboard {
  tokenTexts: string[]
  timings: Array<{ startOffset: number; endOffset: number | null }>
}

export const useProjectStore = defineStore('project', () => {
  const project = ref<LyricProject>(createEmptyProject())
  const currentLineIndex = ref(0)
  const currentTokenIndex = ref(0)
  const tokenSelected = ref(true)
  const dirty = ref(false)
  const timingFinished = ref(false)
  const lineTimingClipboard = ref<LineTimingClipboard | null>(null)
  const activeLine = computed(() => project.value.lines[currentLineIndex.value] ?? null)
  const activeToken = computed(() =>
    tokenSelected.value ? (activeLine.value?.tokens[currentTokenIndex.value] ?? null) : null
  )
  const canCopyLineTiming = computed(() =>
    Boolean(activeLine.value?.tokens.length && activeLine.value.tokens.every((token) => token.start !== null))
  )
  const canPasteLineTiming = computed(() => {
    const clipboard = lineTimingClipboard.value
    const line = activeLine.value
    return Boolean(
      clipboard &&
        line &&
        clipboard.tokenTexts.length === line.tokens.length &&
        clipboard.tokenTexts.every((text, index) => text === line.tokens[index]?.text)
    )
  })

  function snapshot(): LyricProject {
    return structuredClone(toRaw(project.value))
  }

  function restore(next: LyricProject, markDirty = true): void {
    project.value = structuredClone(next)
    dirty.value = markDirty
    timingFinished.value = false
    const lastLineIndex = Math.max(project.value.lines.length - 1, 0)
    currentLineIndex.value = Math.min(currentLineIndex.value, lastLineIndex)
    const tokens = project.value.lines[currentLineIndex.value]?.tokens ?? []
    currentTokenIndex.value = Math.min(currentTokenIndex.value, Math.max(tokens.length - 1, 0))
    tokenSelected.value = tokens.length > 0
  }

  function recordChange(label: string, before: LyricProject, after = snapshot()): void {
    if (JSON.stringify(before) === JSON.stringify(after)) return
    useHistoryStore().recordExecuted({
      label,
      execute: () => restore(after),
      undo: () => restore(before)
    })
  }

  function mutate(label: string, mutation: () => void): void {
    const before = snapshot()
    mutation()
    recordChange(label, before)
  }

  function setAudio(audio: AudioSource): void {
    mutate('设置音频', () => {
      project.value.audio = audio
      project.value.updatedAt = Date.now()
      dirty.value = true
    })
  }

  function setProjectName(name: string): void {
    const normalized = name.trim()
    if (!normalized || normalized === project.value.name) return
    mutate('重命名工程', () => {
      project.value.name = normalized
      project.value.updatedAt = Date.now()
      dirty.value = true
    })
  }

  function setAudioDuration(duration: number): void {
    if (!project.value.audio) return
    project.value.audio.duration = duration
    project.value.updatedAt = Date.now()
  }

  function importLyrics(lines: LyricLine[], tokenizer: TokenizerMode): void {
    mutate('导入歌词', () => {
      project.value.lines = lines
      project.value.settings.tokenizer = tokenizer
      project.value.updatedAt = Date.now()
      currentLineIndex.value = 0
      currentTokenIndex.value = 0
      tokenSelected.value = lines.length > 0
      timingFinished.value = false
      dirty.value = true
    })
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
    const before = snapshot()
    const result = markTokenAtTime(project.value.lines, currentCursor(), time)
    if (!result) return
    currentLineIndex.value = result.cursor.lineIndex
    currentTokenIndex.value = result.cursor.tokenIndex
    timingFinished.value = result.finished
    project.value.updatedAt = Date.now()
    dirty.value = true
    recordChange('记录 Token 时间', before)
  }

  function setTokenBoundary(boundary: 'start' | 'end', time: number | null): void {
    const token = activeToken.value
    if (!token || (time !== null && (!Number.isFinite(time) || time < 0))) return

    const before = snapshot()
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
    recordChange('调整 Token 边界', before)
  }

  function applyTokenTimingUpdates(updates: TokenTimingUpdate[], recordHistory = true): void {
    const before = recordHistory ? snapshot() : null
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
    if (before) recordChange('调整时间', before)
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
    mutate('调整时间偏移', () => {
      project.value.settings.timingOffsetMs = Math.round(Math.min(Math.max(offsetMs, -5000), 5000))
      project.value.updatedAt = Date.now()
      dirty.value = true
    })
  }

  function applyAutomaticTiming(duration: number): boolean {
    const updates = createAutomaticTiming(project.value.lines, duration)
    if (updates.length === 0) return false
    const before = snapshot()
    for (const update of updates) {
      const token = project.value.lines[update.lineIndex]?.tokens[update.tokenIndex]
      if (!token) continue
      token.start = update.start
      token.end = update.end
    }
    project.value.updatedAt = Date.now()
    dirty.value = true
    timingFinished.value = true
    recordChange('智能打轴', before)
    return true
  }

  function copyActiveLineTiming(): boolean {
    const line = activeLine.value
    const firstStart = line?.tokens[0]?.start
    if (!line || firstStart === null || firstStart === undefined || !canCopyLineTiming.value) return false
    lineTimingClipboard.value = {
      tokenTexts: line.tokens.map((token) => token.text),
      timings: line.tokens.map((token) => ({
        startOffset: (token.start ?? firstStart) - firstStart,
        endOffset: token.end === null ? null : token.end - firstStart
      }))
    }
    return true
  }

  function pasteLineTimingAt(time: number): boolean {
    const line = activeLine.value
    const clipboard = lineTimingClipboard.value
    if (!line || !clipboard || !canPasteLineTiming.value || !Number.isFinite(time) || time < 0) return false
    mutate('粘贴整句时间', () => {
      for (let index = 0; index < line.tokens.length; index += 1) {
        const token = line.tokens[index]
        const timing = clipboard.timings[index]
        if (!token || !timing) continue
        token.start = time + timing.startOffset
        token.end = timing.endOffset === null ? null : time + timing.endOffset
      }
      project.value.updatedAt = Date.now()
      dirty.value = true
      timingFinished.value = false
    })
    return true
  }

  function splitActiveToken(parts: string[]): boolean {
    const line = activeLine.value
    const token = activeToken.value
    const normalized = parts.map((part) => part.trim()).filter(Boolean)
    if (!line || !token || normalized.length < 2 || normalized.join('') !== token.text) return false

    const before = snapshot()
    const duration =
      token.start !== null && token.end !== null ? Math.max(0, token.end - token.start) : null
    const replacements: LyricToken[] = normalized.map((text, index) => {
      const start =
        token.start === null ? null : duration === null ? (index === 0 ? token.start : null) : token.start + (duration * index) / normalized.length
      const end =
        token.start === null || duration === null
          ? null
          : token.start + (duration * (index + 1)) / normalized.length
      return { id: crypto.randomUUID(), text, start, end }
    })
    line.tokens.splice(currentTokenIndex.value, 1, ...replacements)
    currentTokenIndex.value = Math.min(currentTokenIndex.value, line.tokens.length - 1)
    project.value.updatedAt = Date.now()
    dirty.value = true
    timingFinished.value = false
    recordChange('拆分 Token', before)
    return true
  }

  function mergeActiveToken(direction: -1 | 1): boolean {
    const line = activeLine.value
    if (!line || !activeToken.value) return false
    const leftIndex = direction === -1 ? currentTokenIndex.value - 1 : currentTokenIndex.value
    const left = line.tokens[leftIndex]
    const right = line.tokens[leftIndex + 1]
    if (!left || !right) return false

    const before = snapshot()
    const starts = [left.start, right.start].filter((value): value is number => value !== null)
    const ends = [left.end, right.end].filter((value): value is number => value !== null)
    const merged: LyricToken = {
      id: left.id,
      text: left.text + right.text,
      start: starts.length ? Math.min(...starts) : null,
      end: ends.length ? Math.max(...ends) : null
    }
    line.tokens.splice(leftIndex, 2, merged)
    currentTokenIndex.value = leftIndex
    tokenSelected.value = true
    project.value.updatedAt = Date.now()
    dirty.value = true
    timingFinished.value = false
    recordChange('合并 Token', before)
    return true
  }

  function mergeSelectedTokens(tokenIds: string[]): boolean {
    const selectedIds = new Set(tokenIds)
    if (selectedIds.size < 2) return false

    const matches = project.value.lines.flatMap((line, lineIndex) =>
      line.tokens.flatMap((token, tokenIndex) =>
        selectedIds.has(token.id) ? [{ line, lineIndex, token, tokenIndex }] : []
      )
    )
    if (matches.length !== selectedIds.size || matches.some((match) => match.lineIndex !== matches[0]?.lineIndex)) {
      return false
    }
    matches.sort((left, right) => left.tokenIndex - right.tokenIndex)
    const first = matches[0]
    if (!first || matches.some((match, index) => match.tokenIndex !== first.tokenIndex + index)) {
      return false
    }

    const before = snapshot()
    const starts = matches.flatMap(({ token }) => (token.start === null ? [] : [token.start]))
    const ends = matches.flatMap(({ token }) => (token.end === null ? [] : [token.end]))
    const merged: LyricToken = {
      id: first.token.id,
      text: matches.map(({ token }) => token.text).join(''),
      start: starts.length ? Math.min(...starts) : null,
      end: ends.length ? Math.max(...ends) : null
    }
    first.line.tokens.splice(first.tokenIndex, matches.length, merged)
    currentLineIndex.value = first.lineIndex
    currentTokenIndex.value = first.tokenIndex
    tokenSelected.value = true
    project.value.updatedAt = Date.now()
    dirty.value = true
    timingFinished.value = false
    recordChange('合并选中 Token', before)
    return true
  }

  function deleteTokens(tokenIds: string[]): boolean {
    const selectedIds = new Set(tokenIds)
    if (!selectedIds.size) return false
    const firstLocation = project.value.lines.flatMap((line, lineIndex) =>
      line.tokens.flatMap((token, tokenIndex) =>
        selectedIds.has(token.id) ? [{ lineIndex, tokenIndex }] : []
      )
    )[0]
    if (!firstLocation) return false

    const before = snapshot()
    for (const line of project.value.lines) {
      for (let tokenIndex = line.tokens.length - 1; tokenIndex >= 0; tokenIndex -= 1) {
        const token = line.tokens[tokenIndex]
        if (token && selectedIds.has(token.id)) line.tokens.splice(tokenIndex, 1)
      }
    }
    for (let lineIndex = project.value.lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
      if (project.value.lines[lineIndex]?.tokens.length === 0) project.value.lines.splice(lineIndex, 1)
    }

    if (project.value.lines.length) {
      currentLineIndex.value = Math.min(firstLocation.lineIndex, project.value.lines.length - 1)
      const line = project.value.lines[currentLineIndex.value]
      currentTokenIndex.value = Math.min(firstLocation.tokenIndex, Math.max((line?.tokens.length ?? 1) - 1, 0))
      tokenSelected.value = Boolean(line?.tokens[currentTokenIndex.value])
    } else {
      currentLineIndex.value = 0
      currentTokenIndex.value = 0
      tokenSelected.value = false
    }
    project.value.updatedAt = Date.now()
    dirty.value = true
    timingFinished.value = false
    recordChange(selectedIds.size > 1 ? '删除选中 Token' : '删除 Token', before)
    return true
  }

  function insertTokenAdjacent(direction: -1 | 1, text: string): boolean {
    const line = activeLine.value
    const token = activeToken.value
    const normalized = text.trim()
    if (!line || !token || !normalized) return false

    const before = snapshot()
    const insertIndex = currentTokenIndex.value + (direction === 1 ? 1 : 0)
    const previous = line.tokens[insertIndex - 1]
    const next = line.tokens[insertIndex]
    let start: number | null = null
    let end: number | null = null
    if (
      previous?.end !== null &&
      previous?.end !== undefined &&
      next?.start !== null &&
      next?.start !== undefined &&
      next.start - previous.end >= MIN_TOKEN_DURATION
    ) {
      start = previous.end
      end = next.start
    } else if (
      token.start !== null &&
      token.end !== null &&
      token.end - token.start >= MIN_TOKEN_DURATION * 2
    ) {
      const midpoint = token.start + (token.end - token.start) / 2
      if (direction === -1) {
        start = token.start
        end = midpoint
        token.start = midpoint
      } else {
        start = midpoint
        end = token.end
        token.end = midpoint
      }
    }
    line.tokens.splice(insertIndex, 0, { id: crypto.randomUUID(), text: normalized, start, end })
    currentTokenIndex.value = insertIndex
    tokenSelected.value = true
    project.value.updatedAt = Date.now()
    dirty.value = true
    timingFinished.value = false
    recordChange('插入 Token', before)
    return true
  }

  function loadProject(next: LyricProject): void {
    restore(next, false)
    useHistoryStore().clear()
  }

  function markSaved(): void {
    dirty.value = false
  }

  return {
    project,
    currentLineIndex,
    currentTokenIndex,
    dirty,
    timingFinished,
    activeLine,
    activeToken,
    canCopyLineTiming,
    canPasteLineTiming,
    setAudio,
    setProjectName,
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
    applyAutomaticTiming,
    copyActiveLineTiming,
    pasteLineTimingAt,
    splitActiveToken,
    mergeActiveToken,
    mergeSelectedTokens,
    deleteTokens,
    insertTokenAdjacent,
    setTimingOffset,
    loadProject,
    markSaved,
    snapshot,
    recordChange
  }
})
