import { onMounted, onUnmounted } from 'vue'

import { getAudioPlayer } from '@renderer/services/audio-player'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'

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

  async function handleKeydown(event: KeyboardEvent): Promise<void> {
    if (isEditableTarget(event.target) || event.altKey) return

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault()
        projectStore.nudgeActiveToken(direction * 0.001)
        return
      }
      if (event.shiftKey) {
        event.preventDefault()
        projectStore.nudgeActiveToken(direction * 0.05)
        return
      }
    }

    if (event.metaKey || event.ctrlKey) return

    if (event.code === 'Space') {
      event.preventDefault()
      if (!playerStore.source) return
      try {
        await player.toggle()
      } catch {
        playerStore.fail('无法开始播放，请重新选择音频')
      }
      return
    }

    if (event.key.toLowerCase() === 'f') {
      if (event.repeat || !playerStore.source || !projectStore.activeToken) return
      event.preventDefault()
      const time = playerStore.currentTime + projectStore.project.settings.timingOffsetMs / 1000
      projectStore.markCurrentToken(time)
      return
    }

    const navigation = {
      ArrowLeft: () => projectStore.navigateToken(-1),
      ArrowRight: () => projectStore.navigateToken(1),
      ArrowUp: () => projectStore.navigateLine(-1),
      ArrowDown: () => projectStore.navigateLine(1)
    }[event.key]

    if (navigation) {
      event.preventDefault()
      navigation()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}
