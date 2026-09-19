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
const lineItems = new Map<string, HTMLElement>()
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
const lineLayoutKey = computed(() =>
  projectStore.project.lines
    .map((line) => `${line.id}:${line.tokens.map((token) => token.id).join(',')}`)
    .join('|')
)
const emit = defineEmits<{ requestImport: []; requestPreprocess: [] }>()

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
  window.dispatchEvent(new CustomEvent('automatic-timing'))
}

function copyTiming(): void {
  projectStore.copyActiveLineTiming()
}

function pasteTiming(): void {
  projectStore.pasteLineTimingAt(playerStore.currentTime)
}

function setLineItem(lineId: string, element: unknown): void {
  if (element instanceof HTMLElement) lineItems.set(lineId, element)
  else lineItems.delete(lineId)
}

async function scrollToLine(lineIndex: number, block: 'center' | 'nearest'): Promise<void> {
  const lineId = projectStore.project.lines[lineIndex]?.id
  if (!lineId) return
  await nextTick()
  lineItems.get(lineId)?.scrollIntoView({ behavior: 'smooth', block })
}

watch(
  [playbackLineIndex, lineLayoutKey, () => timelineStore.followLyrics, () => playerStore.playing],
  async ([lineIndex]) => {
    manuallyFocusedLineIndex.value = null
    if (!timelineStore.followLyrics || !playerStore.playing || Number(lineIndex) < 0) return
    await scrollToLine(Number(lineIndex), 'nearest')
  }
)

watch(
  () => timelineStore.lyricsFocusNonce,
  async () => {
    const lineIndex = timelineStore.lyricsFocusLineIndex
    if (lineIndex === null) return
    manuallyFocusedLineIndex.value = lineIndex
    await scrollToLine(lineIndex, 'center')
  }
)
</script>

<template>
  <aside class="panel lyrics-panel">
    <header class="panel-header">
      <div class="panel-actions">
        <button
          v-if="projectStore.project.lines.length"
          class="text-button"
          type="button"
          :class="{ active: timelineStore.followLyrics }"
          :aria-pressed="timelineStore.followLyrics"
          :title="t('scroll_and_highlight_the_current_lyric_during_playback')"
          @click="timelineStore.followLyrics = !timelineStore.followLyrics"
        >
          {{ timelineStore.followLyrics ? `◉ ${t('follow')}` : `○ ${t('follow')}` }}
        </button>
        <button
          v-if="projectStore.project.lines.length"
          class="text-button"
          type="button"
          :disabled="!projectStore.canCopyLineTiming"
          :title="t('copy_word_timing_from_the_current_line')"
          @click="copyTiming"
        >
          {{ t('copy') }}
        </button>
        <button
          v-if="projectStore.project.lines.length"
          class="text-button"
          type="button"
          :disabled="!projectStore.canPasteLineTiming"
          :title="t('paste_timing_at_the_playhead_into_matching_lyrics')"
          @click="pasteTiming"
        >
          {{ t('paste') }}
        </button>
        <button
          v-if="projectStore.project.lines.length"
          class="text-button"
          type="button"
          :title="t('generate_word_timing_from_audio_duration_and_existing_timestamps')"
          @click="smartTime"
        >
          {{ t('auto_timing') }}
        </button>
        <button
          v-if="projectStore.project.lines.length"
          class="text-button"
          type="button"
          :title="t('clean_lyrics_with_rules_or_regular_expressions')"
          @click="emit('requestPreprocess')"
        >
          {{ t('preprocess') }}
        </button>
        <button class="text-button" type="button" @click="emit('requestImport')">
          {{ projectStore.project.lines.length ? t('edit') : t('import') }}
        </button>
      </div>
    </header>

    <div v-if="projectStore.project.lines.length === 0" class="panel-placeholder">
      <div>
        <p>{{ t('no_lyrics_yet') }}</p>
        <button class="secondary-button" type="button" @click="emit('requestImport')">
          {{ t('paste_lyrics') }}
        </button>
      </div>
    </div>

    <ol v-else class="lyrics-list">
      <li
        v-for="(line, lineIndex) in projectStore.project.lines"
        :key="line.id"
        :ref="(element) => setLineItem(line.id, element)"
        :class="{
          active: lineIndex === projectStore.currentLineIndex,
          playing: timelineStore.followLyrics && lineIndex === playbackLineIndex
        }"
      >
        <button
          type="button"
          :title="
            getLineStart(line) === null
              ? t('this_line_has_not_been_timed')
              : t('go_to_time', { time: formatTime(getLineStart(line)!) })
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
                projectStore.activeToken !== null &&
                lineIndex === projectStore.currentLineIndex &&
                tokenIndex === projectStore.currentTokenIndex,
              timed: token.start !== null
            }"
            :title="
              token.start === null
                ? t('this_token_has_not_been_timed')
                : t('go_to_time', { time: formatTime(token.start) })
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
