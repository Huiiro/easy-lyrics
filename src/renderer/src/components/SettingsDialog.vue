<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseDialog from '@renderer/components/ui/BaseDialog.vue'
import BaseSelect from '@renderer/components/ui/BaseSelect.vue'
import { useI18n, type AppLocale } from '@renderer/i18n'
import { cloneExportTemplates, DEFAULT_EXPORT_TEMPLATES, type ExportTemplate } from '@shared/export'
import {
  defaultShortcutBindings,
  shortcutActions,
  shortcutFromEvent,
  type ShortcutAction,
  type ShortcutBindings,
  useSettingsStore
} from '@renderer/stores/settings'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const settings = useSettingsStore()
const { locale, setLocale, t } = useI18n()
const query = ref('')
const activeSection = ref<'shortcuts' | 'appearance' | 'export'>('shortcuts')
const recording = ref<ShortcutAction | null>(null)
const draft = ref<ShortcutBindings>({ ...settings.shortcuts })
const templates = ref<ExportTemplate[]>(structuredClone(DEFAULT_EXPORT_TEMPLATES))
const savedTemplates = ref<ExportTemplate[]>(structuredClone(DEFAULT_EXPORT_TEMPLATES))
const selectedTemplateId = ref('')
const templateStatus = ref('')
const selectedTemplate = computed(
  () => templates.value.find((template) => template.id === selectedTemplateId.value) ?? null
)
const themeOptions = computed(() => [{ value: 'dark', label: t('深色') }])
const localeOptions = computed(() => [
  { value: 'zh-CN', label: t('简体中文') },
  { value: 'en-US', label: t('英语') }
])

const filteredActions = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  if (!needle) return shortcutActions
  return shortcutActions.filter((action) =>
    `${t(action.label)} ${t(action.description)} ${t(action.group)}`
      .toLocaleLowerCase()
      .includes(needle)
  )
})

const duplicateKeys = computed(() => {
  const counts = Object.values(draft.value).reduce<Record<string, number>>((result, key) => {
    if (key) result[key] = (result[key] ?? 0) + 1
    return result
  }, {})
  return new Set(Object.keys(counts).filter((key) => (counts[key] ?? 0) > 1))
})

const shortcutsChanged = computed(() =>
  shortcutActions.some((action) => draft.value[action.id] !== settings.shortcuts[action.id])
)
const templatesChanged = computed(
  () => JSON.stringify(templates.value) !== JSON.stringify(savedTemplates.value)
)
const changed = computed(() => shortcutsChanged.value || templatesChanged.value)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    draft.value = { ...settings.shortcuts }
    recording.value = null
    query.value = ''
    templateStatus.value = ''
    try {
      const loaded = await window.desktopApi.loadExportTemplates()
      templates.value = structuredClone(loaded)
      savedTemplates.value = structuredClone(loaded)
      selectedTemplateId.value = loaded[0]?.id ?? ''
    } catch {
      templateStatus.value = t('模板读取失败')
    }
  }
)

function record(action: ShortcutAction, event: KeyboardEvent): void {
  if (recording.value !== action) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') {
    recording.value = null
    return
  }
  const shortcut = shortcutFromEvent(event)
  if (!shortcut) return
  draft.value[action] = shortcut
  recording.value = null
}

function clearShortcut(action: ShortcutAction): void {
  draft.value[action] = ''
  recording.value = null
}

async function apply(): Promise<void> {
  if (duplicateKeys.value.size > 0) return
  settings.setShortcuts(draft.value)
  try {
    // Vue wraps the editable array and its entries in proxies, which Electron's
    // structured-clone IPC transport cannot serialize.
    await window.desktopApi.saveExportTemplates(cloneExportTemplates(templates.value))
    savedTemplates.value = structuredClone(templates.value)
    templateStatus.value = t('模板已保存')
  } catch {
    templateStatus.value = t('模板保存失败')
  }
}

async function confirm(): Promise<void> {
  await apply()
  if (duplicateKeys.value.size === 0 && templateStatus.value !== t('模板保存失败')) emit('close')
}

function addTemplate(source?: ExportTemplate): void {
  const id = crypto.randomUUID()
  const next: ExportTemplate = source
    ? { ...structuredClone(source), id, name: `${source.name} ${t('副本')}` }
    : {
        id,
        name: t('新导出模板'),
        extension: 'txt',
        lineTemplate: '{{line.text}}',
        tokenTemplate: '{{token.text}}',
        separator: '\\n'
      }
  templates.value.push(next)
  selectedTemplateId.value = id
}

function deleteTemplate(): void {
  if (templates.value.length <= 1 || !selectedTemplate.value) return
  const index = templates.value.findIndex((item) => item.id === selectedTemplateId.value)
  templates.value.splice(index, 1)
  selectedTemplateId.value = templates.value[Math.min(index, templates.value.length - 1)]?.id ?? ''
}

function displayKey(value: string): string {
  const isMac = navigator.platform.toLowerCase().includes('mac')
  return value
    .replace('Mod', isMac ? '⌘' : 'Ctrl')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replaceAll('+', isMac ? ' ' : ' + ')
    .replace('ArrowLeft', '←')
    .replace('ArrowRight', '→')
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
    .replace('Space', 'Space')
}

</script>

<template>
  <BaseDialog :open="open" title-id="settings-title" size="large" @close="emit('close')">
    <div class="settings-dialog">
      <header class="settings-header">
        <h2 id="settings-title">{{ t('设置') }}</h2>
        <button
          class="dialog-close"
          type="button"
          :aria-label="t('关闭设置')"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <div class="settings-layout">
        <aside class="settings-nav" :aria-label="t('设置')">
          <label class="settings-search">
            <span aria-hidden="true">⌕</span>
            <input v-model="query" type="search" :placeholder="t('搜索设置')" />
          </label>
          <button
            type="button"
            :class="{ active: activeSection === 'appearance' }"
            @click="activeSection = 'appearance'"
          >
            <span aria-hidden="true">◐</span> {{ t('外观与行为') }}
          </button>
          <button
            type="button"
            :class="{ active: activeSection === 'shortcuts' }"
            @click="activeSection = 'shortcuts'"
          >
            <span aria-hidden="true">⌨</span> {{ t('快捷键') }}
          </button>
          <button
            type="button"
            :class="{ active: activeSection === 'export' }"
            @click="activeSection = 'export'"
          >
            <span aria-hidden="true">⇧</span> {{ t('导出模板') }}
          </button>
        </aside>

        <section v-if="activeSection === 'shortcuts'" class="settings-content">
          <div class="settings-content-header">
            <div>
              <h3>{{ t('快捷键') }}</h3>
              <p>{{ t('单击快捷键区域后按下新的按键组合。Esc 可取消录入。') }}</p>
            </div>
            <button
              class="link-button"
              type="button"
              @click="draft = { ...defaultShortcutBindings }"
            >
              {{ t('恢复默认') }}
            </button>
          </div>

          <div class="shortcut-table" role="table" :aria-label="t('快捷键绑定')">
            <div class="shortcut-table-head" role="row">
              <span>{{ t('操作') }}</span><span>{{ t('快捷键') }}</span>
            </div>
            <div
              v-for="action in filteredActions"
              :key="action.id"
              class="shortcut-row"
              :class="{ conflict: duplicateKeys.has(draft[action.id]) }"
              role="row"
            >
              <div class="shortcut-name">
                <span class="shortcut-group">{{ t(action.group) }}</span>
                <strong>{{ t(action.label) }}</strong>
                <small>{{ t(action.description) }}</small>
              </div>
              <div class="shortcut-binding">
                <button
                  type="button"
                  :class="{ recording: recording === action.id }"
                  @click="recording = action.id"
                  @keydown="record(action.id, $event)"
                >
                  {{
                    recording === action.id
                      ? t('请按快捷键…')
                      : draft[action.id]
                        ? displayKey(draft[action.id])
                        : t('未设置')
                  }}
                </button>
                <button
                  class="clear-shortcut"
                  type="button"
                  :disabled="!draft[action.id]"
                  :aria-label="`清除${action.label}快捷键`"
                  @click="clearShortcut(action.id)"
                >
                  ×
                </button>
                <span v-if="duplicateKeys.has(draft[action.id])" class="conflict-label">{{
                  t('冲突')
                }}</span>
              </div>
            </div>
            <div v-if="filteredActions.length === 0" class="settings-empty">
              {{ t('没有匹配的设置') }}
            </div>
          </div>
          <p v-if="duplicateKeys.size" class="settings-warning">
            {{ t('存在重复绑定，请先解决冲突。') }}
          </p>
        </section>

        <section
          v-else-if="activeSection === 'export'"
          class="settings-content export-template-settings"
        >
          <div class="settings-content-header">
            <div>
              <h3>{{ t('导出模板') }}</h3>
              <p>{{ t('管理自定义导出格式；保存后可在导出窗口中直接选择。') }}</p>
            </div>
            <button class="link-button" type="button" @click="addTemplate()">
              ＋ {{ t('新建模板') }}
            </button>
          </div>
          <div class="template-manager">
            <aside class="template-list">
              <button
                v-for="template in templates"
                :key="template.id"
                type="button"
                :class="{ active: selectedTemplateId === template.id }"
                @click="selectedTemplateId = template.id"
              >
                <strong>{{ template.name || t('未命名模板') }}</strong>
                <span>.{{ template.extension || 'txt' }}</span>
              </button>
            </aside>
            <div v-if="selectedTemplate" class="template-editor">
              <div class="template-editor-actions">
                <button
                  class="secondary-button"
                  type="button"
                  @click="addTemplate(selectedTemplate)"
                >
                  {{ t('复制') }}
                </button>
                <button
                  class="secondary-button danger"
                  type="button"
                  :disabled="templates.length <= 1"
                  @click="deleteTemplate"
                >
                  {{ t('删除') }}
                </button>
              </div>
              <label>{{ t('模板名称') }}<input v-model="selectedTemplate.name" /></label>
              <label>{{ t('文件扩展名') }}<input v-model="selectedTemplate.extension" placeholder="txt" /></label>
              <label>{{ t('行模板') }}<textarea v-model="selectedTemplate.lineTemplate" rows="3" />
              </label>
              <label>{{ t('Token 模板') }}<textarea v-model="selectedTemplate.tokenTemplate" rows="3" />
              </label>
              <label>{{ t('行分隔符') }}<input v-model="selectedTemplate.separator" placeholder="\\n" /></label>
              <p class="template-hint">{{ t('模板变量说明') }}</p>
            </div>
          </div>
        </section>

        <section v-else class="settings-content">
          <div class="settings-content-header">
            <div>
              <h3>{{ t('外观与行为') }}</h3>
              <p>{{ t('调整应用的显示方式。') }}</p>
            </div>
          </div>
          <div class="settings-form-row">
            <div>
              <strong>{{ t('界面主题') }}</strong><small>{{ t('当前版本针对深色工作区优化') }}</small>
            </div>
            <BaseSelect v-model="settings.theme" :options="themeOptions" disabled />
          </div>
          <div class="settings-form-row">
            <div>
              <strong>{{ t('界面语言') }}</strong><small>{{ t('选择应用界面与原生菜单使用的语言') }}</small>
            </div>
            <BaseSelect
              :model-value="locale"
              :options="localeOptions"
              @update:model-value="setLocale($event as AppLocale)"
            />
          </div>
        </section>
      </div>

      <footer class="settings-footer">
        <span>{{ templateStatus || (changed ? t('有尚未应用的更改') : t('所有更改已应用')) }}</span>
        <div>
          <button class="secondary-button" type="button" @click="emit('close')">
            {{ t('取消') }}
          </button>
          <button
            class="secondary-button"
            type="button"
            :disabled="!changed || duplicateKeys.size > 0"
            @click="apply"
          >
            {{ t('应用') }}
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="duplicateKeys.size > 0"
            @click="confirm"
          >
            {{ t('确定') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
