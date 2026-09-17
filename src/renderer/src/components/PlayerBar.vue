<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'

import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import { AudioPlayer } from '@renderer/services/audio-player'
import { formatTime } from '@renderer/utils/time'

const playerStore = usePlayerStore()
const projectStore = useProjectStore()
const player = new AudioPlayer()
let unsubscribe: (() => void) | null = null

const progressMax = computed(() => Math.max(playerStore.duration, 0.001))

onMounted(() => {
  unsubscribe = player.subscribe((snapshot) => {
    playerStore.currentTime = snapshot.currentTime
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
    playerStore.fail('无法打开文件选择器，请重启应用后重试')
  }
}

async function togglePlayback(): Promise<void> {
  if (!playerStore.source) {
    await chooseAudio()
    return
  }

  try {
    await player.toggle()
  } catch {
    playerStore.fail('无法开始播放，请重新选择音频')
  }
}

function seek(event: Event): void {
  player.seek(Number((event.target as HTMLInputElement).value))
}

function changeVolume(event: Event): void {
  player.setVolume(Number((event.target as HTMLInputElement).value))
}

function changeRate(event: Event): void {
  player.setPlaybackRate(Number((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <section class="player-bar" aria-label="音频播放器">
    <button
      class="transport-button"
      type="button"
      :aria-label="playerStore.playing ? '暂停' : '播放'"
      @click="togglePlayback"
    >
      {{ playerStore.playing ? 'Ⅱ' : '▶' }}
    </button>

    <button class="file-button" type="button" @click="chooseAudio">
      <span class="file-label">{{ playerStore.fileName ?? '选择音频' }}</span>
      <span class="file-hint">{{ playerStore.fileName ? '更换' : 'MP3 / WAV / FLAC' }}</span>
    </button>

    <span class="timecode">{{ formatTime(playerStore.currentTime) }}</span>
    <input
      class="progress"
      type="range"
      min="0"
      :max="progressMax"
      step="0.001"
      :value="playerStore.currentTime"
      :disabled="!playerStore.source"
      aria-label="播放进度"
      @input="seek"
    />
    <span class="timecode duration">{{ formatTime(playerStore.duration) }}</span>

    <label class="volume-control">
      <span aria-hidden="true">◖</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="playerStore.volume"
        aria-label="音量"
        @input="changeVolume"
      />
    </label>

    <select
      class="rate-select"
      :value="playerStore.playbackRate"
      aria-label="播放速度"
      @change="changeRate"
    >
      <option :value="0.5">0.5×</option>
      <option :value="0.75">0.75×</option>
      <option :value="1">1×</option>
      <option :value="1.25">1.25×</option>
      <option :value="1.5">1.5×</option>
      <option :value="2">2×</option>
    </select>

    <p v-if="playerStore.error" class="player-error" role="alert">{{ playerStore.error }}</p>
  </section>
</template>
