<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from '@renderer/i18n'

import { getAudioPlayer } from '@renderer/services/audio-player'
import { useProjectStore } from '@renderer/stores/project'
import { usePlayerStore } from '@renderer/stores/player'
import { useTimelineStore } from '@renderer/stores/timeline'
import { formatTime } from '@renderer/utils/time'
import { getLineStart, getLineTimingStatus, getPlaybackLineIndex } from '@renderer/utils/lyrics'
import type { LyricLine, LyricToken } from '@shared/models/project'

const projectStore = useProjectStore()
const playerStore = usePlayerStore()
const timelineStore = useTimelineStore()
const player = getAudioPlayer()
const { t } = useI18n()
const lineItems = ref<HTMLElement[]>([])
const manuallyFocusedLineIndex = ref<number | null>(null)
const playbackLineIndex = computed(() =>
  getPlaybackLineIndex(projectStore.project.lines, playerStore.currentTime)
)
const expandedLineIndex = computed(() =>
  manuallyFocusedLineIndex.value !== null
    ? manuallyFocusedLineIndex.value
    : timelineStore.followLyrics && playerStore.playing && playbackLineIndex.value >= 0
    ? playbackLineIndex.value
    : projectStore.currentLineIndex
)
const emit = defineEmits<{ requestImport: [] }>()

const statusSymbol = {
  pending: '○',
  partial: '◐',
  complete: '●'
} as const

function seekTo(time: number | null): void {
  if (time !== null) player.seek(time)
}

function selectLine(line: LyricLine, lineIndex: number): void {
  projectStore.selectToken(lineIndex, 0)
  const start = getLineStart(line)
  seekTo(start)
  if (start !== null) timelineStore.locateTime(start, playerStore.duration)
}

function selectToken(token: LyricToken, lineIndex: number, tokenIndex: number): void {
  projectStore.selectToken(lineIndex, tokenIndex)
  seekTo(token.start)
  if (token.start !== null) {
    timelineStore.locateTime(token.start, playerStore.duration)
  }
}

function smartTime(): void {
  if (playerStore.duration > 0) projectStore.applyAutomaticTiming(playerStore.duration)
}

function copyTiming(): void {
  projectStore.copyActiveLineTiming()
}

function pasteTiming(): void {
  projectStore.pasteLineTimingAt(playerStore.currentTime)
}

watch(playbackLineIndex, async (lineIndex) => {
  manuallyFocusedLineIndex.value = null
  if (!timelineStore.followLyrics || !playerStore.playing || lineIndex < 0) return
  await nextTick()
  lineItems.value[lineIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})

watch(
  () => timelineStore.lyricsFocusNonce,
  async () => {
    const lineIndex = timelineStore.lyricsFocusLineIndex
    if (lineIndex === null) return
    manuallyFocusedLineIndex.value = lineIndex
    await nextTick()
    lineItems.value[lineIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
)
</script>

<template>
  <aside class="panel lyrics-panel">
    <header class="panel-header">
      <p class="panel-label">{{ t('歌词') }}</p>
      <div class="panel-actions">
        <button
          v-if="projectStore.project.lines.length"
          class="text-button"
          type="button"
          :class="{ active: timelineStore.followLyrics }"
          :aria-pressed="timelineStore.followLyrics"
          :title="t('播放时自动滚动并高亮当前歌词')"
          @click="timelineStore.followLyrics = !timelineStore.followLyrics"
        >
          {{ timelineStore.followLyrics ? `◉ ${t('跟随')}` : `○ ${t('跟随')}` }}
        </button>
        <button
          v-if="projectStore.project.lines.length"
          class="text-button"
          type="button"
          :disabled="!projectStore.canCopyLineTiming"
          :title="t('复制当前句的逐词时间结构')"
          @click="copyTiming"
        >
          {{ t('复制') }}
        </button>
        <button
          v-if="projectStore.project.lines.length"
          class="text-button"
          type="button"
          :disabled="!projectStore.canPasteLineTiming"
          :title="t('从当前播放头位置粘贴到相同歌词')"
          @click="pasteTiming"
        >
          {{ t('粘贴') }}
        </button>
        <button
          v-if="projectStore.project.lines.length"
          class="text-button"
          type="button"
          :disabled="!playerStore.duration"
          :title="playerStore.duration ? t('根据音频时长和已有时间标签生成逐词时间') : t('请先导入音频')"
          @click="smartTime"
        >
          {{ t('智能打轴') }}
        </button>
        <button class="text-button" type="button" @click="emit('requestImport')">
          {{ projectStore.project.lines.length ? t('编辑') : t('导入') }}
        </button>
      </div>
    </header>

    <div v-if="projectStore.project.lines.length === 0" class="panel-placeholder">
      <div>
        <p>{{ t('还没有歌词') }}</p>
        <button class="secondary-button" type="button" @click="emit('requestImport')">
          {{ t('粘贴歌词') }}
        </button>
      </div>
    </div>

    <ol v-else class="lyrics-list">
      <li
        v-for="(line, lineIndex) in projectStore.project.lines"
        :key="line.id"
        ref="lineItems"
        :class="{
          active: lineIndex === projectStore.currentLineIndex,
          playing: timelineStore.followLyrics && lineIndex === playbackLineIndex
        }"
      >
        <button
          type="button"
          :title="
            getLineStart(line) === null
              ? t('该行尚未打轴')
              : t('定位到 {time}', { time: formatTime(getLineStart(line)!) })
          "
          @click="selectLine(line, lineIndex)"
        >
          <span class="line-status" :data-status="getLineTimingStatus(line)">
            {{ statusSymbol[getLineTimingStatus(line)] }}
          </span>
          <time class="line-time">
            {{ getLineStart(line) === null ? '--:--.---' : formatTime(getLineStart(line)!) }}
          </time>
          <span class="line-text">{{ line.text }}</span>
        </button>

        <div v-if="lineIndex === expandedLineIndex" class="token-list">
          <button
            v-for="(token, tokenIndex) in line.tokens"
            :key="token.id"
            type="button"
            :class="{
              active:
                projectStore.activeToken !== null && tokenIndex === projectStore.currentTokenIndex,
              timed: token.start !== null
            }"
            :title="
              token.start === null ? t('该 Token 尚未打轴') : t('定位到 {time}', { time: formatTime(token.start) })
            "
            @click="selectToken(token, lineIndex, tokenIndex)"
          >
            <span>{{ token.text }}</span>
            <time>{{ token.start === null ? '—' : formatTime(token.start) }}</time>
          </button>
        </div>
      </li>
    </ol>
  </aside>
</template>
