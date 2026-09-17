<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseDialog from '@renderer/components/ui/BaseDialog.vue'
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
const query = ref('')
const activeSection = ref<'shortcuts' | 'appearance'>('shortcuts')
const recording = ref<ShortcutAction | null>(null)
const draft = ref<ShortcutBindings>({ ...settings.shortcuts })

const filteredActions = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  if (!needle) return shortcutActions
  return shortcutActions.filter((action) =>
    `${action.label} ${action.description} ${action.group}`.toLocaleLowerCase().includes(needle)
  )
})

const duplicateKeys = computed(() => {
  const counts = Object.values(draft.value).reduce<Record<string, number>>((result, key) => {
    if (key) result[key] = (result[key] ?? 0) + 1
    return result
  }, {})
  return new Set(Object.keys(counts).filter((key) => (counts[key] ?? 0) > 1))
})

const changed = computed(() =>
  shortcutActions.some((action) => draft.value[action.id] !== settings.shortcuts[action.id])
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    draft.value = { ...settings.shortcuts }
    recording.value = null
    query.value = ''
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

function apply(): void {
  if (duplicateKeys.value.size > 0) return
  settings.setShortcuts(draft.value)
}

function confirm(): void {
  apply()
  if (duplicateKeys.value.size === 0) emit('close')
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
        <h2 id="settings-title">设置</h2>
        <button class="dialog-close" type="button" aria-label="关闭设置" @click="emit('close')">
          ×
        </button>
      </header>

      <div class="settings-layout">
        <aside class="settings-nav" aria-label="设置分类">
          <label class="settings-search">
            <span aria-hidden="true">⌕</span>
            <input v-model="query" type="search" placeholder="搜索设置" />
          </label>
          <button
            type="button"
            :class="{ active: activeSection === 'appearance' }"
            @click="activeSection = 'appearance'"
          >
            <span aria-hidden="true">◐</span> 外观与行为
          </button>
          <button
            type="button"
            :class="{ active: activeSection === 'shortcuts' }"
            @click="activeSection = 'shortcuts'"
          >
            <span aria-hidden="true">⌨</span> 快捷键
          </button>
        </aside>

        <section v-if="activeSection === 'shortcuts'" class="settings-content">
          <div class="settings-content-header">
            <div>
              <h3>快捷键</h3>
              <p>单击快捷键区域后按下新的按键组合。Esc 可取消录入。</p>
            </div>
            <button
              class="link-button"
              type="button"
              @click="draft = { ...defaultShortcutBindings }"
            >
              恢复默认
            </button>
          </div>

          <div class="shortcut-table" role="table" aria-label="快捷键绑定">
            <div class="shortcut-table-head" role="row"><span>操作</span><span>快捷键</span></div>
            <div
              v-for="action in filteredActions"
              :key="action.id"
              class="shortcut-row"
              :class="{ conflict: duplicateKeys.has(draft[action.id]) }"
              role="row"
            >
              <div class="shortcut-name">
                <span class="shortcut-group">{{ action.group }}</span>
                <strong>{{ action.label }}</strong>
                <small>{{ action.description }}</small>
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
                      ? '请按快捷键…'
                      : draft[action.id]
                        ? displayKey(draft[action.id])
                        : '未设置'
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
                <span v-if="duplicateKeys.has(draft[action.id])" class="conflict-label">冲突</span>
              </div>
            </div>
            <div v-if="filteredActions.length === 0" class="settings-empty">没有匹配的设置</div>
          </div>
          <p v-if="duplicateKeys.size" class="settings-warning">存在重复绑定，请先解决冲突。</p>
        </section>

        <section v-else class="settings-content">
          <div class="settings-content-header">
            <div>
              <h3>外观与行为</h3>
              <p>调整应用的显示方式。</p>
            </div>
          </div>
          <div class="settings-form-row">
            <div><strong>界面主题</strong><small>当前版本针对深色工作区优化</small></div>
            <select v-model="settings.theme" disabled>
              <option value="dark">深色</option>
            </select>
          </div>
        </section>
      </div>

      <footer class="settings-footer">
        <span>{{ changed ? '有尚未应用的更改' : '所有更改已应用' }}</span>
        <div>
          <button class="secondary-button" type="button" @click="emit('close')">取消</button>
          <button
            class="secondary-button"
            type="button"
            :disabled="!changed || duplicateKeys.size > 0"
            @click="apply"
          >
            应用
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="duplicateKeys.size > 0"
            @click="confirm"
          >
            确定
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
