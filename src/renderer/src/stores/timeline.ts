import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { WaveformData } from '@renderer/services/waveform'
import {
  clampStartTime,
  followViewportToTime,
  panViewportByPixels,
  zoomViewportAt,
  type TimelineViewport
} from '@renderer/timeline/viewport'

export const useTimelineStore = defineStore('timeline', () => {
  const editMode = ref<'token' | 'line'>('token')
  const adjacentLocked = ref(true)
  const followPlayback = ref(true)
  const startTime = ref(0)
  const pixelsPerSecond = ref(100)
  const width = ref(1)
  const selectedTokenId = ref<string | null>(null)
  const snapGuideTime = ref<number | null>(null)
  const waveform = shallowRef<WaveformData | null>(null)
  const waveformLoading = ref(false)
  const waveformError = ref<string | null>(null)
  const viewport = computed<TimelineViewport>(() => ({
    startTime: startTime.value,
    pixelsPerSecond: pixelsPerSecond.value,
    width: width.value
  }))

  function applyViewport(next: TimelineViewport): void {
    startTime.value = next.startTime
    pixelsPerSecond.value = next.pixelsPerSecond
    width.value = next.width
  }

  function setWidth(nextWidth: number, duration: number): void {
    width.value = Math.max(1, nextWidth)
    startTime.value = clampStartTime(startTime.value, viewport.value, duration)
  }

  function zoomAt(x: number, scale: number, duration: number): void {
    applyViewport(zoomViewportAt(viewport.value, x, scale, duration))
  }

  function panByPixels(deltaPixels: number, duration: number): void {
    applyViewport(panViewportByPixels(viewport.value, deltaPixels, duration))
  }

  function followTime(time: number, duration: number): void {
    applyViewport(followViewportToTime(viewport.value, time, duration))
  }

  function fit(duration: number): void {
    if (duration <= 0) return
    startTime.value = 0
    pixelsPerSecond.value = Math.min(Math.max(width.value / duration, 20), 2000)
  }

  function beginWaveformLoad(): void {
    waveform.value = null
    waveformLoading.value = true
    waveformError.value = null
  }

  function setWaveform(data: WaveformData): void {
    waveform.value = data
    waveformLoading.value = false
    waveformError.value = null
  }

  function failWaveform(): void {
    waveform.value = null
    waveformLoading.value = false
    waveformError.value = '无法生成波形'
  }

  function clearWaveform(): void {
    waveform.value = null
    waveformLoading.value = false
    waveformError.value = null
    startTime.value = 0
  }

  return {
    editMode,
    adjacentLocked,
    followPlayback,
    startTime,
    pixelsPerSecond,
    width,
    selectedTokenId,
    snapGuideTime,
    waveform,
    waveformLoading,
    waveformError,
    viewport,
    setWidth,
    zoomAt,
    panByPixels,
    followTime,
    fit,
    beginWaveformLoad,
    setWaveform,
    failWaveform,
    clearWaveform
  }
})
