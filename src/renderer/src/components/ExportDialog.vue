<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseDialog from './ui/BaseDialog.vue'
import { useI18n } from '@renderer/i18n'
import { useProjectStore } from '@renderer/stores/project'
import { BUILTIN_EXPORT_FORMATS, DEFAULT_EXPORT_TEMPLATES, exportLyrics, exportWithTemplate, type ExportFormat, type ExportTemplate } from '@shared/export'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const projectStore = useProjectStore()
const { t } = useI18n()
const format = ref<ExportFormat>('enhanced-lrc')
const status = ref('')
const templates = ref<ExportTemplate[]>(structuredClone(DEFAULT_EXPORT_TEMPLATES))
const templateId = ref(templates.value[0]?.id ?? '')
const template = computed(() => templates.value.find((item) => item.id === templateId.value) ?? templates.value[0]!)
const preview = computed(() => format.value === 'template'
  ? exportWithTemplate(projectStore.project, template.value)
  : exportLyrics(projectStore.project, format.value))
const extension = computed(() => format.value === 'template'
  ? template.value.extension.replace(/^\./, '') || 'txt'
  : BUILTIN_EXPORT_FORMATS.find((item) => item.id === format.value)?.extension ?? 'txt')

watch(() => props.open, async (open) => {
  if (!open) return
  status.value = ''
  templates.value = await window.desktopApi.loadExportTemplates()
  if (!templates.value.some((item) => item.id === templateId.value)) templateId.value = templates.value[0]?.id ?? ''
})

async function save(): Promise<void> {
  status.value = ''
  try {
    const saved = await window.desktopApi.exportLyrics(preview.value, extension.value, projectStore.project.name)
    status.value = saved ? t('导出完成') : t('已取消')
  } catch (error) {
    status.value = error instanceof Error ? error.message : t('导出失败')
  }
}
</script>

<template>
  <BaseDialog :open="open" title-id="export-title" size="large" @close="emit('close')">
    <header class="dialog-header"><div><p class="dialog-kicker">PHASE 6</p><h2 id="export-title">{{ t('导出歌词') }}</h2></div><button class="icon-button" :aria-label="t('关闭')" @click="emit('close')">✕</button></header>
    <div class="export-layout">
      <aside class="export-form">
        <label>{{ t('格式') }}<select v-model="format"><option v-for="item in BUILTIN_EXPORT_FORMATS" :key="item.id" :value="item.id">{{ item.name }}</option><option value="template">{{ t('自定义模板') }}</option></select></label>
        <template v-if="format === 'template'">
          <label>{{ t('模板') }}<select v-model="templateId"><option v-for="item in templates" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <p class="template-summary"><strong>.{{ template.extension }}</strong>{{ template.name }}</p>
          <p class="template-hint">{{ t('模板内容请在“设置 → 导出模板”中管理。') }}</p>
        </template>
      </aside>
      <section class="export-preview"><header>{{ t('实时预览') }} <span>.{{ extension }}</span></header><pre>{{ preview || t('暂无歌词可导出') }}</pre></section>
    </div>
    <footer class="dialog-actions"><span>{{ status }}</span><button class="secondary-button" @click="emit('close')">{{ t('取消') }}</button><button class="primary-button" :disabled="!preview" @click="save">{{ t('导出文件') }}</button></footer>
  </BaseDialog>
</template>
