<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import BaseDialog from '@renderer/components/ui/BaseDialog.vue'
import { useI18n } from '@renderer/i18n'
import { useProjectStore } from '@renderer/stores/project'
import { useTimelineStore } from '@renderer/stores/timeline'
import { segmentGraphemes } from '@renderer/services/tokenizer'

type EditMode = 'split' | 'insert-before' | 'insert-after'

const open = ref(false)
const mode = ref<EditMode>('split')
const boundaries = ref<number[]>([])
const insertText = ref('')
const error = ref<string | null>(null)
const projectStore = useProjectStore()
const timelineStore = useTimelineStore()
const { t } = useI18n()

const characters = computed(() => segmentGraphemes(projectStore.activeToken?.text ?? ''))
const dialogTitle = computed(() => {
  if (mode.value === 'split') return t('split_token')
  return mode.value === 'insert-before' ? t('insert_token_before') : t('insert_token_after')
})

function show(event: Event): void {
  if (!projectStore.activeToken) return
  const requested = (event as CustomEvent<EditMode>).detail
  mode.value = ['split', 'insert-before', 'insert-after'].includes(requested) ? requested : 'split'
  boundaries.value = []
  insertText.value = ''
  error.value = null
  open.value = true
}

function close(): void {
  open.value = false
  error.value = null
}

function toggleBoundary(boundary: number): void {
  boundaries.value = boundaries.value.includes(boundary)
    ? boundaries.value.filter((item) => item !== boundary)
    : [...boundaries.value, boundary].sort((left, right) => left - right)
  error.value = null
}

function splitParts(): string[] {
  const points = [0, ...boundaries.value, characters.value.length]
  return points
    .slice(0, -1)
    .map((start, index) => characters.value.slice(start, points[index + 1]).join(''))
}

function submit(): void {
  const succeeded =
    mode.value === 'split'
      ? projectStore.splitActiveToken(splitParts())
      : projectStore.insertTokenAdjacent(mode.value === 'insert-before' ? -1 : 1, insertText.value)
  if (!succeeded) {
    error.value =
      mode.value === 'split'
        ? t('mark_at_least_one_split_point')
        : t('enter_text_for_the_new_token')
    return
  }
  timelineStore.selectedTokenIds = projectStore.activeToken ? [projectStore.activeToken.id] : []
  close()
}

onMounted(() => window.addEventListener('token-structure-dialog', show))
onUnmounted(() => window.removeEventListener('token-structure-dialog', show))
</script>

<template>
  <BaseDialog :open="open" title-id="token-structure-title" @close="close">
    <form class="token-structure-dialog" @submit.prevent="submit">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">Token</p>
          <h2 id="token-structure-title">{{ dialogTitle }}</h2>
        </div>
        <button class="icon-button" type="button" :aria-label="t('close')" @click="close">×</button>
      </header>

      <div class="token-structure-dialog-body">
        <template v-if="mode === 'split'">
          <p>{{ t('click_between_characters_to_mark_split_points') }}</p>
          <div class="token-split-marker" :aria-label="t('token_split_markers')">
            <template v-for="(character, index) in characters" :key="index">
              <span>{{ character }}</span>
              <button
                v-if="index < characters.length - 1"
                type="button"
                class="token-split-boundary"
                :class="{ active: boundaries.includes(index + 1) }"
                :aria-pressed="boundaries.includes(index + 1)"
                :aria-label="t('toggle_split_point')"
                @click="toggleBoundary(index + 1)"
              />
            </template>
          </div>
        </template>
        <label v-else class="field-label">
          <span>{{ t('enter_text_for_the_new_token') }}</span>
          <input v-model="insertText" autofocus type="text" />
        </label>
        <p v-if="error" class="inspector-error" role="alert">{{ error }}</p>
      </div>

      <footer class="dialog-footer">
        <span>{{ projectStore.activeToken?.text }}</span>
        <div>
          <button class="secondary-button" type="button" @click="close">{{ t('cancel') }}</button>
          <button class="primary-button" type="submit">{{ t('ok') }}</button>
        </div>
      </footer>
    </form>
  </BaseDialog>
</template>
