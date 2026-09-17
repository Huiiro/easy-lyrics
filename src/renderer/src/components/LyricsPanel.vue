<script setup lang="ts">
import { getAudioPlayer } from '@renderer/services/audio-player'
import { useProjectStore } from '@renderer/stores/project'
import { formatTime } from '@renderer/utils/time'
import { getLineStart, getLineTimingStatus } from '@renderer/utils/lyrics'
import type { LyricLine, LyricToken } from '@shared/models/project'

const projectStore = useProjectStore()
const player = getAudioPlayer()
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
  seekTo(getLineStart(line))
}

function selectToken(token: LyricToken, lineIndex: number, tokenIndex: number): void {
  projectStore.selectToken(lineIndex, tokenIndex)
  seekTo(token.start)
}
</script>

<template>
  <aside class="panel lyrics-panel">
    <header class="panel-header">
      <p class="panel-label">歌词</p>
      <button class="text-button" type="button" @click="emit('requestImport')">
        {{ projectStore.project.lines.length ? '重新导入' : '导入' }}
      </button>
    </header>

    <div v-if="projectStore.project.lines.length === 0" class="panel-placeholder">
      <div>
        <p>还没有歌词</p>
        <button class="secondary-button" type="button" @click="emit('requestImport')">
          粘贴歌词
        </button>
      </div>
    </div>

    <ol v-else class="lyrics-list">
      <li
        v-for="(line, lineIndex) in projectStore.project.lines"
        :key="line.id"
        :class="{ active: lineIndex === projectStore.currentLineIndex }"
      >
        <button
          type="button"
          :title="
            getLineStart(line) === null
              ? '该行尚未打轴'
              : `定位到 ${formatTime(getLineStart(line)!)}`
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

        <div v-if="lineIndex === projectStore.currentLineIndex" class="token-list">
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
              token.start === null ? '该 Token 尚未打轴' : `定位到 ${formatTime(token.start)}`
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
