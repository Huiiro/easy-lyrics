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
  { value: 'template', label: t('自定义模板') }
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
  () => `${projectStore.project.name || t('未命名工程')}.${extension.value}`
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
    status.value = saved ? t('导出完成') : t('已取消')
  } catch (error) {
    status.value = error instanceof Error ? error.message : t('导出失败')
  }
}
</script>

<template>
  <BaseDialog :open="open" title-id="export-title" size="large" @close="emit('close')">
    <div class="export-dialog">
      <header class="export-dialog-header">
        <div>
          <p class="eyebrow">{{ t('导出') }}</p>
          <h2 id="export-title">{{ t('导出歌词') }}</h2>
          <p>{{ t('选择导出格式并在保存前检查生成内容。') }}</p>
        </div>
        <button class="icon-button" type="button" :aria-label="t('关闭')" @click="emit('close')">
          ×
        </button>
      </header>

      <div class="export-layout">
        <aside class="export-form">
          <div class="export-section-heading">
            <span>{{ t('导出设置') }}</span>
            <small>01</small>
          </div>

          <label>
            <span>{{ t('文件格式') }}</span>
            <BaseSelect v-model="format" :options="formatOptions" />
          </label>

          <div v-if="format === 'template'" class="export-template-options">
            <label>
              <span>{{ t('导出模板') }}</span>
              <BaseSelect v-model="templateId" :options="templateOptions" />
            </label>
            <div class="template-summary">
              <strong>.{{ template.extension.replace(/^\./, '') || 'txt' }}</strong>
              <span>{{ template.name }}</span>
            </div>
            <p class="template-hint">{{ t('模板内容请在“设置 → 导出模板”中管理。') }}</p>
          </div>

          <div class="export-file-summary">
            <span>{{ t('输出文件') }}</span>
            <strong :title="fileName">{{ fileName }}</strong>
            <small>{{ t('{lines} 行 · {characters} 个字符', previewStats) }}</small>
          </div>
        </aside>

        <section class="export-preview">
          <header>
            <div>
              <strong>{{ t('实时预览') }}</strong>
              <span>{{ fileName }}</span>
            </div>
            <code>.{{ extension }}</code>
          </header>
          <pre :class="{ empty: !preview }">{{ preview || t('暂无歌词可导出') }}</pre>
        </section>
      </div>

      <footer class="dialog-actions export-dialog-actions">
        <span :class="{ visible: status }">{{ status || t('准备导出') }}</span>
        <div>
          <button class="secondary-button" type="button" @click="emit('close')">
            {{ t('取消') }}
          </button>
          <button class="primary-button" type="button" :disabled="!preview" @click="save">
            {{ t('导出文件') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
