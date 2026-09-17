<script setup lang="ts">
import { onMounted, ref } from 'vue'

import PlayerBar from '@renderer/components/PlayerBar.vue'

const ipcStatus = ref('正在检查…')

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
      <span class="phase">Phase 1 · Player</span>
    </header>

    <section class="workspace">
      <div class="workspace-grid">
        <aside class="panel lyrics-panel">
          <p class="panel-label">歌词</p>
          <div class="panel-placeholder">Phase 2 将在这里导入和显示歌词</div>
        </aside>

        <section class="stage">
          <p class="eyebrow">逐字歌词打轴工具</p>
          <h1>先听见时间。</h1>
          <p class="lede">从下方选择一首音频，验证播放、暂停、Seek、音量和变速。</p>
          <div class="timeline-placeholder">
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
              <dd>播放器阶段</dd>
            </div>
            <div>
              <dt>下一步</dt>
              <dd>歌词导入</dd>
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
