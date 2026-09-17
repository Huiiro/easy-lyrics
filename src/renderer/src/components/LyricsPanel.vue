<script setup lang="ts">
import { ref } from 'vue'

import LyricsImportDialog from '@renderer/components/LyricsImportDialog.vue'
import { createLyricLines } from '@renderer/services/tokenizer'
import { useProjectStore } from '@renderer/stores/project'
import { getLineTimingStatus } from '@renderer/utils/lyrics'
import type { TokenizerMode } from '@shared/models/project'

const projectStore = useProjectStore()
const importOpen = ref(false)

const statusSymbol = {
  pending: '○',
  partial: '◐',
  complete: '●'
} as const

function importLyrics(payload: { text: string; mode: TokenizerMode }): void {
  projectStore.importLyrics(createLyricLines(payload.text, payload.mode), payload.mode)
}
</script>

<template>
  <aside class="panel lyrics-panel">
    <header class="panel-header">
      <p class="panel-label">歌词</p>
      <button class="text-button" type="button" @click="importOpen = true">
        {{ projectStore.project.lines.length ? '重新导入' : '导入' }}
      </button>
    </header>

    <div v-if="projectStore.project.lines.length === 0" class="panel-placeholder">
      <div>
        <p>还没有歌词</p>
        <button class="secondary-button" type="button" @click="importOpen = true">粘贴歌词</button>
      </div>
    </div>

    <ol v-else class="lyrics-list">
      <li
        v-for="(line, lineIndex) in projectStore.project.lines"
        :key="line.id"
        :class="{ active: lineIndex === projectStore.currentLineIndex }"
      >
        <button type="button" @click="projectStore.selectToken(lineIndex, 0)">
          <span class="line-status" :data-status="getLineTimingStatus(line)">
            {{ statusSymbol[getLineTimingStatus(line)] }}
          </span>
          <span class="line-text">{{ line.text }}</span>
        </button>

        <div v-if="lineIndex === projectStore.currentLineIndex" class="token-list">
          <button
            v-for="(token, tokenIndex) in line.tokens"
            :key="token.id"
            type="button"
            :class="{
              active: tokenIndex === projectStore.currentTokenIndex,
              timed: token.start !== null
            }"
            @click="projectStore.selectToken(lineIndex, tokenIndex)"
          >
            {{ token.text }}
          </button>
        </div>
      </li>
    </ol>

    <LyricsImportDialog :open="importOpen" @close="importOpen = false" @import="importLyrics" />
  </aside>
</template>
