<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from '@renderer/i18n'

import { useProjectStore } from '@renderer/stores/project'
import { useTimelineStore } from '@renderer/stores/timeline'
import { formatTime, parseTimecode } from '@renderer/utils/time'

const projectStore = useProjectStore()
const timelineStore = useTimelineStore()
const { t } = useI18n()
const error = ref<string | null>(null)

const duration = computed(() => {
  const token = projectStore.activeToken
  if (!token || token.start === null || token.end === null) return null
  return Math.max(0, token.end - token.start)
})
const canMergePrevious = computed(() => projectStore.currentTokenIndex > 0)
const canMergeNext = computed(() => {
  const line = projectStore.activeLine
  return Boolean(line && projectStore.currentTokenIndex < line.tokens.length - 1)
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
    error.value = t('请输入 00:10.360 或秒数')
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

function mergeToken(direction: -1 | 1): void {
  projectStore.mergeActiveToken(direction)
}

function openStructureDialog(): void {
  if (!projectStore.activeToken) return
  window.dispatchEvent(new CustomEvent('token-structure-dialog', { detail: 'split' }))
}

function deleteActiveToken(): void {
  const token = projectStore.activeToken
  if (!token) return
  if (projectStore.deleteTokens([token.id])) {
    timelineStore.selectedTokenIds = projectStore.activeToken ? [projectStore.activeToken.id] : []
  }
}

onMounted(() => window.addEventListener('token-split-focus', openStructureDialog))
onUnmounted(() => window.removeEventListener('token-split-focus', openStructureDialog))
</script>

<template>
  <aside class="panel inspector-panel">
    <p class="panel-label">{{ t('Token Inspector · 拆分与合并') }}</p>

    <template v-if="projectStore.activeToken">
      <div class="inspector-token">{{ projectStore.activeToken.text }}</div>

      <section class="token-structure-editor">
        <p>{{ t('拆分 / 合并 Token') }}</p>
        <div class="token-structure-actions">
          <button
            type="button"
            :disabled="Array.from(projectStore.activeToken.text).length < 2"
            @click="openStructureDialog"
          >
            {{ t('拆分') }}
          </button>
          <button type="button" :disabled="!canMergePrevious" @click="mergeToken(-1)">
            {{ t('合并前项') }}
          </button>
          <button type="button" :disabled="!canMergeNext" @click="mergeToken(1)">
            {{ t('合并后项') }}
          </button>
          <button type="button" class="danger" @click="deleteActiveToken">
            {{ t('删除') }}
          </button>
        </div>
      </section>

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

    <p v-else class="inspector-empty">{{ t('导入歌词后选择一个 Token') }}</p>

    <div class="shortcut-card">
      <p>{{ t('快捷键') }}</p>
      <dl>
        <div>
          <dt>Space</dt>
          <dd>{{ t('播放 / 暂停') }}</dd>
        </div>
        <div>
          <dt>F</dt>
          <dd>{{ t('记录当前 Token') }}</dd>
        </div>
        <div>
          <dt>← →</dt>
          <dd>{{ t('上 / 下一个 Token') }}</dd>
        </div>
        <div>
          <dt>↑ ↓</dt>
          <dd>{{ t('上 / 下一行') }}</dd>
        </div>
        <div>
          <dt>Ctrl/⌘ + ← →</dt>
          <dd>{{ t('微调 1 ms') }}</dd>
        </div>
        <div>
          <dt>Shift + ← →</dt>
          <dd>{{ t('微调 50 ms') }}</dd>
        </div>
      </dl>
    </div>
  </aside>
</template>
