<script setup lang="ts">
import { computed, ref } from 'vue'

import { useProjectStore } from '@renderer/stores/project'
import { formatTime, parseTimecode } from '@renderer/utils/time'

const projectStore = useProjectStore()
const error = ref<string | null>(null)

const duration = computed(() => {
  const token = projectStore.activeToken
  if (!token || token.start === null || token.end === null) return null
  return Math.max(0, token.end - token.start)
})

function displayTime(time: number | null | undefined): string {
  return time === null || time === undefined ? '' : formatTime(time)
}

function updateBoundary(boundary: 'start' | 'end', event: Event): void {
  const input = event.target as HTMLInputElement
  if (!input.value.trim()) {
    projectStore.setTokenBoundary(boundary, null)
    error.value = null
    return
  }

  const time = parseTimecode(input.value)
  if (time === null) {
    error.value = '请输入 00:10.360 或秒数'
    input.value = displayTime(projectStore.activeToken?.[boundary])
    return
  }

  projectStore.setTokenBoundary(boundary, time)
  input.value = displayTime(projectStore.activeToken?.[boundary])
  error.value = null
}

function updateOffset(event: Event): void {
  projectStore.setTimingOffset(Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <aside class="panel inspector-panel">
    <p class="panel-label">Token Inspector</p>

    <template v-if="projectStore.activeToken">
      <div class="inspector-token">{{ projectStore.activeToken.text }}</div>

      <label class="inspector-field">
        <span>Start</span>
        <input
          :key="`${projectStore.activeToken.id}-start`"
          type="text"
          :value="displayTime(projectStore.activeToken.start)"
          placeholder="00:00.000"
          @change="updateBoundary('start', $event)"
        />
      </label>

      <label class="inspector-field">
        <span>End</span>
        <input
          :key="`${projectStore.activeToken.id}-end`"
          type="text"
          :value="displayTime(projectStore.activeToken.end)"
          placeholder="00:00.000"
          @change="updateBoundary('end', $event)"
        />
      </label>

      <div class="inspector-readout">
        <span>Duration</span>
        <strong>{{ duration === null ? '—' : `${Math.round(duration * 1000)} ms` }}</strong>
      </div>

      <label class="inspector-field offset-field">
        <span>Timing Offset</span>
        <div>
          <input
            type="number"
            min="-5000"
            max="5000"
            step="10"
            :value="projectStore.project.settings.timingOffsetMs"
            @change="updateOffset"
          />
          <small>ms</small>
        </div>
      </label>

      <p v-if="error" class="inspector-error" role="alert">{{ error }}</p>
    </template>

    <p v-else class="inspector-empty">导入歌词后选择一个 Token</p>

    <div class="shortcut-card">
      <p>快捷键</p>
      <dl>
        <div>
          <dt>Space</dt>
          <dd>播放 / 暂停</dd>
        </div>
        <div>
          <dt>F</dt>
          <dd>记录当前 Token</dd>
        </div>
        <div>
          <dt>← →</dt>
          <dd>上 / 下一个 Token</dd>
        </div>
        <div>
          <dt>↑ ↓</dt>
          <dd>上 / 下一行</dd>
        </div>
      </dl>
    </div>
  </aside>
</template>
