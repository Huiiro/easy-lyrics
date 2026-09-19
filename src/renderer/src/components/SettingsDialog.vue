<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseDialog from '@renderer/components/ui/BaseDialog.vue'
import BaseSelect from '@renderer/components/ui/BaseSelect.vue'
import { useI18n, type AppLocale } from '@renderer/i18n'
import { cloneExportTemplates, DEFAULT_EXPORT_TEMPLATES, type ExportTemplate } from '@shared/export'
import {
  defaultShortcutBindings,
  DEFAULT_AUTOSAVE_INTERVAL_MS,
  shortcutActions,
  formatShortcut,
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
const autosaveEnabledDraft = ref(settings.autosaveEnabled)
const autosaveIntervalDraft = ref(settings.autosaveIntervalMs)
const templates = ref<ExportTemplate[]>(structuredClone(DEFAULT_EXPORT_TEMPLATES))
const savedTemplates = ref<ExportTemplate[]>(structuredClone(DEFAULT_EXPORT_TEMPLATES))
const selectedTemplateId = ref('')
const templateStatus = ref('')
const selectedTemplate = computed(
  () => templates.value.find((template) => template.id === selectedTemplateId.value) ?? null
)
const themeOptions = computed(() => [{ value: 'dark', label: t('dark') }])
const localeOptions = computed(() => [
  { value: 'zh-CN', label: t('simplified_chinese') },
  { value: 'en-US', label: t('english') }
])
const autosaveIntervalOptions = computed(() => [
  { value: '60000', label: t('one_minute') },
  { value: '120000', label: t('two_minutes') },
  { value: '300000', label: t('five_minutes') },
  { value: '600000', label: t('ten_minutes') }
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
const autosaveChanged = computed(
  () =>
    autosaveEnabledDraft.value !== settings.autosaveEnabled ||
    autosaveIntervalDraft.value !== settings.autosaveIntervalMs
)
const changed = computed(
  () => shortcutsChanged.value || templatesChanged.value || autosaveChanged.value
)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    draft.value = { ...settings.shortcuts }
    autosaveEnabledDraft.value = settings.autosaveEnabled
    autosaveIntervalDraft.value = settings.autosaveIntervalMs
    recording.value = null
    query.value = ''
    templateStatus.value = ''
    try {
      const loaded = await window.desktopApi.loadExportTemplates()
      templates.value = structuredClone(loaded)
      savedTemplates.value = structuredClone(loaded)
      selectedTemplateId.value = loaded[0]?.id ?? ''
    } catch {
      templateStatus.value = t('could_not_load_templates')
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
  settings.setAutosave({
    enabled: autosaveEnabledDraft.value,
    intervalMs: autosaveIntervalDraft.value || DEFAULT_AUTOSAVE_INTERVAL_MS
  })
  try {
    // Vue wraps the editable array and its entries in proxies, which Electron's
    // structured-clone IPC transport cannot serialize.
    await window.desktopApi.saveExportTemplates(cloneExportTemplates(templates.value))
    savedTemplates.value = structuredClone(templates.value)
    templateStatus.value = t('templates_saved')
  } catch {
    templateStatus.value = t('could_not_save_templates')
  }
}

async function confirm(): Promise<void> {
  await apply()
  if (duplicateKeys.value.size === 0 && templateStatus.value !== t('could_not_save_templates'))
    emit('close')
}

function addTemplate(source?: ExportTemplate): void {
  const id = crypto.randomUUID()
  const next: ExportTemplate = source
    ? { ...structuredClone(source), id, name: `${source.name} ${t('copy')}` }
    : {
        id,
        name: t('new_export_template'),
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
  return formatShortcut(value, navigator.platform.toLowerCase().includes('mac'))
}
</script>

<template>
  <BaseDialog :open="open" title-id="settings-title" size="large" @close="emit('close')">
    <div class="settings-dialog">
      <header class="settings-header">
        <h2 id="settings-title">{{ t('settings') }}</h2>
        <button
          class="dialog-close"
          type="button"
          :aria-label="t('close_settings')"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <div class="settings-layout">
        <aside class="settings-nav" :aria-label="t('settings')">
          <label class="settings-search">
            <span aria-hidden="true">⌕</span>
            <input v-model="query" type="search" :placeholder="t('search_settings')" />
          </label>
          <button
            type="button"
            :class="{ active: activeSection === 'appearance' }"
            @click="activeSection = 'appearance'"
          >
            <span aria-hidden="true">◐</span> {{ t('appearance_behavior') }}
          </button>
          <button
            type="button"
            :class="{ active: activeSection === 'shortcuts' }"
            @click="activeSection = 'shortcuts'"
          >
            <span aria-hidden="true">⌨</span> {{ t('shortcuts') }}
          </button>
          <button
            type="button"
            :class="{ active: activeSection === 'export' }"
            @click="activeSection = 'export'"
          >
            <span aria-hidden="true">⇧</span> {{ t('export_templates') }}
          </button>
        </aside>

        <section v-if="activeSection === 'shortcuts'" class="settings-content">
          <div class="settings-content-header">
            <div>
              <h3>{{ t('shortcuts') }}</h3>
              <p>
                {{
                  t('select_a_shortcut_field_and_press_a_new_key_combination_press_esc_to_cancel')
                }}
              </p>
            </div>
            <button
              class="link-button"
              type="button"
              @click="draft = { ...defaultShortcutBindings }"
            >
              {{ t('restore_defaults') }}
            </button>
          </div>

          <div class="shortcut-table" role="table" :aria-label="t('shortcut_bindings')">
            <div class="shortcut-table-head" role="row">
              <span>{{ t('action') }}</span
              ><span>{{ t('shortcuts') }}</span>
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
                      ? t('press_shortcut')
                      : draft[action.id]
                        ? displayKey(draft[action.id])
                        : t('not_set')
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
                  t('conflict')
                }}</span>
              </div>
            </div>
            <div v-if="filteredActions.length === 0" class="settings-empty">
              {{ t('no_matching_settings') }}
            </div>
          </div>
          <p v-if="duplicateKeys.size" class="settings-warning">
            {{ t('some_shortcuts_conflict_resolve_them_before_applying') }}
          </p>
        </section>

        <section
          v-else-if="activeSection === 'export'"
          class="settings-content export-template-settings"
        >
          <div class="settings-content-header">
            <div>
              <h3>{{ t('export_templates') }}</h3>
              <p>{{ t('manage_custom_export_formats_available_in_the_export_dialog') }}</p>
            </div>
            <button class="link-button" type="button" @click="addTemplate()">
              ＋ {{ t('new_template') }}
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
                <strong>{{ template.name || t('untitled_template') }}</strong>
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
                  {{ t('copy') }}
                </button>
                <button
                  class="secondary-button danger"
                  type="button"
                  :disabled="templates.length <= 1"
                  @click="deleteTemplate"
                >
                  {{ t('delete') }}
                </button>
              </div>
              <label>{{ t('template_name') }}<input v-model="selectedTemplate.name" /></label>
              <label
                >{{ t('file_extension')
                }}<input v-model="selectedTemplate.extension" placeholder="txt"
              /></label>
              <label
                >{{ t('line_template')
                }}<textarea v-model="selectedTemplate.lineTemplate" rows="3" />
              </label>
              <label
                >{{ t('token_template')
                }}<textarea v-model="selectedTemplate.tokenTemplate" rows="3" />
              </label>
              <label
                >{{ t('line_separator')
                }}<input v-model="selectedTemplate.separator" placeholder="\\n"
              /></label>
              <p class="template-hint">
                {{
                  t(
                    'variables_line_token_index_text_start_end_and_duration_time_formats_seconds_milliseconds_mm_ss_xx_mm_ss_xxx_hh_mm_ss_xxx'
                  )
                }}
              </p>
            </div>
          </div>
        </section>

        <section v-else class="settings-content">
          <div class="settings-content-header">
            <div>
              <h3>{{ t('appearance_behavior') }}</h3>
              <p>{{ t('adjust_how_the_application_is_displayed') }}</p>
            </div>
          </div>
          <div class="settings-form-row">
            <div>
              <strong>{{ t('theme') }}</strong
              ><small>{{ t('this_version_is_optimized_for_a_dark_workspace') }}</small>
            </div>
            <BaseSelect v-model="settings.theme" :options="themeOptions" disabled />
          </div>
          <div class="settings-form-row">
            <div>
              <strong>{{ t('language') }}</strong
              ><small>{{ t('choose_the_language_for_the_interface_and_native_menus') }}</small>
            </div>
            <BaseSelect
              :model-value="locale"
              :options="localeOptions"
              @update:model-value="setLocale($event as AppLocale)"
            />
          </div>
          <div class="settings-form-row">
            <div>
              <strong>{{ t('autosave') }}</strong
              ><small>{{ t('automatically_save_a_recovery_copy_for_each_project') }}</small>
            </div>
            <label class="settings-toggle">
              <input v-model="autosaveEnabledDraft" type="checkbox" />
              <span>{{ autosaveEnabledDraft ? t('enabled') : t('disabled') }}</span>
            </label>
          </div>
          <div class="settings-form-row">
            <div>
              <strong>{{ t('autosave_interval') }}</strong
              ><small>{{ t('choose_how_often_recovery_copies_are_written') }}</small>
            </div>
            <BaseSelect
              :model-value="String(autosaveIntervalDraft)"
              :options="autosaveIntervalOptions"
              :disabled="!autosaveEnabledDraft"
              @update:model-value="autosaveIntervalDraft = Number($event)"
            />
          </div>
        </section>
      </div>

      <footer class="settings-footer">
        <span>{{
          templateStatus || (changed ? t('there_are_unapplied_changes') : t('all_changes_applied'))
        }}</span>
        <div>
          <button class="secondary-button" type="button" @click="emit('close')">
            {{ t('cancel') }}
          </button>
          <button
            class="secondary-button"
            type="button"
            :disabled="!changed || duplicateKeys.size > 0"
            @click="apply"
          >
            {{ t('apply') }}
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="duplicateKeys.size > 0"
            @click="confirm"
          >
            {{ t('ok') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
