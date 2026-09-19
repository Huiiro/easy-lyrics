<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from '@renderer/i18n'

import { useProjectStore } from '@renderer/stores/project'
import { useTimelineStore } from '@renderer/stores/timeline'
import { formatTime, parseTimecode } from '@renderer/utils/time'
import { segmentGraphemes } from '@renderer/services/tokenizer'

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
const canSplitToken = computed(
  () => segmentGraphemes(projectStore.activeToken?.text ?? '').length > 1
)

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
    error.value = t('enter_a_time_such_as_00_10_360_or_a_number_of_seconds')
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
    <template v-if="projectStore.activeToken">
      <div class="inspector-token">{{ projectStore.activeToken.text }}</div>

      <label class="inspector-field">
        <span>{{ t('split_merge_token') }}</span>
      </label>
      <section class="token-structure-editor">
        <div class="token-structure-actions">
          <button type="button" :disabled="!canSplitToken" @click="openStructureDialog">
            {{ t('split') }}
          </button>
          <button type="button" :disabled="!canMergePrevious" @click="mergeToken(-1)">
            {{ t('merge_previous') }}
          </button>
          <button type="button" :disabled="!canMergeNext" @click="mergeToken(1)">
            {{ t('merge_next') }}
          </button>
          <button type="button" class="danger" @click="deleteActiveToken">
            {{ t('delete') }}
          </button>
        </div>
      </section>

      <div class="inspector-readout">
        <span>Duration</span>
        <strong>{{ duration === null ? '—' : `${Math.round(duration * 1000)} ms` }}</strong>
      </div>
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

    <p v-else class="inspector-empty">{{ t('import_lyrics_and_select_a_token') }}</p>
  </aside>
</template>
