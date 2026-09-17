<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'

import { getAudioPlayer } from '@renderer/services/audio-player'
import { decodeWaveform } from '@renderer/services/waveform'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import { useTimelineStore } from '@renderer/stores/timeline'
import { TimelineRenderer } from '@renderer/timeline/TimelineRenderer'
import { xToTime } from '@renderer/timeline/viewport'

const HEIGHT = 190
const canvas = ref<HTMLCanvasElement | null>(null)
const container = ref<HTMLElement | null>(null)
const interaction = ref<'seek' | 'pan' | null>(null)
const lastPointerX = ref(0)

const player = getAudioPlayer()
const playerStore = usePlayerStore()
const projectStore = useProjectStore()
const timelineStore = useTimelineStore()

let resizeObserver: ResizeObserver | null = null
let waveformAbort: AbortController | null = null

function duration(): number {
  return playerStore.duration || timelineStore.waveform?.duration || 0
}

function pointerX(event: PointerEvent | WheelEvent): number {
  return event.clientX - (canvas.value?.getBoundingClientRect().left ?? 0)
}

function seekAt(x: number): void {
  player.seek(Math.min(Math.max(xToTime(x, timelineStore.viewport), 0), duration()))
}

function handlePointerDown(event: PointerEvent): void {
  if (!canvas.value || !playerStore.source) return
  const x = pointerX(event)
  if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
    interaction.value = 'pan'
    lastPointerX.value = x
  } else if (event.button === 0) {
    interaction.value = 'seek'
    seekAt(x)
  } else {
    return
  }
  canvas.value.setPointerCapture(event.pointerId)
  event.preventDefault()
}

function handlePointerMove(event: PointerEvent): void {
  if (interaction.value === 'seek') {
    seekAt(pointerX(event))
  } else if (interaction.value === 'pan') {
    const x = pointerX(event)
    timelineStore.panByPixels(x - lastPointerX.value, duration())
    lastPointerX.value = x
  }
}

function handlePointerUp(event: PointerEvent): void {
  if (canvas.value?.hasPointerCapture(event.pointerId))
    canvas.value.releasePointerCapture(event.pointerId)
  interaction.value = null
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

  new TimelineRenderer(context).draw({
    viewport: timelineStore.viewport,
    height: HEIGHT,
    duration: duration(),
    currentTime: playerStore.currentTime,
    waveform: timelineStore.waveform,
    lines: projectStore.project.lines,
    activeTokenId: projectStore.activeToken?.id ?? null
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
    <p class="timeline-help">点击/拖动定位 · Ctrl/⌘ + 滚轮缩放 · 中键或 Shift + 拖动平移</p>
  </section>
</template>
