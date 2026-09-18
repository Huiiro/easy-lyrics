<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { useI18n } from '@renderer/i18n'

import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import { useTimelineStore } from '@renderer/stores/timeline'
import { getAudioPlayer } from '@renderer/services/audio-player'
import { formatTime } from '@renderer/utils/time'

const playerStore = usePlayerStore()
const { t } = useI18n()
const projectStore = useProjectStore()
const timelineStore = useTimelineStore()
const player = getAudioPlayer()
let unsubscribe: (() => void) | null = null
const seeking = ref(false)
const seekPosition = ref(0)

const progressMax = computed(() => Math.max(playerStore.duration, 0.001))
const displayedTime = computed(() => (seeking.value ? seekPosition.value : playerStore.currentTime))

watchEffect(() => {
  player.setLoopRange(
    timelineStore.loopEnabled ? timelineStore.loopStart : null,
    timelineStore.loopEnabled ? timelineStore.loopEnd : null
  )
})

onMounted(() => {
  window.addEventListener('audio-select', chooseAudio)
  unsubscribe = player.subscribe((snapshot) => {
    playerStore.currentTime = snapshot.currentTime
    if (!seeking.value) seekPosition.value = snapshot.currentTime
    playerStore.duration = snapshot.duration
    playerStore.playing = snapshot.playing
    playerStore.volume = snapshot.volume
    playerStore.playbackRate = snapshot.playbackRate
    playerStore.loading = playerStore.source !== null && !snapshot.ready && !snapshot.error
    playerStore.error = snapshot.error

    if (snapshot.ready && snapshot.duration > 0) {
      projectStore.setAudioDuration(snapshot.duration)
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('audio-select', chooseAudio)
  unsubscribe?.()
  player.destroy()
})

async function chooseAudio(): Promise<void> {
  try {
    if (!window.desktopApi) throw new Error('Preload bridge is unavailable')
    const selection = await window.desktopApi.selectAudio()
    if (!selection) return

    projectStore.setAudio({ path: selection.path, name: selection.name, duration: null })
    playerStore.beginLoad(selection.url, selection.name)
    player.load(selection.url)
  } catch {
    playerStore.fail(t('无法打开文件选择器，请重启应用后重试'))
  }
}

function beginSeek(event: Event): void {
  seeking.value = true
  seekPosition.value = Number((event.target as HTMLInputElement).value)
}

function seek(event: Event): void {
  const time = Number((event.target as HTMLInputElement).value)
  seekPosition.value = time
  player.seek(time)
}

function endSeek(event: Event): void {
  seek(event)
  seeking.value = false
}

</script>

<template>
  <section class="timeline-player timeline-progress-only" :aria-label="t('播放进度')">
    <span class="timecode">{{ formatTime(displayedTime) }}</span>
    <input
      class="progress"
      type="range"
      min="0"
      :max="progressMax"
      step="0.001"
      :value="displayedTime"
      :disabled="!playerStore.source"
      :aria-label="t('播放进度')"
      @pointerdown="beginSeek"
      @input="seek"
      @change="endSeek"
      @pointerup="endSeek"
      @pointercancel="endSeek"
    />
    <span class="timecode duration">{{ formatTime(playerStore.duration) }}</span>
    <p v-if="playerStore.error" class="player-error" role="alert">{{ playerStore.error }}</p>
  </section>
</template>
