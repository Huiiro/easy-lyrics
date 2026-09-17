<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import LyricsImportDialog from '@renderer/components/LyricsImportDialog.vue'
import LyricsPanel from '@renderer/components/LyricsPanel.vue'
import SettingsDialog from '@renderer/components/SettingsDialog.vue'
import TokenInspector from '@renderer/components/TokenInspector.vue'
import Timeline from '@renderer/components/timeline/Timeline.vue'
import { useGlobalShortcuts } from '@renderer/composables/use-global-shortcuts'
import { getAudioPlayer } from '@renderer/services/audio-player'
import { createLyricLines } from '@renderer/services/tokenizer'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import { useTimelineStore } from '@renderer/stores/timeline'
import type { TokenizerMode } from '@shared/models/project'

const ipcStatus = ref('正在检查…')
const importOpen = ref(false)
const settingsOpen = ref(false)
const workspace = ref<HTMLElement | null>(null)
const leftWidth = ref(28)
const leftTopHeight = ref(62)
const rightTopHeight = ref(58)
const projectStore = useProjectStore()
const playerStore = usePlayerStore()
const timelineStore = useTimelineStore()
const player = getAudioPlayer()
const previousLine = computed(
  () => projectStore.project.lines[projectStore.currentLineIndex - 1] ?? null
)
const nextLine = computed(
  () => projectStore.project.lines[projectStore.currentLineIndex + 1] ?? null
)

useGlobalShortcuts()

type ResizeTarget = 'columns' | 'left-rows' | 'right-rows'
let resizing: ResizeTarget | null = null

const workspaceStyle = computed(() => ({
  '--left-width': `${leftWidth.value}%`,
  '--left-top-height': `${leftTopHeight.value}%`,
  '--right-top-height': `${rightTopHeight.value}%`
}))

function beginResize(target: ResizeTarget, event: PointerEvent): void {
  resizing = target
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  document.body.classList.add('is-resizing')
}

function resizeWorkspace(event: PointerEvent): void {
  if (!resizing || !workspace.value) return
  const bounds = workspace.value.getBoundingClientRect()
  if (resizing === 'columns') {
    leftWidth.value = Math.min(
      Math.max(((event.clientX - bounds.left) / bounds.width) * 100, 20),
      45
    )
    return
  }

  const column = (event.target as HTMLElement).closest<HTMLElement>('.workspace-column')
  if (!column) return
  const columnBounds = column.getBoundingClientRect()
  const value = ((event.clientY - columnBounds.top) / columnBounds.height) * 100
  if (resizing === 'left-rows') leftTopHeight.value = Math.min(Math.max(value, 28), 76)
  else rightTopHeight.value = Math.min(Math.max(value, 28), 76)
}

function endResize(event: PointerEvent): void {
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  resizing = null
  document.body.classList.remove('is-resizing')
}

function importLyrics(payload: { text: string; mode: TokenizerMode }): void {
  projectStore.importLyrics(createLyricLines(payload.text, payload.mode), payload.mode)
}

async function togglePlayback(): Promise<void> {
  if (!playerStore.source) return
  await player.toggle()
}

function fitTimeline(): void {
  timelineStore.fit(playerStore.duration || timelineStore.waveform?.duration || 0)
}

onUnmounted(() => document.body.classList.remove('is-resizing'))

onMounted(async () => {
  try {
    const bridgeReady = (await window.desktopApi.ping()) === 'pong'
    ipcStatus.value = bridgeReady ? 'Main / Preload / Renderer 正常' : '响应异常'
    if (bridgeReady && import.meta.env.DEV) console.info('[Lyric Timeline] IPC bridge ready')
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
      <span class="phase">Timeline Workspace</span>
      <button class="header-settings" type="button" title="设置" @click="settingsOpen = true">
        <span aria-hidden="true">⚙</span><span>设置</span>
      </button>
    </header>

    <nav class="app-toolbar" aria-label="主要操作">
      <div class="toolbar-group">
        <button type="button" @click="importOpen = true">＋ 导入歌词</button>
        <button type="button" :disabled="!playerStore.source" @click="togglePlayback">
          {{ playerStore.playing ? 'Ⅱ 暂停' : '▶ 播放' }}
        </button>
      </div>
      <div class="toolbar-group">
        <button
          type="button"
          :disabled="!projectStore.activeToken"
          @click="projectStore.navigateToken(-1)"
        >
          ← 上一词
        </button>
        <button
          type="button"
          :disabled="!projectStore.activeToken"
          @click="projectStore.navigateToken(1)"
        >
          下一词 →
        </button>
        <button type="button" :disabled="!playerStore.duration" @click="fitTimeline">
          适合时间轴
        </button>
      </div>
      <span class="toolbar-spacer" />
      <span class="toolbar-project">{{ projectStore.project.name }}</span>
    </nav>

    <section class="workspace">
      <div
        ref="workspace"
        class="workspace-layout"
        :style="workspaceStyle"
        @pointermove="resizeWorkspace"
      >
        <aside class="workspace-column tool-workspace">
          <div class="workspace-pane"><LyricsPanel @request-import="importOpen = true" /></div>
          <div
            class="splitter splitter-horizontal"
            role="separator"
            aria-label="调整歌词与属性面板高度"
            @pointerdown="beginResize('left-rows', $event)"
            @pointerup="endResize"
            @pointercancel="endResize"
          />
          <div class="workspace-pane"><TokenInspector /></div>
        </aside>

        <div
          class="splitter splitter-vertical"
          role="separator"
          aria-label="调整工具区宽度"
          @pointerdown="beginResize('columns', $event)"
          @pointerup="endResize"
          @pointercancel="endResize"
        />

        <section class="workspace-column edit-workspace">
          <section class="stage preview-stage">
            <header class="pane-title"><strong>节目监视器</strong><span>歌词效果预览</span></header>
            <div class="lyric-focus">
              <template v-if="projectStore.activeLine">
                <p class="context-line previous">{{ previousLine?.text ?? ' ' }}</p>
                <p class="eyebrow">当前句 · {{ projectStore.currentLineIndex + 1 }}</p>
                <h1 class="active-line">{{ projectStore.activeLine.text }}</h1>
                <div class="active-tokens">
                  <button
                    v-for="(token, tokenIndex) in projectStore.activeLine.tokens"
                    :key="token.id"
                    type="button"
                    :class="{
                      active:
                        projectStore.activeToken !== null &&
                        tokenIndex === projectStore.currentTokenIndex,
                      timed: token.start !== null
                    }"
                    @click="projectStore.selectToken(projectStore.currentLineIndex, tokenIndex)"
                  >
                    {{ token.text }}
                  </button>
                </div>
                <p class="timing-prompt" :class="{ complete: projectStore.timingFinished }">
                  {{
                    projectStore.timingFinished
                      ? '打轴完成 · 最后一个 Token 已闭合'
                      : '按 F 记录当前 Token'
                  }}
                </p>
                <p class="context-line next">{{ nextLine?.text ?? '已经是最后一句' }}</p>
              </template>

              <template v-else>
                <p class="eyebrow">逐字歌词打轴工具</p>
                <h1>现在，写下歌词。</h1>
                <p class="lede">从左侧导入歌词，中文逐字、英文逐词，准备进入连续打轴。</p>
              </template>
            </div>
          </section>
          <div
            class="splitter splitter-horizontal"
            role="separator"
            aria-label="调整预览与时间轴高度"
            @pointerdown="beginResize('right-rows', $event)"
            @pointerup="endResize"
            @pointercancel="endResize"
          />
          <div class="workspace-pane timeline-pane"><Timeline /></div>
        </section>
      </div>
    </section>

    <footer class="statusbar">
      <span class="status-dot" />
      {{ ipcStatus }}
    </footer>

    <LyricsImportDialog :open="importOpen" @close="importOpen = false" @import="importLyrics" />
    <SettingsDialog :open="settingsOpen" @close="settingsOpen = false" />
  </main>
</template>
