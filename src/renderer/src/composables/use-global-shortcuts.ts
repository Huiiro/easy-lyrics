import { onMounted, onUnmounted } from 'vue'

import { getAudioPlayer } from '@renderer/services/audio-player'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import { matchesShortcut, shortcutActions, useSettingsStore } from '@renderer/stores/settings'
import { useTimelineStore } from '@renderer/stores/timeline'

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

  async function handleKeydown(event: KeyboardEvent): Promise<void> {
    if (
      isEditableTarget(event.target) ||
      (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]'))
    )
      return

    const action = shortcutActions.find(({ id }) => {
      const shortcut = settingsStore.shortcuts[id]
      return shortcut && matchesShortcut(event, shortcut)
    })?.id
    if (!action) return
    event.preventDefault()

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
      if (event.repeat || !playerStore.source || !projectStore.activeToken) return
      const time = playerStore.currentTime + projectStore.project.settings.timingOffsetMs / 1000
      projectStore.markCurrentToken(time)
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
        projectStore.nudgeSelection(0.05, timelineStore.editMode, timelineStore.adjacentLocked)
    }
    handlers[action]?.()
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}
