<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import LyricsImportDialog from '@renderer/components/LyricsImportDialog.vue'
import AppHeader from '@renderer/components/AppHeader.vue'
import LyricsPanel from '@renderer/components/LyricsPanel.vue'
import LyricsPreview from '@renderer/components/LyricsPreview.vue'
import ExportDialog from '@renderer/components/ExportDialog.vue'
import SettingsDialog from '@renderer/components/SettingsDialog.vue'
import TokenInspector from '@renderer/components/TokenInspector.vue'
import UnsavedChangesDialog from '@renderer/components/UnsavedChangesDialog.vue'
import Timeline from '@renderer/components/timeline/Timeline.vue'
import { useI18n } from '@renderer/i18n'
import { useGlobalShortcuts } from '@renderer/composables/use-global-shortcuts'
import { getAudioPlayer } from '@renderer/services/audio-player'
import { createLyricLines, lyricLinesToSource } from '@renderer/services/tokenizer'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import type { ProjectFileResult, RecentProject } from '@shared/ipc'
import { createEmptyProject, type TokenizerMode } from '@shared/models/project'

const { locale, setLocale, t } = useI18n()
setLocale(locale.value)
const ipcStatus = ref(t('正在检查…'))
const importOpen = ref(false)
const settingsOpen = ref(false)
const exportOpen = ref(false)
const unsavedChangesOpen = ref(false)
const savingBeforeContinue = ref(false)
const recentProjects = ref<RecentProject[]>([])
const workspace = ref<HTMLElement | null>(null)
const leftWidth = ref(28)
const leftTopHeight = ref(62)
const rightTopHeight = ref(58)
const projectStore = useProjectStore()
const playerStore = usePlayerStore()
const player = getAudioPlayer()
const projectPath = ref<string | null>(null)
const fileStatus = ref('')
let autosaveTimer: ReturnType<typeof setInterval> | null = null
let removeAppCloseListener: (() => void) | null = null
let pendingAction: (() => void | Promise<void>) | null = null
watch(
  () => projectStore.dirty,
  (dirty) => window.desktopApi?.setProjectDirty(dirty),
  { immediate: true }
)

useGlobalShortcuts()

type ResizeTarget = 'columns' | 'left-rows' | 'right-rows'
let resizing: ResizeTarget | null = null

const workspaceStyle = computed(() => ({
  '--left-width': `${leftWidth.value}%`,
  '--left-top-height': `${leftTopHeight.value}%`,
  '--right-top-height': `${rightTopHeight.value}%`
}))
const editableLyrics = computed(() => lyricLinesToSource(projectStore.project.lines))

function beginResize(target: ResizeTarget, event: PointerEvent): void {
  resizing = target
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  document.body.classList.add('is-resizing')
}

function resizeWorkspace(event: PointerEvent): void {
  if (!resizing || !workspace.value) return
  const bounds = workspace.value.getBoundingClientRect()
  if (resizing === 'columns') {
    leftWidth.value = Math.min(
      Math.max(((event.clientX - bounds.left) / bounds.width) * 100, 20),
      45
    )
    return
  }

  const column = (event.target as HTMLElement).closest<HTMLElement>('.workspace-column')
  if (!column) return
  const columnBounds = column.getBoundingClientRect()
  const value = ((event.clientY - columnBounds.top) / columnBounds.height) * 100
  if (resizing === 'left-rows') leftTopHeight.value = Math.min(Math.max(value, 28), 76)
  else rightTopHeight.value = Math.min(Math.max(value, 28), 76)
}

function endResize(event: PointerEvent): void {
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  resizing = null
  document.body.classList.remove('is-resizing')
}

function importLyrics(payload: { text: string; mode: TokenizerMode }): void {
  projectStore.importLyrics(createLyricLines(payload.text, payload.mode), payload.mode)
}

function resetProject(): void {
  player.pause()
  playerStore.source = null
  playerStore.fileName = null
  playerStore.currentTime = 0
  playerStore.duration = 0
  projectStore.loadProject(createEmptyProject())
  projectPath.value = null
  fileStatus.value = t('新工程')
}

function continueAfterUnsavedCheck(action: () => void | Promise<void>): void {
  if (!projectStore.dirty) {
    void action()
    return
  }
  pendingAction = action
  unsavedChangesOpen.value = true
}

function cancelPendingAction(): void {
  if (savingBeforeContinue.value) return
  pendingAction = null
  unsavedChangesOpen.value = false
}

async function runPendingAction(): Promise<void> {
  const action = pendingAction
  pendingAction = null
  unsavedChangesOpen.value = false
  if (action) await action()
}

async function saveAndRunPendingAction(): Promise<void> {
  savingBeforeContinue.value = true
  const saved = await saveProject()
  savingBeforeContinue.value = false
  if (saved) await runPendingAction()
}

function newProject(): void {
  continueAfterUnsavedCheck(resetProject)
}

function finishClosingProject(): void {
  resetProject()
  fileStatus.value = t('工程已关闭')
}

function closeProject(): void {
  continueAfterUnsavedCheck(finishClosingProject)
}

function renameProject(): void {
  const name = window.prompt(t('工程名称'), projectStore.project.name)
  if (name) projectStore.setProjectName(name)
}

function showSaveHistory(): void {
  const records = recentProjects.value
    .map((item) => `${new Date(item.lastOpenedAt).toLocaleString()}  ${item.name}`)
    .join('\n')
  window.alert(records || t('暂无保存记录'))
}

function handleCommand(action: string): void {
  const handlers: Record<string, () => void> = {
    newProject,
    openProject: () => void openProject(),
    saveProject: () => void saveProject(),
    renameProject,
    closeProject,
    saveHistory: showSaveHistory,
    importLyrics: openLyricsImport,
    exportLyrics: openLyricsExport,
    selectAudio: () => window.dispatchEvent(new CustomEvent('audio-select')),
    settings: () => (settingsOpen.value = true)
  }
  const handler = handlers[action]
  if (handler) handler()
  else window.dispatchEvent(new CustomEvent('app-shortcut', { detail: action }))
}

function handleNativeCommand(event: Event): void {
  const action = (event as CustomEvent<string>).detail
  if (action.startsWith('openRecent:')) {
    void openRecentProject(action.slice('openRecent:'.length))
  } else {
    handleCommand(action)
  }
}

function openLyricsImport(): void {
  importOpen.value = true
}

function openLyricsExport(): void {
  if (projectStore.project.lines.length) exportOpen.value = true
}

function loadAudio(selection: ProjectFileResult['audio']): void {
  if (!selection) {
    playerStore.source = null
    playerStore.fileName = null
    return
  }
  playerStore.beginLoad(selection.url, selection.name)
  player.load(selection.url)
}

async function applyLoadedProject(result: ProjectFileResult): Promise<void> {
  projectStore.loadProject(result.project)
  if (!result.path) projectStore.dirty = true
  projectPath.value = result.path
  loadAudio(result.audio)
  fileStatus.value = result.path ? t('工程已打开') : t('已恢复自动保存')
  if (result.audioMissing && window.confirm(t('工程引用的音频不存在。是否现在重新定位音频？'))) {
    const selection = await window.desktopApi.selectAudio()
    if (selection) {
      projectStore.setAudio({
        path: selection.path,
        name: selection.name,
        duration: result.project.audio?.duration ?? null
      })
      loadAudio(selection)
      fileStatus.value = t('已重新定位音频，请保存工程')
    }
  }
}

async function refreshRecentProjects(): Promise<void> {
  recentProjects.value = await window.desktopApi.listRecentProjects()
}

async function saveProject(): Promise<boolean> {
  try {
    const result = await window.desktopApi.saveProject(
      projectStore.snapshot(),
      projectPath.value ?? undefined
    )
    if (!result) return false
    projectPath.value = result.path
    projectStore.markSaved()
    fileStatus.value = t('已保存')
    await refreshRecentProjects()
    return true
  } catch (error) {
    fileStatus.value = error instanceof Error ? error.message : t('保存失败')
    return false
  }
}

async function openProject(): Promise<void> {
  continueAfterUnsavedCheck(openProjectFile)
}

async function openProjectFile(): Promise<void> {
  try {
    const result = await window.desktopApi.openProject()
    if (result) {
      await applyLoadedProject(result)
      await refreshRecentProjects()
    }
  } catch (error) {
    fileStatus.value = error instanceof Error ? error.message : t('打开失败')
  }
}

async function openRecentProject(path: string): Promise<void> {
  continueAfterUnsavedCheck(() => openRecentProjectFile(path))
}

async function openRecentProjectFile(path: string): Promise<void> {
  try {
    const result = await window.desktopApi.openRecentProject(path)
    if (!result) {
      fileStatus.value = t('工程文件不存在或无法读取')
      await refreshRecentProjects()
      return
    }
    await applyLoadedProject(result)
    await refreshRecentProjects()
  } catch (error) {
    fileStatus.value = error instanceof Error ? error.message : t('打开最近工程失败')
  }
}

onUnmounted(() => {
  document.body.classList.remove('is-resizing')
  window.removeEventListener('project-save', saveProject)
  window.removeEventListener('project-open', openProject)
  window.removeEventListener('lyrics-import', openLyricsImport)
  window.removeEventListener('lyrics-export', openLyricsExport)
  window.removeEventListener('app-command', handleNativeCommand)
  removeAppCloseListener?.()
  if (autosaveTimer) clearInterval(autosaveTimer)
})

onMounted(async () => {
  window.addEventListener('project-save', saveProject)
  window.addEventListener('project-open', openProject)
  window.addEventListener('lyrics-import', openLyricsImport)
  window.addEventListener('lyrics-export', openLyricsExport)
  window.addEventListener('app-command', handleNativeCommand)
  removeAppCloseListener = window.desktopApi.onAppCloseRequested(() => {
    continueAfterUnsavedCheck(() => window.desktopApi.confirmAppClose())
  })
  autosaveTimer = setInterval(async () => {
    if (!projectStore.dirty) return
    try {
      await window.desktopApi.autosaveProject(projectStore.snapshot())
      fileStatus.value = t('已自动保存')
    } catch {
      fileStatus.value = t('自动保存失败')
    }
  }, 30_000)
  try {
    const bridgeReady = (await window.desktopApi.ping()) === 'pong'
    ipcStatus.value = bridgeReady ? 'Main / Preload / Renderer OK' : t('响应异常')
    if (bridgeReady && import.meta.env.DEV) console.info('[Lyric Timeline] IPC bridge ready')
    await refreshRecentProjects()
    const autosave = bridgeReady ? await window.desktopApi.loadAutosave() : null
    if (autosave) {
      await applyLoadedProject(autosave)
    } else if (bridgeReady) {
      const latest = await window.desktopApi.loadLastProject()
      if (latest) {
        await applyLoadedProject(latest)
        fileStatus.value = t('已自动打开上次工程')
        await refreshRecentProjects()
      }
    }
  } catch {
    ipcStatus.value = t('IPC 不可用')
  }
})
</script>

<template>
  <main class="shell">
    <AppHeader
      :recent-projects="recentProjects"
      :project-path="projectPath"
      @command="handleCommand"
      @open-recent="openRecentProject"
    />

    <section class="workspace">
      <div
        ref="workspace"
        class="workspace-layout"
        :style="workspaceStyle"
        @pointermove="resizeWorkspace"
      >
        <aside class="workspace-column tool-workspace">
          <div class="workspace-pane"><LyricsPanel @request-import="importOpen = true" /></div>
          <div
            class="splitter splitter-horizontal"
            role="separator"
            :aria-label="t('调整歌词与属性面板高度')"
            @pointerdown="beginResize('left-rows', $event)"
            @pointerup="endResize"
            @pointercancel="endResize"
          />
          <div class="workspace-pane"><TokenInspector /></div>
        </aside>

        <div
          class="splitter splitter-vertical"
          role="separator"
          :aria-label="t('调整工具区宽度')"
          @pointerdown="beginResize('columns', $event)"
          @pointerup="endResize"
          @pointercancel="endResize"
        />

        <section class="workspace-column edit-workspace">
          <LyricsPreview />
          <div
            class="splitter splitter-horizontal"
            role="separator"
            :aria-label="t('调整预览与时间轴高度')"
            @pointerdown="beginResize('right-rows', $event)"
            @pointerup="endResize"
            @pointercancel="endResize"
          />
          <div class="workspace-pane timeline-pane"><Timeline /></div>
        </section>
      </div>
    </section>

    <footer class="statusbar">
      <span class="status-dot" />
      {{ ipcStatus }}
      <span v-if="fileStatus"> · {{ fileStatus }}</span>
    </footer>

    <LyricsImportDialog
      :open="importOpen"
      :initial-text="editableLyrics"
      :initial-mode="projectStore.project.settings.tokenizer"
      @close="importOpen = false"
      @import="importLyrics"
    />
    <SettingsDialog :open="settingsOpen" @close="settingsOpen = false" />
    <ExportDialog :open="exportOpen" @close="exportOpen = false" />
    <UnsavedChangesDialog
      :open="unsavedChangesOpen"
      :project-name="projectStore.project.name"
      :saving="savingBeforeContinue"
      @cancel="cancelPendingAction"
      @discard="runPendingAction"
      @save="saveAndRunPendingAction"
    />
  </main>
</template>
