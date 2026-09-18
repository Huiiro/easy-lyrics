<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'

import PlayerBar from '@renderer/components/PlayerBar.vue'
import { useI18n } from '@renderer/i18n'
import { getAudioPlayer } from '@renderer/services/audio-player'
import { decodeWaveform } from '@renderer/services/waveform'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import { useTimelineStore } from '@renderer/stores/timeline'
import {
  clampGroupDelta,
  clampTokenEnd,
  clampTokenMove,
  clampTokenStart,
  MIN_TOKEN_DURATION,
  SNAP_THRESHOLD_PIXELS,
  snapTime,
  type TokenTimingSnapshot
} from '@renderer/timeline/editing'
import { TimelineRenderer } from '@renderer/timeline/TimelineRenderer'
import { xToTime } from '@renderer/timeline/viewport'
import { MAX_PIXELS_PER_SECOND, MIN_PIXELS_PER_SECOND } from '@renderer/timeline/viewport'
import type { LyricProject } from '@shared/models/project'

const canvas = ref<HTMLCanvasElement | null>(null)
const container = ref<HTMLElement | null>(null)
const canvasHeight = ref(190)

type Interaction =
  | { kind: 'seek' }
  | { kind: 'pan'; lastX: number }
  | {
      kind: 'token-move' | 'token-left' | 'token-right' | 'line-move'
      lineIndex: number
      tokenIndex: number
      originTime: number
      snapshots: TokenTimingSnapshot[]
      projectBefore: LyricProject
    }

let interaction: Interaction | null = null

const player = getAudioPlayer()
const playerStore = usePlayerStore()
const projectStore = useProjectStore()
const timelineStore = useTimelineStore()
const { t } = useI18n()

const loopRange = computed(() => {
  const token = projectStore.activeToken
  if (token?.start === null || token?.start === undefined || token.end === null || token.end <= token.start) {
    return null
  }
  return { start: token.start, end: token.end }
})

let resizeObserver: ResizeObserver | null = null
let waveformAbort: AbortController | null = null
let renderer: TimelineRenderer | null = null

function duration(): number {
  return playerStore.duration || timelineStore.waveform?.duration || 0
}

function pointerX(event: PointerEvent | WheelEvent): number {
  return event.clientX - (canvas.value?.getBoundingClientRect().left ?? 0)
}

function seekAt(x: number): void {
  player.seek(Math.min(Math.max(xToTime(x, timelineStore.viewport), 0), duration()))
}

function timingSnapshots(): TokenTimingSnapshot[] {
  return projectStore.project.lines.flatMap((line, lineIndex) =>
    line.tokens.map((token, tokenIndex) => ({
      id: token.id,
      lineIndex,
      tokenIndex,
      start: token.start,
      end: token.end
    }))
  )
}

function snapCandidates(snapshots: TokenTimingSnapshot[], excludedIds: Set<string>): number[] {
  const candidates = snapshots.flatMap((token) => {
    if (excludedIds.has(token.id)) return []
    return [token.start, token.end].filter((time): time is number => time !== null)
  })
  candidates.push(playerStore.currentTime)
  return candidates
}

function bestSnapDelta(
  boundaries: number[],
  delta: number,
  candidates: number[]
): { delta: number; guide: number | null } {
  const threshold = SNAP_THRESHOLD_PIXELS / timelineStore.pixelsPerSecond
  let best = { delta, guide: null as number | null, distance: threshold + Number.EPSILON }
  for (const boundary of boundaries) {
    const proposed = boundary + delta
    const snapped = snapTime(proposed, candidates, threshold)
    const distance = Math.abs(snapped.time - proposed)
    if (snapped.snappedTo !== null && distance < best.distance) {
      best = { delta: delta + snapped.time - proposed, guide: snapped.snappedTo, distance }
    }
  }
  return { delta: best.delta, guide: best.guide }
}

function previewEdit(
  event: PointerEvent,
  edit: Extract<Interaction, { originTime: number }>
): void {
  const pointerTime = xToTime(pointerX(event), timelineStore.viewport)
  const rawDelta = pointerTime - edit.originTime
  const target = edit.snapshots.find(
    (token) => token.lineIndex === edit.lineIndex && token.tokenIndex === edit.tokenIndex
  )
  if (!target || target.start === null) return

  const lineTokens = edit.snapshots.filter((token) => token.lineIndex === edit.lineIndex)
  const previous = lineTokens.find((token) => token.tokenIndex === edit.tokenIndex - 1)
  const next = lineTokens.find((token) => token.tokenIndex === edit.tokenIndex + 1)
  const linked = timelineStore.adjacentLocked && !event.altKey
  const targetEnd = target.end ?? next?.start ?? target.start + 0.12
  const excluded = new Set(
    edit.kind === 'line-move' ? lineTokens.map((token) => token.id) : [target.id]
  )
  const candidates = snapCandidates(edit.snapshots, excluded)
  const updates: Array<{
    lineIndex: number
    tokenIndex: number
    start: number | null
    end: number | null
  }> = []

  if (edit.kind === 'line-move') {
    let delta = clampGroupDelta(lineTokens, rawDelta, duration() || Number.POSITIVE_INFINITY)
    const boundaries = lineTokens.flatMap((token) =>
      token.start === null ? [] : token.end === null ? [token.start] : [token.start, token.end]
    )
    const snapped = bestSnapDelta(boundaries, delta, candidates)
    delta = clampGroupDelta(lineTokens, snapped.delta, duration() || Number.POSITIVE_INFINITY)
    timelineStore.snapGuideTime = delta === snapped.delta ? snapped.guide : null
    for (const token of lineTokens) {
      updates.push({
        lineIndex: token.lineIndex,
        tokenIndex: token.tokenIndex,
        start: token.start === null ? null : token.start + delta,
        end: token.end === null ? null : token.end + delta
      })
    }
  } else if (edit.kind === 'token-left') {
    const snapped = snapTime(
      target.start + rawDelta,
      candidates,
      SNAP_THRESHOLD_PIXELS / timelineStore.pixelsPerSecond
    )
    let start = clampTokenStart(snapped.time, targetEnd)
    if (linked && previous?.start !== null && previous?.start !== undefined) {
      start = Math.max(start, previous.start + MIN_TOKEN_DURATION)
    }
    timelineStore.snapGuideTime = start === snapped.time ? snapped.snappedTo : null
    updates.push({ ...target, start, end: target.end })
    if (linked && previous?.start !== null && previous?.start !== undefined) {
      updates.push({ ...previous, end: start })
    }
  } else if (edit.kind === 'token-right') {
    const snapped = snapTime(
      targetEnd + rawDelta,
      candidates,
      SNAP_THRESHOLD_PIXELS / timelineStore.pixelsPerSecond
    )
    let end = clampTokenEnd(target.start, snapped.time, duration())
    if (linked && next?.end !== null && next?.end !== undefined) {
      end = Math.min(end, next.end - MIN_TOKEN_DURATION)
    }
    timelineStore.snapGuideTime = end === snapped.time ? snapped.snappedTo : null
    updates.push({ ...target, end })
    if (linked && next?.start !== null && next?.start !== undefined) {
      updates.push({ ...next, start: end })
    }
  } else {
    let moved = clampTokenMove(
      target.start,
      target.end,
      rawDelta,
      duration() || Number.POSITIVE_INFINITY
    )
    const boundaries = target.end === null ? [target.start] : [target.start, target.end]
    const snapped = bestSnapDelta(boundaries, moved.start - target.start, candidates)
    let delta = snapped.delta
    if (linked && previous?.start !== null && previous?.start !== undefined) {
      delta = Math.max(delta, previous.start + MIN_TOKEN_DURATION - target.start)
    }
    if (linked && target.end !== null && next?.end !== null && next?.end !== undefined) {
      delta = Math.min(delta, next.end - MIN_TOKEN_DURATION - target.end)
    }
    moved = clampTokenMove(target.start, target.end, delta, duration() || Number.POSITIVE_INFINITY)
    timelineStore.snapGuideTime =
      moved.start - target.start === snapped.delta ? snapped.guide : null
    updates.push({ ...target, start: moved.start, end: moved.end })
    if (linked && previous?.start !== null && previous?.start !== undefined) {
      updates.push({ ...previous, end: moved.start })
    }
    if (linked && moved.end !== null && next?.start !== null && next?.start !== undefined) {
      updates.push({ ...next, start: moved.end })
    }
  }

  projectStore.applyTokenTimingUpdates(updates, false)
}

function handlePointerDown(event: PointerEvent): void {
  if (!canvas.value || !playerStore.source) return
  const x = pointerX(event)
  if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
    timelineStore.followPlayback = false
    interaction = { kind: 'pan', lastX: x }
  } else if (event.button === 0) {
    const hit = renderer?.hitTest(x, event.clientY - canvas.value.getBoundingClientRect().top)
    if (hit?.lineIndex !== undefined && hit.tokenIndex !== undefined) {
      projectStore.selectToken(hit.lineIndex, hit.tokenIndex)
      timelineStore.requestLyricsFocus(hit.lineIndex)
      timelineStore.selectedTokenId = hit.id
      const kind =
        hit.type === 'token-left'
          ? 'token-left'
          : hit.type === 'token-right'
            ? 'token-right'
            : timelineStore.editMode === 'line'
              ? 'line-move'
              : 'token-move'
      interaction = {
        kind,
        lineIndex: hit.lineIndex,
        tokenIndex: hit.tokenIndex,
        originTime: xToTime(x, timelineStore.viewport),
        snapshots: timingSnapshots(),
        projectBefore: projectStore.snapshot()
      }
    } else {
      projectStore.clearTokenSelection()
      timelineStore.selectedTokenId = null
      interaction = { kind: 'seek' }
      seekAt(x)
    }
  } else {
    return
  }
  canvas.value.setPointerCapture(event.pointerId)
  event.preventDefault()
}

function handlePointerMove(event: PointerEvent): void {
  if (!interaction) return
  if (interaction.kind === 'seek') {
    seekAt(pointerX(event))
  } else if (interaction.kind === 'pan') {
    const x = pointerX(event)
    timelineStore.panByPixels(x - interaction.lastX, duration())
    interaction.lastX = x
  } else {
    previewEdit(event, interaction)
  }
}

function handlePointerUp(event: PointerEvent): void {
  if (canvas.value?.hasPointerCapture(event.pointerId))
    canvas.value.releasePointerCapture(event.pointerId)
  if (interaction && 'projectBefore' in interaction) {
    projectStore.recordChange('拖动时间轴', interaction.projectBefore)
  }
  interaction = null
  timelineStore.snapGuideTime = null
}

function clearTokenSelection(): void {
  projectStore.clearTokenSelection()
  timelineStore.selectedTokenId = null
}

function handleWheel(event: WheelEvent): void {
  if (!playerStore.source) return
  if (event.ctrlKey || event.metaKey) {
    timelineStore.zoomAt(pointerX(event), Math.exp(-event.deltaY * 0.002), duration())
  } else {
    timelineStore.followPlayback = false
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    timelineStore.panByPixels(-delta, duration())
  }
}

function zoom(scale: number): void {
  timelineStore.zoomAt(timelineStore.width / 2, scale, duration())
}

const zoomLevel = computed(() => {
  const range = Math.log(MAX_PIXELS_PER_SECOND / MIN_PIXELS_PER_SECOND)
  return (Math.log(timelineStore.pixelsPerSecond / MIN_PIXELS_PER_SECOND) / range) * 100
})

function setZoomLevel(event: Event): void {
  const level = Number((event.target as HTMLInputElement).value) / 100
  const next = MIN_PIXELS_PER_SECOND * (MAX_PIXELS_PER_SECOND / MIN_PIXELS_PER_SECOND) ** level
  timelineStore.zoomAt(timelineStore.width / 2, next / timelineStore.pixelsPerSecond, duration())
}

function toggleFollow(): void {
  timelineStore.followPlayback = !timelineStore.followPlayback
  if (timelineStore.followPlayback) timelineStore.followTime(playerStore.currentTime, duration())
}

function locateSelectedToken(): void {
  const start = projectStore.activeToken?.start
  if (start === null || start === undefined) return
  timelineStore.locateTime(start, duration())
  player.seek(start)
}

function toggleLoop(): void {
  if (timelineStore.loopEnabled) {
    timelineStore.disableLoop()
    return
  }
  if (!loopRange.value) return
  timelineStore.enableLoop(loopRange.value.start, loopRange.value.end)
  timelineStore.locateTime(loopRange.value.start, duration())
  player.seek(loopRange.value.start)
}

watch(loopRange, (range) => {
  if (range && timelineStore.loopEnabled) timelineStore.enableLoop(range.start, range.end)
})

watch(
  () => playerStore.currentTime,
  (time) => {
    if (playerStore.playing && timelineStore.followPlayback) {
      timelineStore.followTime(time, duration())
    }
  }
)

watch(
  () => playerStore.source,
  async (source) => {
    waveformAbort?.abort()
    if (!source) {
      timelineStore.clearWaveform()
      return
    }

    const controller = new AbortController()
    waveformAbort = controller
    timelineStore.beginWaveformLoad()
    try {
      const waveform = await decodeWaveform(source, controller.signal)
      if (!controller.signal.aborted) {
        timelineStore.setWaveform(waveform)
        timelineStore.fit(waveform.duration)
      }
    } catch {
      if (!controller.signal.aborted) timelineStore.failWaveform()
    }
  },
  { immediate: true }
)

watchEffect(() => {
  const element = canvas.value
  if (!element) return
  const context = element.getContext('2d')
  if (!context) return

  const ratio = window.devicePixelRatio || 1
  const width = timelineStore.width
  if (
    element.width !== Math.round(width * ratio) ||
    element.height !== Math.round(canvasHeight.value * ratio)
  ) {
    element.width = Math.round(width * ratio)
    element.height = Math.round(canvasHeight.value * ratio)
    element.style.width = `${width}px`
    element.style.height = `${canvasHeight.value}px`
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  renderer ??= new TimelineRenderer(context)
  renderer.draw({
    viewport: timelineStore.viewport,
    height: canvasHeight.value,
    duration: duration(),
    currentTime: playerStore.currentTime,
    waveform: timelineStore.waveform,
    lines: projectStore.project.lines,
    activeTokenId: projectStore.activeToken?.id ?? null,
    snapGuideTime: timelineStore.snapGuideTime,
    loopStart: timelineStore.loopEnabled ? timelineStore.loopStart : null,
    loopEnd: timelineStore.loopEnabled ? timelineStore.loopEnd : null
  })
})

onMounted(() => {
  if (!container.value) return
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) {
      timelineStore.setWidth(entry.contentRect.width, duration())
      canvasHeight.value = Math.max(120, entry.contentRect.height)
    }
  })
  resizeObserver.observe(container.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  waveformAbort?.abort()
})
</script>

<template>
  <section class="timeline" :aria-label="t('时间轴')">
    <PlayerBar />
    <header class="timeline-toolbar">
      <div>
        <strong>Timeline</strong>
        <span v-if="timelineStore.waveformLoading">{{ t('正在生成波形…') }}</span>
        <span v-else-if="timelineStore.waveformError" class="timeline-error">
          {{ timelineStore.waveformError }}
        </span>
        <span v-else>{{ Math.round(timelineStore.pixelsPerSecond) }} px/s</span>
      </div>
      <div class="timeline-actions">
        <button
          type="button"
          :class="{ active: timelineStore.editMode === 'token' }"
          @click="timelineStore.editMode = 'token'"
        >
          Token
        </button>
        <button
          type="button"
          :class="{ active: timelineStore.editMode === 'line' }"
          @click="timelineStore.editMode = 'line'"
        >
          {{ t('整句移动') }}
        </button>
        <button
          type="button"
          :class="{
            active: timelineStore.adjacentLocked && timelineStore.editMode === 'token'
          }"
          :aria-pressed="timelineStore.adjacentLocked"
          :disabled="timelineStore.editMode === 'line'"
          :title="
            timelineStore.adjacentLocked
              ? t('拖动或快捷键微调时联动相邻 Token；拖动时按 Alt 临时解锁')
              : t('拖动和快捷键微调都只调整当前 Token')
          "
          @click="timelineStore.adjacentLocked = !timelineStore.adjacentLocked"
        >
          {{ timelineStore.adjacentLocked ? `🔒 ${t('相邻锁定')}` : `🔓 ${t('独立调整')}` }}
        </button>
        <button
          type="button"
          :class="{ active: timelineStore.followPlayback }"
          :aria-pressed="timelineStore.followPlayback"
          :title="t('播放游标到达右边界时自动切换到下一段')"
          @click="toggleFollow"
        >
          {{ timelineStore.followPlayback ? `◉ ${t('跟随播放')}` : `○ ${t('跟随关闭')}` }}
        </button>
        <button
          type="button"
          :disabled="projectStore.activeToken?.start === null || !projectStore.activeToken"
          :title="t('将选中的 Token 居中并移动播放头')"
          @click="locateSelectedToken"
        >
          ◎ {{ t('定位') }}
        </button>
        <button
          type="button"
          :disabled="!timelineStore.loopEnabled && !loopRange"
          :class="{ active: timelineStore.loopEnabled }"
          :aria-pressed="timelineStore.loopEnabled"
          :title="
            timelineStore.loopEnabled
              ? t('点击退出 Loop；取消选择不会停止循环')
              : loopRange
                ? t('循环播放当前 Token')
                : t('当前 Token 需要有效的起止时间')
          "
          @click="toggleLoop"
        >
          {{ timelineStore.loopEnabled ? `↻ ${t('Loop 开')}` : '↻ Loop' }}
        </button>
        <button type="button" :aria-label="t('缩小时间轴')" @click="zoom(0.8)">−</button>
        <button type="button" @click="timelineStore.fit(duration())">{{ t('适合窗口') }}</button>
        <button type="button" :aria-label="t('放大时间轴')" @click="zoom(1.25)">＋</button>
      </div>
    </header>

    <div ref="container" class="timeline-canvas-wrap">
      <canvas
        ref="canvas"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerUp"
        @wheel.prevent="handleWheel"
        @contextmenu.prevent="clearTokenSelection"
      />
      <div v-if="!playerStore.source" class="timeline-empty">{{ t('导入歌曲后显示波形与时间轴') }}</div>
    </div>
    <footer class="timeline-footer">
      <p class="timeline-help">
        {{
          timelineStore.followPlayback
            ? t('跟随播放已开启 · 到达可视区末端时自动切换下一段')
            : timelineStore.editMode === 'line'
              ? t('整句移动模式 · Shift + 拖动平移时间轴')
              : timelineStore.adjacentLocked
                ? t('相邻已锁定：拖动和快捷键会联动前后 Token · Alt 临时解锁拖动')
                : t('独立调整：拖动和快捷键只修改当前 Token · Shift + 拖动平移时间轴')
        }}
      </p>
      <label class="timeline-zoom-control" :title="t('拖动调节时间线缩放尺度')">
        <span aria-hidden="true">−</span>
        <input
          type="range"
          min="0"
          max="100"
          step="0.5"
          :value="zoomLevel"
          :aria-label="t('时间线缩放尺度')"
          @input="setZoomLevel"
        />
        <span aria-hidden="true">＋</span>
        <output>{{ Math.round(timelineStore.pixelsPerSecond) }} px/s</output>
      </label>
    </footer>
  </section>
</template>
