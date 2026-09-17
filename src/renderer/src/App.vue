<script setup lang="ts">
import { onMounted, ref } from 'vue'

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
      <span class="phase">Phase 0</span>
    </header>

    <section class="workspace">
      <div class="empty-state">
        <p class="eyebrow">逐字歌词打轴工具</p>
        <h1>让每一个字，落在准确的拍点上。</h1>
        <p class="lede">项目骨架已就绪。下一里程碑将接入音频播放器、歌词导入和连续打轴。</p>
        <div class="actions">
          <button type="button" disabled>新建工程</button>
          <button class="secondary" type="button" disabled>打开工程</button>
        </div>
      </div>
    </section>

    <footer class="statusbar">
      <span class="status-dot" />
      {{ ipcStatus }}
    </footer>
  </main>
</template>
