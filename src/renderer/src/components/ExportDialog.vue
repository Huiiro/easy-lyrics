<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseDialog from './ui/BaseDialog.vue'
import BaseSelect from './ui/BaseSelect.vue'
import { useI18n } from '@renderer/i18n'
import { useProjectStore } from '@renderer/stores/project'
import {
  BUILTIN_EXPORT_FORMATS,
  DEFAULT_EXPORT_TEMPLATES,
  exportLyrics,
  exportWithTemplate,
  type ExportFormat,
  type ExportTemplate
} from '@shared/export'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const projectStore = useProjectStore()
const { t } = useI18n()
const format = ref<ExportFormat>('enhanced-lrc')
const status = ref('')
const templates = ref<ExportTemplate[]>(structuredClone(DEFAULT_EXPORT_TEMPLATES))
const templateId = ref(templates.value[0]?.id ?? '')
const template = computed(
  () => templates.value.find((item) => item.id === templateId.value) ?? templates.value[0]!
)
const formatOptions = computed(() => [
  ...BUILTIN_EXPORT_FORMATS.map((item) => ({ value: item.id, label: item.name })),
  { value: 'template', label: t('custom_template') }
])
const templateOptions = computed(() =>
  templates.value.map((item) => ({ value: item.id, label: item.name }))
)
const preview = computed(() =>
  format.value === 'template'
    ? exportWithTemplate(projectStore.project, template.value)
    : exportLyrics(projectStore.project, format.value)
)
const extension = computed(() =>
  format.value === 'template'
    ? template.value.extension.replace(/^\./, '') || 'txt'
    : (BUILTIN_EXPORT_FORMATS.find((item) => item.id === format.value)?.extension ?? 'txt')
)
const fileName = computed(
  () => `${projectStore.project.name || t('untitled_project')}.${extension.value}`
)
const previewStats = computed(() => ({
  lines: preview.value ? preview.value.split('\n').length : 0,
  characters: preview.value.length
}))

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    status.value = ''
    templates.value = await window.desktopApi.loadExportTemplates()
    if (!templates.value.some((item) => item.id === templateId.value)) {
      templateId.value = templates.value[0]?.id ?? ''
    }
  }
)

async function save(): Promise<void> {
  status.value = ''
  try {
    const saved = await window.desktopApi.exportLyrics(
      preview.value,
      extension.value,
      projectStore.project.name
    )
    status.value = saved ? t('export_complete') : t('canceled')
  } catch (error) {
    status.value = error instanceof Error ? error.message : t('export_failed')
  }
}
</script>

<template>
  <BaseDialog :open="open" title-id="export-title" size="large" @close="emit('close')">
    <div class="export-dialog">
      <header class="export-dialog-header">
        <div>
          <p class="eyebrow">{{ t('export') }}</p>
          <h2 id="export-title">{{ t('export_lyrics') }}</h2>
          <p>{{ t('choose_a_format_and_review_the_generated_content_before_saving') }}</p>
        </div>
        <button class="icon-button" type="button" :aria-label="t('close')" @click="emit('close')">
          ×
        </button>
      </header>

      <div class="export-layout">
        <aside class="export-form">
          <div class="export-section-heading">
            <span>{{ t('export_settings') }}</span>
            <small>01</small>
          </div>

          <label>
            <span>{{ t('file_format') }}</span>
            <BaseSelect v-model="format" :options="formatOptions" />
          </label>

          <div v-if="format === 'template'" class="export-template-options">
            <label>
              <span>{{ t('export_templates') }}</span>
              <BaseSelect v-model="templateId" :options="templateOptions" />
            </label>
            <div class="template-summary">
              <strong>.{{ template.extension.replace(/^\./, '') || 'txt' }}</strong>
              <span>{{ template.name }}</span>
            </div>
            <p class="template-hint">
              {{ t('manage_template_contents_in_settings_export_templates') }}
            </p>
          </div>

          <div class="export-file-summary">
            <span>{{ t('output_file') }}</span>
            <strong :title="fileName">{{ fileName }}</strong>
            <small>{{ t('lines_lines_characters_characters', previewStats) }}</small>
          </div>
        </aside>

        <section class="export-preview">
          <header>
            <div>
              <strong>{{ t('live_preview') }}</strong>
              <span>{{ fileName }}</span>
            </div>
            <code>.{{ extension }}</code>
          </header>
          <pre :class="{ empty: !preview }">{{ preview || t('no_lyrics_to_export') }}</pre>
        </section>
      </div>

      <footer class="dialog-actions export-dialog-actions">
        <span :class="{ visible: status }">{{ status || t('ready_to_export') }}</span>
        <div>
          <button class="secondary-button" type="button" @click="emit('close')">
            {{ t('cancel') }}
          </button>
          <button class="primary-button" type="button" :disabled="!preview" @click="save">
            {{ t('export_file') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
