import { onMounted, onUnmounted } from 'vue'

import { getAudioPlayer } from '@renderer/services/audio-player'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import {
  matchesShortcut,
  shortcutActions,
  type ShortcutAction,
  useSettingsStore
} from '@renderer/stores/settings'
import { useTimelineStore } from '@renderer/stores/timeline'
import { useHistoryStore } from '@renderer/stores/history'

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

export function useGlobalShortcuts(): void {
  const player = getAudioPlayer()
  const playerStore = usePlayerStore()
  const projectStore = useProjectStore()
  const timelineStore = useTimelineStore()
  const settingsStore = useSettingsStore()
  const historyStore = useHistoryStore()
  let removeMenuListener: (() => void) | null = null

  async function executeAction(action: ShortcutAction, repeated = false): Promise<void> {
    const duration = playerStore.duration || timelineStore.waveform?.duration || 0

    const applicationEvents: Partial<Record<typeof action, string>> = {
      openProject: 'project-open',
      saveProject: 'project-save',
      importLyrics: 'lyrics-import',
      preprocessLyrics: 'lyrics-preprocess',
      exportLyrics: 'lyrics-export',
      selectAudio: 'audio-select',
      focusTokenSplit: 'token-split-focus'
    }
    const applicationEvent = applicationEvents[action]
    if (applicationEvent) {
      window.dispatchEvent(new CustomEvent(applicationEvent))
      return
    }

    if (action === 'undo') {
      historyStore.undo()
      return
    }
    if (action === 'redo') {
      historyStore.redo()
      return
    }

    if (action === 'playPause') {
      if (!playerStore.source) return
      try {
        await player.toggle()
      } catch {
        playerStore.fail('无法开始播放，请重新选择音频')
      }
      return
    }

    if (action === 'markToken') {
      if (repeated || !playerStore.source || !projectStore.activeToken) return
      const time = playerStore.currentTime + projectStore.project.settings.timingOffsetMs / 1000
      projectStore.markCurrentToken(time)
      return
    }

    if (action === 'locateToken') {
      const start = projectStore.activeToken?.start
      if (start !== null && start !== undefined) {
        timelineStore.locateTime(start, duration)
        player.seek(start)
      }
      return
    }

    if (action === 'toggleLoop') {
      if (timelineStore.loopEnabled) {
        timelineStore.disableLoop()
      } else {
        const token = projectStore.activeToken
        if (token?.start !== null && token?.start !== undefined && token.end !== null && token.end > token.start) {
          timelineStore.enableLoop(token.start, token.end)
          timelineStore.locateTime(token.start, duration)
          player.seek(token.start)
        }
      }
      return
    }

    const handlers: Partial<Record<typeof action, () => void>> = {
      previousToken: () => projectStore.navigateToken(-1),
      nextToken: () => projectStore.navigateToken(1),
      previousLine: () => projectStore.navigateLine(-1),
      nextLine: () => projectStore.navigateLine(1),
      nudgeEarlierFine: () =>
        projectStore.nudgeSelection(-0.001, timelineStore.editMode, timelineStore.adjacentLocked),
      nudgeLaterFine: () =>
        projectStore.nudgeSelection(0.001, timelineStore.editMode, timelineStore.adjacentLocked),
      nudgeEarlierCoarse: () =>
        projectStore.nudgeSelection(-0.05, timelineStore.editMode, timelineStore.adjacentLocked),
      nudgeLaterCoarse: () =>
        projectStore.nudgeSelection(0.05, timelineStore.editMode, timelineStore.adjacentLocked),
      toggleLyricsFollow: () => (timelineStore.followLyrics = !timelineStore.followLyrics),
      toggleTimelineFollow: () => (timelineStore.followPlayback = !timelineStore.followPlayback),
      copyLineTiming: () => projectStore.copyActiveLineTiming(),
      pasteLineTiming: () => projectStore.pasteLineTimingAt(playerStore.currentTime),
      automaticTiming: () => window.dispatchEvent(new CustomEvent('automatic-timing')),
      mergePreviousToken: () => projectStore.mergeActiveToken(-1),
      mergeNextToken: () => projectStore.mergeActiveToken(1),
      tokenEditMode: () => (timelineStore.editMode = 'token'),
      lineEditMode: () => (timelineStore.editMode = 'line'),
      toggleAdjacentLock: () => (timelineStore.adjacentLocked = !timelineStore.adjacentLocked),
      zoomOut: () => timelineStore.zoomAt(timelineStore.width / 2, 0.8, duration),
      zoomIn: () => timelineStore.zoomAt(timelineStore.width / 2, 1.25, duration),
      fitTimeline: () => timelineStore.fit(duration)
    }
    handlers[action]?.()
  }

  async function handleKeydown(event: KeyboardEvent): Promise<void> {
    if (
      isEditableTarget(event.target) ||
      (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]')) ||
      document.querySelector('[role="dialog"]')
    )
      return

    if ((event.key === 'Delete' || event.key === 'Backspace') && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const tokenIds = timelineStore.selectedTokenIds.length
        ? timelineStore.selectedTokenIds
        : projectStore.activeToken
          ? [projectStore.activeToken.id]
          : []
      if (tokenIds.length) {
        event.preventDefault()
        if (projectStore.deleteTokens(tokenIds)) {
          timelineStore.selectedTokenIds = projectStore.activeToken ? [projectStore.activeToken.id] : []
        }
      }
      return
    }

    const action = shortcutActions.find(({ id }) => {
      const shortcut = settingsStore.shortcuts[id]
      return shortcut && matchesShortcut(event, shortcut)
    })?.id
    if (!action) return
    event.preventDefault()
    await executeAction(action, event.repeat)
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('app-shortcut', handleAppShortcut as EventListener)
    removeMenuListener = window.desktopApi.onMenuAction((action) => {
      if (shortcutActions.some((item) => item.id === action)) {
        void executeAction(action as ShortcutAction)
      } else {
        window.dispatchEvent(new CustomEvent('app-command', { detail: action }))
      }
    })
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('app-shortcut', handleAppShortcut as EventListener)
    removeMenuListener?.()
  })

  function handleAppShortcut(event: CustomEvent<string>): void {
    if (shortcutActions.some((item) => item.id === event.detail)) {
      void executeAction(event.detail as ShortcutAction)
    }
  }
}
