<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@renderer/i18n'

import { getAudioPlayer } from '@renderer/services/audio-player'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import { shortcutActions, type ShortcutAction } from '@renderer/stores/settings'
import { formatTime } from '@renderer/utils/time'
import BaseDropdown from '@renderer/components/ui/BaseDropdown.vue'
import BaseSelect from '@renderer/components/ui/BaseSelect.vue'
import type { RecentProject } from '@shared/ipc'

defineProps<{ recentProjects: RecentProject[]; projectPath: string | null }>()
const emit = defineEmits<{
  command: [action: string]
  openRecent: [path: string]
}>()

const playerStore = usePlayerStore()
const projectStore = useProjectStore()
const player = getAudioPlayer()
const { t } = useI18n()
const isMac = window.desktopApi.platform === 'darwin'
const editGroups = computed(() => {
  const groups = new Map<string, (typeof shortcutActions)[number][]>()
  for (const action of shortcutActions) {
    if (action.group === '工程') continue
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

async function togglePlayback(): Promise<void> {
  if (!playerStore.source) {
    emit('command', 'selectAudio')
    return
  }
  try {
    await player.toggle()
  } catch {
    playerStore.fail(t('无法开始播放，请重新选择音频'))
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
    <nav v-if="!isMac" class="header-menus" :aria-label="t('应用菜单')">
      <BaseDropdown group="header-primary" :close-groups-on-open="['header-secondary']">
        <template #trigger>{{ t('文件') }}</template>
        <div class="header-menu-popover">
          <button type="button" @click="run('newProject')">{{ t('新建') }}</button>
          <button type="button" @click="run('openProject')">{{ t('打开项目') }}</button>
          <BaseDropdown
            class="submenu"
            group="header-secondary"
          >
            <template #trigger>{{ t('最近项目') }} <span>›</span></template>
            <div>
              <button
                v-for="recent in recentProjects"
                :key="recent.path"
                type="button"
                @click="openRecent(recent.path)"
              >
                {{ recent.name }}
              </button>
              <span v-if="!recentProjects.length" class="menu-empty">{{ t('暂无最近项目') }}</span>
            </div>
          </BaseDropdown>
          <hr />
          <button type="button" @click="run('renameProject')">{{ t('重命名项目') }}</button>
          <button type="button" @click="run('closeProject')">{{ t('关闭项目') }}</button>
          <button type="button" @click="run('saveProject')">{{ t('保存') }}</button>
          <button type="button" @click="run('saveHistory')">{{ t('查看保存记录') }}</button>
          <hr />
          <button type="button" @click="run('selectAudio')">{{ t('导入歌曲') }}</button>
          <button type="button" @click="run('importLyrics')">{{ t('导入歌词') }}</button>
          <button type="button" @click="run('exportLyrics')">{{ t('导出') }}</button>
        </div>
      </BaseDropdown>
      <BaseDropdown group="header-primary" :close-groups-on-open="['header-secondary']">
        <template #trigger>{{ t('编辑') }}</template>
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
                {{ t(action.label) }}
              </button>
            </div>
          </BaseDropdown>
        </div>
      </BaseDropdown>
    </nav>

    <BaseDropdown
      class="project-document-menu"
      group="header-primary"
      :close-groups-on-open="['header-secondary']"
    >
      <template #trigger>
        <span class="document-icon">▤</span>
        <span>{{ projectStore.dirty ? '● ' : '' }}{{ projectStore.project.name }}</span>
        <span class="chevron" aria-hidden="true">⌄</span>
      </template>
      <div class="project-document-popover" :title="projectPath ?? t('未保存工程')">
        <button type="button" @click="run('newProject')">＋ {{ t('新建工程') }}</button>
        <button type="button" @click="run('openProject')">{{ t('打开工程…') }}</button>
        <hr />
        <p>{{ t('最近工程') }}</p>
        <button
          v-for="recent in recentProjects"
          :key="recent.path"
          type="button"
          :title="recent.path"
          @click="openRecent(recent.path)"
        >
          {{ recent.name }}
        </button>
        <span v-if="!recentProjects.length" class="menu-empty">{{ t('暂无最近工程') }}</span>
      </div>
    </BaseDropdown>

    <div class="header-audio-controls">
      <button type="button" class="header-audio-file" @click="run('selectAudio')">
        {{ playerStore.fileName ?? t('选择音频') }}
      </button>
      <button
        type="button"
        class="header-play"
        :aria-label="playerStore.playing ? t('暂停') : t('播放')"
        @click="togglePlayback"
      >
        {{ playerStore.playing ? 'Ⅱ' : '▶' }}
      </button>
      <time>{{ formatTime(playerStore.currentTime) }}</time>
      <label class="header-volume">
        <span>◖</span>
        <input type="range" min="0" max="1" step="0.01" :value="playerStore.volume" @input="changeVolume" />
      </label>
      <BaseSelect
        :model-value="playerStore.playbackRate"
        :options="playbackRateOptions"
        :aria-label="t('播放速度')"
        @update:model-value="changeRate"
      />
      <button type="button" class="header-settings" :title="t('设置')" @click="run('settings')">⚙</button>
    </div>
  </header>
</template>
