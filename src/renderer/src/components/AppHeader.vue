<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@renderer/i18n'

import { getAudioPlayer } from '@renderer/services/audio-player'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import {
  formatShortcut,
  shortcutActions,
  useSettingsStore,
  type ShortcutAction
} from '@renderer/stores/settings'
import { formatTime } from '@renderer/utils/time'
import BaseDropdown from '@renderer/components/ui/BaseDropdown.vue'
import BaseSelect from '@renderer/components/ui/BaseSelect.vue'
import type { RecentProject } from '@shared/ipc'

defineProps<{ recentProjects: RecentProject[]; projectPath: string | null; appVersion: string }>()
const emit = defineEmits<{
  command: [action: string]
  openRecent: [path: string]
}>()

const playerStore = usePlayerStore()
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const player = getAudioPlayer()
const { t } = useI18n()
const isMac = window.desktopApi.platform === 'darwin'
const shortcutLabel = (action: ShortcutAction): string =>
  formatShortcut(settingsStore.shortcuts[action], isMac)
const editGroups = computed(() => {
  const groups = new Map<string, (typeof shortcutActions)[number][]>()
  for (const action of shortcutActions) {
    if (action.group === 'project') continue
    const actions = groups.get(action.group) ?? []
    actions.push(action)
    groups.set(action.group, actions)
  }
  return Array.from(groups, ([label, actions]) => ({ label, actions }))
})
const playbackRateOptions = [0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => ({
  value,
  label: `${value}×`
}))
const volumePercent = computed(() => Math.round(playerStore.volume * 100))

async function togglePlayback(): Promise<void> {
  if (!playerStore.source) {
    emit('command', 'selectAudio')
    return
  }
  try {
    await player.toggle()
  } catch {
    playerStore.fail(t('playback_could_not_start_select_the_audio_again'))
  }
}

function changeVolume(event: Event): void {
  player.setVolume(Number((event.target as HTMLInputElement).value))
}

function changeRate(value: string | number): void {
  player.setPlaybackRate(Number(value))
}

function run(action: ShortcutAction | string): void {
  emit('command', action)
  window.dispatchEvent(new CustomEvent('base-dropdown-close-all'))
}

function openRecent(path: string): void {
  emit('openRecent', path)
  window.dispatchEvent(new CustomEvent('base-dropdown-close-all'))
}
</script>

<template>
  <header class="unified-header" :class="{ mac: isMac, windows: !isMac }">
    <nav v-if="!isMac" class="header-menus" :aria-label="t('application_menu')">
      <BaseDropdown group="header-primary" :close-groups-on-open="['header-secondary']">
        <template #trigger>{{ t('file') }}</template>
        <div class="header-menu-popover">
          <button type="button" @click="run('newProject')">{{ t('new') }}</button>
          <button type="button" @click="run('openProject')">
            <span>{{ t('open_project') }}</span><kbd>{{ shortcutLabel('openProject') }}</kbd>
          </button>
          <BaseDropdown class="submenu" group="header-secondary">
            <template #trigger>{{ t('recent_projects') }} <span>›</span></template>
            <div>
              <button
                v-for="recent in recentProjects"
                :key="recent.path"
                type="button"
                @click="openRecent(recent.path)"
              >
                {{ recent.name }}
              </button>
              <span v-if="!recentProjects.length" class="menu-empty">{{
                t('no_recent_projects_alternate')
              }}</span>
            </div>
          </BaseDropdown>
          <hr />
          <button type="button" @click="run('renameProject')">{{ t('rename_project') }}</button>
          <button type="button" @click="run('closeProject')">{{ t('close_project') }}</button>
          <button type="button" @click="run('saveProject')">
            <span>{{ t('save') }}</span><kbd>{{ shortcutLabel('saveProject') }}</kbd>
          </button>
          <button type="button" @click="run('saveHistory')">{{ t('view_save_history') }}</button>
          <hr />
          <button type="button" @click="run('selectAudio')">
            <span>{{ t('import_audio') }}</span><kbd>{{ shortcutLabel('selectAudio') }}</kbd>
          </button>
          <button type="button" @click="run('importLyrics')">
            <span>{{ t('import_lyrics') }}</span><kbd>{{ shortcutLabel('importLyrics') }}</kbd>
          </button>
          <button type="button" @click="run('exportLyrics')">
            <span>{{ t('export') }}</span><kbd>{{ shortcutLabel('exportLyrics') }}</kbd>
          </button>
        </div>
      </BaseDropdown>
      <BaseDropdown group="header-primary" :close-groups-on-open="['header-secondary']">
        <template #trigger>{{ t('edit') }}</template>
        <div class="header-menu-popover edit-menu">
          <BaseDropdown
            v-for="group in editGroups"
            :key="group.label"
            class="submenu"
            group="header-secondary"
          >
            <template #trigger>{{ t(group.label) }} <span>›</span></template>
            <div>
              <button
                v-for="action in group.actions"
                :key="action.id"
                type="button"
                :title="t(action.description)"
                @click="run(action.id)"
              >
                <span>{{ t(action.label) }}</span><kbd>{{ shortcutLabel(action.id) }}</kbd>
              </button>
            </div>
          </BaseDropdown>
        </div>
      </BaseDropdown>
      <BaseDropdown group="header-primary" :close-groups-on-open="['header-secondary']">
        <template #trigger>{{ t('help') }}</template>
        <div class="header-menu-popover help-menu">
          <span class="menu-version">{{ t('version') }} {{ appVersion || '—' }}</span>
        </div>
      </BaseDropdown>
    </nav>

    <BaseDropdown
      class="project-document-menu"
      group="header-primary"
      :close-groups-on-open="['header-secondary']"
    >
      <template #trigger>
        <span>{{ projectStore.dirty ? '● ' : '' }}{{ projectStore.project.name }}</span>
      </template>
      <div class="project-document-popover" :title="projectPath ?? t('unsaved_project')">
        <button type="button" @click="run('newProject')">＋ {{ t('new_project_alternate') }}</button>
        <button type="button" @click="run('openProject')">{{ t('open_project_dialog') }}</button>
        <hr />
        <p>{{ t('recent_projects') }}</p>
        <button
          v-for="recent in recentProjects"
          :key="recent.path"
          type="button"
          :title="recent.path"
          @click="openRecent(recent.path)"
        >
          {{ recent.name }}
        </button>
        <span v-if="!recentProjects.length" class="menu-empty">{{ t('no_recent_projects') }}</span>
      </div>
    </BaseDropdown>

    <div class="header-audio-controls">
      <button type="button" class="header-audio-file" @click="run('selectAudio')">
        {{ playerStore.fileName ?? t('select_audio') }}
      </button>
      <button
        type="button"
        class="header-play"
        :aria-label="playerStore.playing ? t('pause') : t('play')"
        @click="togglePlayback"
      >
        {{ playerStore.playing ? 'Ⅱ' : '▶' }}
      </button>
      <time class="header-time">
        <span>{{ formatTime(playerStore.currentTime) }}</span>
        <span class="header-time-separator">/</span>
        <span>{{ formatTime(playerStore.duration) }}</span>
      </time>
      <label class="header-volume" :title="`${t('volume')}: ${volumePercent}%`">
        <svg class="header-volume-icon" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 8h3l4-3.5v11L6 12H3z" />
          <path v-if="volumePercent > 0" d="M12.5 7a4 4 0 0 1 0 6" />
          <path v-if="volumePercent >= 50" d="M14.5 4.5a7.2 7.2 0 0 1 0 11" />
          <path v-if="volumePercent === 0" d="m13 8 4 4m0-4-4 4" />
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="playerStore.volume"
          :aria-label="t('volume')"
          @input="changeVolume"
        />
        <output>{{ volumePercent }}%</output>
      </label>
      <BaseSelect
        :model-value="playerStore.playbackRate"
        :options="playbackRateOptions"
        :aria-label="t('playback_speed')"
        @update:model-value="changeRate"
      />
      <button type="button" class="header-settings" :title="t('settings')" @click="run('settings')">
        ⚙
      </button>
    </div>
  </header>
</template>
