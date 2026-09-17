<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import LyricsPanel from '@renderer/components/LyricsPanel.vue'
import PlayerBar from '@renderer/components/PlayerBar.vue'
import { useProjectStore } from '@renderer/stores/project'

const ipcStatus = ref('正在检查…')
const projectStore = useProjectStore()
const previousLine = computed(
  () => projectStore.project.lines[projectStore.currentLineIndex - 1] ?? null
)
const nextLine = computed(
  () => projectStore.project.lines[projectStore.currentLineIndex + 1] ?? null
)

onMounted(async () => {
  try {
    ipcStatus.value =
      (await window.desktopApi.ping()) === 'pong' ? 'Main / Preload / Renderer 正常' : '响应异常'
  } catch {
    ipcStatus.value = 'IPC 不可用'
  }
})
</script>

<template>
  <main class="shell">
    <header class="titlebar">
      <span class="brand-mark" aria-hidden="true" />
      <strong>Lyric Timeline</strong>
      <span class="phase">Phase 2A · Lyrics</span>
    </header>

    <section class="workspace">
      <div class="workspace-grid">
        <LyricsPanel />

        <section class="stage">
          <template v-if="projectStore.activeLine">
            <p class="context-line previous">{{ previousLine?.text ?? ' ' }}</p>
            <p class="eyebrow">当前句 · {{ projectStore.currentLineIndex + 1 }}</p>
            <h1 class="active-line">{{ projectStore.activeLine.text }}</h1>
            <div class="active-tokens">
              <button
                v-for="(token, tokenIndex) in projectStore.activeLine.tokens"
                :key="token.id"
                type="button"
                :class="{ active: tokenIndex === projectStore.currentTokenIndex }"
                @click="projectStore.selectToken(projectStore.currentLineIndex, tokenIndex)"
              >
                {{ token.text }}
              </button>
            </div>
            <p class="context-line next">{{ nextLine?.text ?? '已经是最后一句' }}</p>
          </template>

          <template v-else>
            <p class="eyebrow">逐字歌词打轴工具</p>
            <h1>现在，写下歌词。</h1>
            <p class="lede">从左侧导入歌词，中文逐字、英文逐词，准备进入连续打轴。</p>
          </template>

          <div v-if="!projectStore.activeLine" class="timeline-placeholder">
            <span
              v-for="index in 36"
              :key="index"
              :style="{ height: `${18 + ((index * 17) % 54)}%` }"
            />
          </div>
        </section>

        <aside class="panel inspector-panel">
          <p class="panel-label">工程</p>
          <dl>
            <div>
              <dt>状态</dt>
              <dd>{{ projectStore.project.lines.length ? '歌词已导入' : '等待歌词' }}</dd>
            </div>
            <div>
              <dt>拆分方式</dt>
              <dd>{{ projectStore.project.settings.tokenizer }}</dd>
            </div>
            <div>
              <dt>Token</dt>
              <dd>{{ projectStore.activeToken?.text ?? '—' }}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>

    <PlayerBar />

    <footer class="statusbar">
      <span class="status-dot" />
      {{ ipcStatus }}
    </footer>
  </main>
</template>
