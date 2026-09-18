<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@renderer/i18n'

import { getAudioPlayer } from '@renderer/services/audio-player'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import { shortcutActions, type ShortcutAction } from '@renderer/stores/settings'
import { formatTime } from '@renderer/utils/time'
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
const editActions = computed(() =>
  shortcutActions.filter((action) => !['工程'].includes(action.group))
)

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

function changeRate(event: Event): void {
  player.setPlaybackRate(Number((event.target as HTMLSelectElement).value))
}

function run(action: ShortcutAction | string): void {
  emit('command', action)
}
</script>

<template>
  <header class="unified-header" :class="{ mac: isMac, windows: !isMac }">
    <nav v-if="!isMac" class="header-menus" :aria-label="t('应用菜单')">
      <details>
        <summary>{{ t('文件') }}</summary>
        <div class="header-menu-popover">
          <button type="button" @click="run('newProject')">{{ t('新建') }}</button>
          <button type="button" @click="run('openProject')">{{ t('打开项目') }}</button>
          <details class="submenu">
            <summary>{{ t('最近项目') }} <span>›</span></summary>
            <div>
              <button
                v-for="recent in recentProjects"
                :key="recent.path"
                type="button"
                @click="emit('openRecent', recent.path)"
              >
                {{ recent.name }}
              </button>
              <span v-if="!recentProjects.length" class="menu-empty">{{ t('暂无最近项目') }}</span>
            </div>
          </details>
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
      </details>
      <details>
        <summary>{{ t('编辑') }}</summary>
        <div class="header-menu-popover edit-menu">
          <button
            v-for="action in editActions"
            :key="action.id"
            type="button"
            @click="run(action.id)"
          >
            <span>{{ t(action.label) }}</span><small>{{ t(action.group) }}</small>
          </button>
        </div>
      </details>
    </nav>

    <details class="project-document-menu">
      <summary :title="projectPath ?? t('未保存工程')">
        <span class="document-icon">▤</span>
        <span>{{ projectStore.dirty ? '● ' : '' }}{{ projectStore.project.name }}</span>
        <span class="chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="project-document-popover">
        <button type="button" @click="run('newProject')">＋ {{ t('新建工程') }}</button>
        <button type="button" @click="run('openProject')">{{ t('打开工程…') }}</button>
        <hr />
        <p>{{ t('最近工程') }}</p>
        <button
          v-for="recent in recentProjects"
          :key="recent.path"
          type="button"
          :title="recent.path"
          @click="emit('openRecent', recent.path)"
        >
          {{ recent.name }}
        </button>
        <span v-if="!recentProjects.length" class="menu-empty">{{ t('暂无最近工程') }}</span>
      </div>
    </details>

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
      <select :value="playerStore.playbackRate" :aria-label="t('播放速度')" @change="changeRate">
        <option :value="0.5">0.5×</option><option :value="0.75">0.75×</option>
        <option :value="1">1×</option><option :value="1.25">1.25×</option>
        <option :value="1.5">1.5×</option><option :value="2">2×</option>
      </select>
      <button type="button" class="header-settings" :title="t('设置')" @click="run('settings')">⚙</button>
    </div>
  </header>
</template>
