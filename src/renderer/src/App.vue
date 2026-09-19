<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import LyricsImportDialog from '@renderer/components/LyricsImportDialog.vue'
import LyricsPreprocessDialog from '@renderer/components/LyricsPreprocessDialog.vue'
import AppHeader from '@renderer/components/AppHeader.vue'
import LyricsPanel from '@renderer/components/LyricsPanel.vue'
import LyricsPreview from '@renderer/components/LyricsPreview.vue'
import ExportDialog from '@renderer/components/ExportDialog.vue'
import SettingsDialog from '@renderer/components/SettingsDialog.vue'
import TokenInspector from '@renderer/components/TokenInspector.vue'
import TokenStructureDialog from '@renderer/components/TokenStructureDialog.vue'
import UnsavedChangesDialog from '@renderer/components/UnsavedChangesDialog.vue'
import SaveHistoryDialog from '@renderer/components/SaveHistoryDialog.vue'
import WindowOpenDialog from '@renderer/components/WindowOpenDialog.vue'
import Timeline from '@renderer/components/timeline/Timeline.vue'
import { useI18n } from '@renderer/i18n'
import { useGlobalShortcuts } from '@renderer/composables/use-global-shortcuts'
import { getAudioPlayer } from '@renderer/services/audio-player'
import { createLyricLines, lyricLinesToSource } from '@renderer/services/tokenizer'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import { useSettingsStore } from '@renderer/stores/settings'
import { useTimelineStore } from '@renderer/stores/timeline'
import type { IntegrationOpenResult, ProjectFileResult, RecentProject } from '@shared/ipc'
import { createEmptyProject, type TokenizerMode } from '@shared/models/project'

const { locale, setLocale, t } = useI18n()
setLocale(locale.value)
const ipcStatus = ref(t('checking'))
const importOpen = ref(false)
const preprocessOpen = ref(false)
const importDraft = ref<string | null>(null)
const appVersion = ref('')
const settingsOpen = ref(false)
const exportOpen = ref(false)
const unsavedChangesOpen = ref(false)
const saveHistoryOpen = ref(false)
const windowOpenDialogOpen = ref(false)
const savingBeforeContinue = ref(false)
const recentProjects = ref<RecentProject[]>([])
const workspace = ref<HTMLElement | null>(null)
const leftWidth = ref(28)
const leftTopHeight = ref(62)
const rightTopHeight = ref(58)
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const playerStore = usePlayerStore()
const timelineStore = useTimelineStore()
const player = getAudioPlayer()
const projectPath = ref<string | null>(null)
const fileStatus = ref('')
const lastAutosavedAt = ref<number | null>(null)
let lastAutosaveFingerprint = ''
let autosaveTimer: ReturnType<typeof setInterval> | null = null
let removeAppCloseListener: (() => void) | null = null
let removeIntegrationListener: (() => void) | null = null
let removeRecentProjectsListener: (() => void) | null = null
let pendingAction: (() => void | Promise<void>) | null = null
const pendingWindowOperation = ref<{ type: 'new' | 'open' | 'recent'; path?: string } | null>(null)
const windowSessionId = crypto.randomUUID()
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
const autosaveStatus = computed(() => {
  if (!settingsStore.autosaveEnabled) return t('autosave_disabled_status')
  if (lastAutosavedAt.value) {
    return t('autosave_last_saved_at', {
      time: new Date(lastAutosavedAt.value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    })
  }
  return t('autosave_enabled_interval', {
    minutes: Math.max(1, Math.round(settingsStore.autosaveIntervalMs / 60_000))
  })
})

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

function applyPlayerSong(request: IntegrationOpenResult): void {
  const { payload, audio } = request
  const project = createEmptyProject()
  project.name = payload.title || audio.name.replace(/\.[^.]+$/u, '')
  project.audio = { path: audio.path, name: audio.name, duration: null }
  project.metadata = {
    title: payload.title,
    artist: payload.artist,
    album: payload.album
  }
  project.lines = createLyricLines(payload.lyrics, project.settings.tokenizer)
  project.updatedAt = Date.now()
  projectStore.loadProject(project)
  projectStore.dirty = true
  projectPath.value = null
  loadAudio(audio)
  fileStatus.value = t('opened_from_player')
}

function openPlayerSong(request: IntegrationOpenResult): void {
  continueAfterUnsavedCheck(() => applyPlayerSong(request))
}

function resetProject(): void {
  player.pause()
  playerStore.source = null
  playerStore.fileName = null
  playerStore.currentTime = 0
  playerStore.duration = 0
  projectStore.loadProject(createEmptyProject())
  projectPath.value = null
  lastAutosavedAt.value = null
  lastAutosaveFingerprint = JSON.stringify(projectStore.snapshot())
  fileStatus.value = t('new_project')
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

async function runPendingAction(clearAutosave = false): Promise<void> {
  const action = pendingAction
  pendingAction = null
  unsavedChangesOpen.value = false
  if (clearAutosave) await window.desktopApi.clearAutosave(projectStore.project.id, windowSessionId)
  if (action) await action()
}

async function saveAndRunPendingAction(): Promise<void> {
  savingBeforeContinue.value = true
  const saved = await saveProject()
  savingBeforeContinue.value = false
  if (saved) await runPendingAction()
}

function requestWindowChoice(operation: { type: 'new' | 'open' | 'recent'; path?: string }): void {
  pendingWindowOperation.value = operation
  windowOpenDialogOpen.value = true
}

function cancelWindowChoice(): void {
  pendingWindowOperation.value = null
  windowOpenDialogOpen.value = false
}

function useCurrentWindow(): void {
  const operation = pendingWindowOperation.value
  cancelWindowChoice()
  if (!operation) return
  if (operation.type === 'new') continueAfterUnsavedCheck(resetProject)
  else if (operation.type === 'open') continueAfterUnsavedCheck(openProjectFile)
  else {
    const path = operation.path
    if (path) continueAfterUnsavedCheck(() => openRecentProjectFile(path))
  }
}

async function useNewWindow(): Promise<void> {
  const operation = pendingWindowOperation.value
  cancelWindowChoice()
  if (!operation) return
  try {
    if (operation.type === 'new') await window.desktopApi.createProjectWindow()
    else if (operation.type === 'open') await window.desktopApi.openProjectInNewWindow()
    else if (operation.path) {
      const opened = await window.desktopApi.openRecentProjectInNewWindow(operation.path)
      if (!opened) {
        fileStatus.value = t('project_file_is_missing_or_unreadable')
        await refreshRecentProjects()
      }
    }
  } catch (error) {
    fileStatus.value = error instanceof Error ? error.message : t('open_failed')
  }
}

function newProject(): void {
  requestWindowChoice({ type: 'new' })
}

function finishClosingProject(): void {
  resetProject()
  fileStatus.value = t('project_closed')
}

function closeProject(): void {
  continueAfterUnsavedCheck(finishClosingProject)
}

function renameProject(): void {
  const name = window.prompt(t('project_name'), projectStore.project.name)
  if (name) projectStore.setProjectName(name)
}

function showSaveHistory(): void {
  saveHistoryOpen.value = true
}

async function restoreSaveHistory(result: ProjectFileResult): Promise<void> {
  const currentPath = projectPath.value
  await applyLoadedProject({ ...result, path: currentPath })
  projectStore.dirty = true
  lastAutosaveFingerprint = ''
  fileStatus.value = t('archive_restored_save_to_keep_changes')
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
  importDraft.value = null
  importOpen.value = true
}

function applyPreprocessedLyrics(text: string): void {
  preprocessOpen.value = false
  importDraft.value = text
  importOpen.value = true
}

function openLyricsPreprocess(): void {
  if (projectStore.project.lines.length) preprocessOpen.value = true
}

function applyAutomaticTiming(): void {
  const duration =
    playerStore.duration ||
    timelineStore.waveform?.duration ||
    projectStore.project.audio?.duration ||
    0
  if (duration <= 0) {
    fileStatus.value = t('import_audio_before_using_auto_timing')
    return
  }
  fileStatus.value = projectStore.applyAutomaticTiming(duration)
    ? t('auto_timing_completed')
    : t('there_are_no_tokens_available_for_auto_timing')
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
  lastAutosavedAt.value = null
  lastAutosaveFingerprint = JSON.stringify(projectStore.snapshot())
  loadAudio(result.audio)
  fileStatus.value = result.path ? t('project_opened') : t('autosave_restored')
  if (result.audioMissing && window.confirm(t('the_project_audio_is_missing_locate_it_now'))) {
    const selection = await window.desktopApi.selectAudio()
    if (selection) {
      projectStore.setAudio({
        path: selection.path,
        name: selection.name,
        duration: result.project.audio?.duration ?? null
      })
      loadAudio(selection)
      fileStatus.value = t('audio_relocated_please_save_the_project')
    }
  }
}

async function refreshRecentProjects(): Promise<void> {
  recentProjects.value = await window.desktopApi.listRecentProjects()
}

async function saveProject(): Promise<boolean> {
  try {
    const snapshot = projectStore.snapshot()
    const result = await window.desktopApi.saveProject(
      snapshot,
      projectPath.value ?? undefined,
      windowSessionId
    )
    if (!result) return false
    projectPath.value = result.path
    if (JSON.stringify(projectStore.snapshot()) === JSON.stringify(snapshot))
      projectStore.markSaved()
    lastAutosaveFingerprint = JSON.stringify(snapshot)
    fileStatus.value = t('saved')
    await refreshRecentProjects()
    return true
  } catch (error) {
    fileStatus.value = error instanceof Error ? error.message : t('save_failed')
    return false
  }
}

function openProject(): void {
  requestWindowChoice({ type: 'open' })
}

async function openProjectFile(): Promise<void> {
  try {
    const result = await window.desktopApi.openProject()
    if (result) {
      await applyLoadedProject(result)
      await refreshRecentProjects()
    }
  } catch (error) {
    fileStatus.value = error instanceof Error ? error.message : t('open_failed')
  }
}

function openRecentProject(path: string): void {
  requestWindowChoice({ type: 'recent', path })
}

async function openRecentProjectFile(path: string): Promise<void> {
  try {
    const result = await window.desktopApi.openRecentProject(path)
    if (!result) {
      fileStatus.value = t('project_file_is_missing_or_unreadable')
      await refreshRecentProjects()
      return
    }
    await applyLoadedProject(result)
    await refreshRecentProjects()
  } catch (error) {
    fileStatus.value = error instanceof Error ? error.message : t('could_not_open_recent_project')
  }
}

onUnmounted(() => {
  document.body.classList.remove('is-resizing')
  window.removeEventListener('project-save', saveProject)
  window.removeEventListener('project-open', openProject)
  window.removeEventListener('lyrics-import', openLyricsImport)
  window.removeEventListener('lyrics-export', openLyricsExport)
  window.removeEventListener('lyrics-preprocess', openLyricsPreprocess)
  window.removeEventListener('automatic-timing', applyAutomaticTiming)
  window.removeEventListener('app-command', handleNativeCommand)
  removeAppCloseListener?.()
  removeIntegrationListener?.()
  removeRecentProjectsListener?.()
  if (autosaveTimer) clearInterval(autosaveTimer)
})

onMounted(async () => {
  window.addEventListener('project-save', saveProject)
  window.addEventListener('project-open', openProject)
  window.addEventListener('lyrics-import', openLyricsImport)
  window.addEventListener('lyrics-export', openLyricsExport)
  window.addEventListener('lyrics-preprocess', openLyricsPreprocess)
  window.addEventListener('automatic-timing', applyAutomaticTiming)
  window.addEventListener('app-command', handleNativeCommand)
  removeAppCloseListener = window.desktopApi.onAppCloseRequested(() => {
    continueAfterUnsavedCheck(() => window.desktopApi.confirmAppClose())
  })
  removeIntegrationListener = window.desktopApi.onIntegrationOpen(openPlayerSong)
  removeRecentProjectsListener = window.desktopApi.onRecentProjectsChanged(() => {
    void refreshRecentProjects()
  })
  const installAutosaveTimer = (): void => {
    if (autosaveTimer) clearInterval(autosaveTimer)
    autosaveTimer = null
    if (!settingsStore.autosaveEnabled) return
    autosaveTimer = setInterval(async () => {
      if (!projectStore.dirty) return
      const snapshot = projectStore.snapshot()
      const fingerprint = JSON.stringify(snapshot)
      if (fingerprint === lastAutosaveFingerprint) return
      try {
        await window.desktopApi.autosaveProject(
          snapshot,
          windowSessionId,
          projectPath.value ?? undefined
        )
        lastAutosaveFingerprint = fingerprint
        lastAutosavedAt.value = Date.now()
        fileStatus.value = t('autosaved')
      } catch {
        fileStatus.value = t('autosave_failed')
      }
    }, settingsStore.autosaveIntervalMs)
  }
  installAutosaveTimer()
  watch(
    () => [settingsStore.autosaveEnabled, settingsStore.autosaveIntervalMs],
    installAutosaveTimer
  )
  try {
    appVersion.value = await window.desktopApi.getAppVersion()
    const bridgeReady = (await window.desktopApi.ping()) === 'pong'
    ipcStatus.value = bridgeReady ? 'OK' : t('unexpected_response')
    if (bridgeReady && import.meta.env.DEV) console.info('[Lyric Timeline] IPC bridge ready')
    await refreshRecentProjects()
    const launch = bridgeReady ? await window.desktopApi.takeWindowLaunch() : null
    if (launch?.type === 'new') {
      resetProject()
      return
    }
    if (launch?.type === 'project') {
      await applyLoadedProject(launch.result)
      await refreshRecentProjects()
      return
    }
    const integration = bridgeReady ? await window.desktopApi.takePendingIntegration() : null
    if (integration) {
      applyPlayerSong(integration)
      return
    }
    const autosave = bridgeReady ? await window.desktopApi.loadAutosave() : null
    if (autosave) {
      await applyLoadedProject(autosave)
    } else if (bridgeReady) {
      const latest = await window.desktopApi.loadLastProject()
      if (latest) {
        await applyLoadedProject(latest)
        fileStatus.value = t('last_project_opened_automatically')
        await refreshRecentProjects()
      }
    }
  } catch {
    ipcStatus.value = t('ipc_unavailable')
  }
})
</script>

<template>
  <main class="shell">
    <AppHeader
      :app-version="appVersion"
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
          <div class="workspace-pane">
            <LyricsPanel
              @request-import="openLyricsImport"
              @request-preprocess="preprocessOpen = true"
            />
          </div>
          <div
            class="splitter splitter-horizontal"
            role="separator"
            :aria-label="t('resize_lyrics_and_inspector_panels')"
            @pointerdown="beginResize('left-rows', $event)"
            @pointerup="endResize"
            @pointercancel="endResize"
          />
          <div class="workspace-pane"><TokenInspector /></div>
        </aside>

        <div
          class="splitter splitter-vertical"
          role="separator"
          :aria-label="t('resize_tool_area')"
          @pointerdown="beginResize('columns', $event)"
          @pointerup="endResize"
          @pointercancel="endResize"
        />

        <section class="workspace-column edit-workspace">
          <LyricsPreview />
          <div
            class="splitter splitter-horizontal"
            role="separator"
            :aria-label="t('resize_preview_and_timeline')"
            @pointerdown="beginResize('right-rows', $event)"
            @pointerup="endResize"
            @pointercancel="endResize"
          />
          <div class="workspace-pane timeline-pane"><Timeline /></div>
        </section>
      </div>
    </section>

    <footer class="statusbar">
      <span class="status-dot" :class="{ off: !settingsStore.autosaveEnabled }" />
      {{ ipcStatus }}
      <span>· {{ autosaveStatus }}</span>
      <span v-if="fileStatus"> · {{ fileStatus }}</span>
    </footer>

    <LyricsImportDialog
      :open="importOpen"
      :initial-text="importDraft ?? editableLyrics"
      :initial-mode="projectStore.project.settings.tokenizer"
      @close="importOpen = false; importDraft = null"
      @import="importLyrics"
    />
    <LyricsPreprocessDialog
      :open="preprocessOpen"
      :source="editableLyrics"
      @close="preprocessOpen = false"
      @apply="applyPreprocessedLyrics"
    />
    <SettingsDialog :open="settingsOpen" @close="settingsOpen = false" />
    <SaveHistoryDialog
      :open="saveHistoryOpen"
      :project-id="projectStore.project.id"
      :project-name="projectStore.project.name"
      :project-path="projectPath"
      @close="saveHistoryOpen = false"
      @restored="restoreSaveHistory"
    />
    <WindowOpenDialog
      :open="windowOpenDialogOpen"
      :operation="pendingWindowOperation?.type === 'new' ? 'new' : 'open'"
      @cancel="cancelWindowChoice"
      @current="useCurrentWindow"
      @new-window="useNewWindow"
    />
    <ExportDialog :open="exportOpen" @close="exportOpen = false" />
    <TokenStructureDialog />
    <UnsavedChangesDialog
      :open="unsavedChangesOpen"
      :project-name="projectStore.project.name"
      :saving="savingBeforeContinue"
      @cancel="cancelPendingAction"
      @discard="runPendingAction(true)"
      @save="saveAndRunPendingAction"
    />
  </main>
</template>
