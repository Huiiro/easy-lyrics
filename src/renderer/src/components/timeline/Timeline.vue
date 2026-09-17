<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'

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

const HEIGHT = 190
const canvas = ref<HTMLCanvasElement | null>(null)
const container = ref<HTMLElement | null>(null)
const editMode = ref<'token' | 'line'>('token')

type Interaction =
  | { kind: 'seek' }
  | { kind: 'pan'; lastX: number }
  | {
      kind: 'token-move' | 'token-left' | 'token-right' | 'line-move'
      lineIndex: number
      tokenIndex: number
      originTime: number
      snapshots: TokenTimingSnapshot[]
    }

let interaction: Interaction | null = null

const player = getAudioPlayer()
const playerStore = usePlayerStore()
const projectStore = useProjectStore()
const timelineStore = useTimelineStore()

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
  const linked = !event.altKey
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

  projectStore.applyTokenTimingUpdates(updates)
}

function handlePointerDown(event: PointerEvent): void {
  if (!canvas.value || !playerStore.source) return
  const x = pointerX(event)
  if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
    interaction = { kind: 'pan', lastX: x }
  } else if (event.button === 0) {
    const hit = renderer?.hitTest(x, event.clientY - canvas.value.getBoundingClientRect().top)
    if (hit?.lineIndex !== undefined && hit.tokenIndex !== undefined) {
      projectStore.selectToken(hit.lineIndex, hit.tokenIndex)
      timelineStore.selectedTokenId = hit.id
      const kind =
        hit.type === 'token-left'
          ? 'token-left'
          : hit.type === 'token-right'
            ? 'token-right'
            : editMode.value === 'line'
              ? 'line-move'
              : 'token-move'
      interaction = {
        kind,
        lineIndex: hit.lineIndex,
        tokenIndex: hit.tokenIndex,
        originTime: xToTime(x, timelineStore.viewport),
        snapshots: timingSnapshots()
      }
    } else {
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
  interaction = null
  timelineStore.snapGuideTime = null
}

function handleWheel(event: WheelEvent): void {
  if (!playerStore.source) return
  if (event.ctrlKey || event.metaKey) {
    timelineStore.zoomAt(pointerX(event), Math.exp(-event.deltaY * 0.002), duration())
  } else {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    timelineStore.panByPixels(-delta, duration())
  }
}

function zoom(scale: number): void {
  timelineStore.zoomAt(timelineStore.width / 2, scale, duration())
}

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
    element.height !== Math.round(HEIGHT * ratio)
  ) {
    element.width = Math.round(width * ratio)
    element.height = Math.round(HEIGHT * ratio)
    element.style.width = `${width}px`
    element.style.height = `${HEIGHT}px`
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  renderer ??= new TimelineRenderer(context)
  renderer.draw({
    viewport: timelineStore.viewport,
    height: HEIGHT,
    duration: duration(),
    currentTime: playerStore.currentTime,
    waveform: timelineStore.waveform,
    lines: projectStore.project.lines,
    activeTokenId: projectStore.activeToken?.id ?? null,
    snapGuideTime: timelineStore.snapGuideTime
  })
})

onMounted(() => {
  if (!container.value) return
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) timelineStore.setWidth(entry.contentRect.width, duration())
  })
  resizeObserver.observe(container.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  waveformAbort?.abort()
})
</script>

<template>
  <section class="timeline" aria-label="时间轴">
    <header class="timeline-toolbar">
      <div>
        <strong>Timeline</strong>
        <span v-if="timelineStore.waveformLoading">正在生成波形…</span>
        <span v-else-if="timelineStore.waveformError" class="timeline-error">
          {{ timelineStore.waveformError }}
        </span>
        <span v-else>{{ Math.round(timelineStore.pixelsPerSecond) }} px/s</span>
      </div>
      <div class="timeline-actions">
        <button type="button" :class="{ active: editMode === 'token' }" @click="editMode = 'token'">
          Token
        </button>
        <button type="button" :class="{ active: editMode === 'line' }" @click="editMode = 'line'">
          整句移动
        </button>
        <button type="button" aria-label="缩小时间轴" @click="zoom(0.8)">−</button>
        <button type="button" @click="timelineStore.fit(duration())">适合窗口</button>
        <button type="button" aria-label="放大时间轴" @click="zoom(1.25)">＋</button>
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
        @contextmenu.prevent
      />
      <div v-if="!playerStore.source" class="timeline-empty">导入歌曲后显示波形与时间轴</div>
    </div>
    <p class="timeline-help">拖动 Token 或边缘编辑 · Alt 临时解除相邻联动 · Shift + 拖动平移</p>
  </section>
</template>
