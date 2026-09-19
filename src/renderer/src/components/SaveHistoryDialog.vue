<script setup lang="ts">
import { ref, watch } from 'vue'

import BaseDialog from '@renderer/components/ui/BaseDialog.vue'
import { useI18n } from '@renderer/i18n'
import type { ProjectFileResult, SaveHistoryEntry } from '@shared/ipc'

const props = defineProps<{
  open: boolean
  projectId: string
  projectName: string
  projectPath: string | null
}>()
const emit = defineEmits<{ close: []; restored: [result: ProjectFileResult] }>()
const { t } = useI18n()
const entries = ref<SaveHistoryEntry[]>([])
const loading = ref(false)
const restoringId = ref<string | null>(null)
const confirmingEntry = ref<SaveHistoryEntry | null>(null)

watch(
  () => [props.open, props.projectId, props.projectPath] as const,
  async ([open, projectId, projectPath]) => {
    if (!open) return
    confirmingEntry.value = null
    loading.value = true
    try {
      entries.value = await window.desktopApi.listSaveHistory(projectId, projectPath ?? undefined)
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)

function formatTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(
    value
  )
}

function restoreEntry(entry: SaveHistoryEntry): void {
  if (!entry.archiveAvailable || restoringId.value) return
  confirmingEntry.value = entry
}

async function confirmRestore(): Promise<void> {
  const entry = confirmingEntry.value
  if (!entry || restoringId.value) return
  restoringId.value = entry.id
  try {
    const result = await window.desktopApi.loadSaveHistoryEntry(entry.id)
    if (!result) {
      window.alert(t('archive_unavailable'))
      return
    }
    emit('restored', result)
    emit('close')
  } catch {
    window.alert(t('archive_restore_failed'))
  } finally {
    restoringId.value = null
    confirmingEntry.value = null
  }
}
</script>

<template>
  <BaseDialog :open="open" title-id="save-history-title" @close="emit('close')">
    <div class="save-history-dialog">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">{{ t('save_history') }}</p>
          <h2 id="save-history-title">{{ projectName }}</h2>
        </div>
        <button class="icon-button" type="button" :aria-label="t('close')" @click="emit('close')">
          ×
        </button>
      </header>
      <div v-if="confirmingEntry" class="save-history-confirmation">
        <strong>{{ t('restore_archive') }}</strong>
        <p>{{ t('restore_this_archive_confirmation') }}</p>
        <time :datetime="new Date(confirmingEntry.savedAt).toISOString()">
          {{ formatTime(confirmingEntry.savedAt) }}
        </time>
        <div>
          <button class="secondary-button" type="button" @click="confirmingEntry = null">
            {{ t('cancel') }}
          </button>
          <button class="primary-button" type="button" @click="confirmRestore">
            {{ t('restore') }}
          </button>
        </div>
      </div>
      <p v-else-if="loading" class="save-history-empty">{{ t('loading') }}</p>
      <p v-else-if="entries.length === 0" class="save-history-empty">
        {{ t('no_save_history') }}
      </p>
      <ol v-else class="save-history-list">
        <li v-for="entry in entries" :key="entry.id">
          <div class="save-history-record">
            <div>
              <time :datetime="new Date(entry.savedAt).toISOString()">{{
                formatTime(entry.savedAt)
              }}</time>
              <small>{{ entry.kind === 'autosave' ? t('autosave') : t('manual_save') }}</small>
            </div>
            <span :title="entry.path">{{ entry.path || t('unsaved_project') }}</span>
          </div>
          <button
            class="secondary-button"
            type="button"
            :disabled="!entry.archiveAvailable || restoringId !== null"
            :title="entry.archiveAvailable ? t('restore_archive') : t('archive_unavailable')"
            @click="restoreEntry(entry)"
          >
            {{ restoringId === entry.id ? t('restoring') : t('restore') }}
          </button>
        </li>
      </ol>
      <footer class="dialog-footer">
        <span>{{ t('count_save_records', { count: entries.length }) }}</span>
        <div>
          <button class="primary-button" type="button" @click="emit('close')">
            {{ t('close') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
