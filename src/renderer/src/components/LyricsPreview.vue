<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from '@renderer/i18n'
import { usePlayerStore } from '@renderer/stores/player'
import { useProjectStore } from '@renderer/stores/project'
import { lyricTokenDisplayTexts } from '@renderer/utils/lyrics-preview'
import { segmentGraphemes } from '@renderer/services/tokenizer'

const projectStore = useProjectStore()
const playerStore = usePlayerStore()
const { t } = useI18n()
const lineRefs = ref<HTMLElement[]>([])
interface PreviewCharacter {
  text: string
  start: number | null
  end: number | null
  index: number
}

const displayLines = computed(() =>
  projectStore.project.lines.map((line) => {
    const texts = lyricTokenDisplayTexts(line)
    let characterIndex = 0
    const groups = line.tokens.map((token, tokenIndex) => {
      const characters = segmentGraphemes(texts[tokenIndex] ?? token.text)
      const start = token.start
      const resolvedEnd =
        start === null ? null : (token.end ?? start + Math.max(0.35, characters.length * 0.1))
      return characters.map((text, index): PreviewCharacter => {
        const stride =
          start === null || resolvedEnd === null ? 0 : (resolvedEnd - start) / characters.length
        const character = {
          text,
          start: start === null ? null : start + stride * index,
          end: start === null ? null : start + stride * (index + 1),
          index: characterIndex
        }
        characterIndex += 1
        return character
      })
    })
    return { line, groups, characterCount: characterIndex }
  })
)
const currentLineIndex = computed(() => {
  const time = playerStore.currentTime
  let found = -1
  for (let index = 0; index < projectStore.project.lines.length; index++) {
    const start = projectStore.project.lines[index]?.tokens.find(
      (token) => token.start !== null
    )?.start
    if (start !== null && start !== undefined && start <= time) found = index
  }
  return found < 0 ? projectStore.currentLineIndex : found
})

function tokenProgress(start: number | null, end: number | null): number {
  if (start === null) return 0
  const resolvedEnd = end ?? start + 0.35
  if (resolvedEnd <= start) return playerStore.currentTime >= start ? 1 : 0
  return Math.min(1, Math.max(0, (playerStore.currentTime - start) / (resolvedEnd - start)))
}

function waveCenter(groups: PreviewCharacter[][]): number {
  const characters = groups.flat()
  const time = playerStore.currentTime
  let center = -1
  for (const character of characters) {
    if (character.start === null || time < character.start) break
    const progress = tokenProgress(character.start, character.end)
    center = character.index - 1 + progress
    if (progress < 1) break
  }
  let last: PreviewCharacter | undefined
  for (let index = characters.length - 1; index >= 0; index--) {
    if (characters[index]?.start !== null) {
      last = characters[index]
      break
    }
  }
  if (last?.end !== null && last?.end !== undefined && time > last.end) {
    const duration = Math.max(0.001, (last.end - (last.start ?? last.end)) * 1.2)
    const settle = Math.min(0.28, Math.max(0.16, duration))
    center = last.index + Math.min(1, (time - last.end) / settle) * 5
  }
  return center
}

function characterStyle(
  character: PreviewCharacter,
  groups: PreviewCharacter[][]
): Record<string, string> {
  const progress = tokenProgress(character.start, character.end)
  const characters = groups.flat()
  const previous = characters[character.index - 1]
  const duration = Math.max(0.001, (character.end ?? 0) - (character.start ?? 0))
  const gap =
    character.start === null || previous?.end == null
      ? Number.POSITIVE_INFINITY
      : character.start - previous.end
  const blend =
    character.index > 0 && gap <= 0.08 ? Math.min(0.12, Math.max(duration * 0.55, gap + 0.04)) : 0
  const emphasisStart = character.start === null ? null : character.start - blend
  const emphasis =
    emphasisStart === null
      ? progress
      : Math.min(1, Math.max(0, (playerStore.currentTime - emphasisStart) / (duration + blend)))
  const distance = character.index - waveCenter(groups)
  const width = distance < 0 ? 1.9 : 0.82
  const lift = distance <= -5 || distance > 3 ? 0 : Math.exp(-0.5 * (distance / width) ** 2)
  const edgeEnvelope = Math.max(0, Math.min(1, progress / 0.18, (1 - progress) / 0.18))
  const edgeSize = 34 * edgeEnvelope
  return {
    '--fill-size': `${Math.max(0, progress * 100 - edgeSize / 2 + (edgeSize ? 1.5 : 0))}%`,
    '--edge-size': `${edgeSize}%`,
    '--edge-position': `${progress * 100 - edgeSize / 2}%`,
    '--emphasis': String(emphasis),
    '--lift': String(lift)
  }
}

watch(currentLineIndex, async (index) => {
  await nextTick()
  lineRefs.value[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})
</script>

<template>
  <section class="lyrics-preview" :aria-label="t('karaoke_lyrics_preview')">
    <header class="pane-title">
      <strong>{{ t('lyrics_preview') }}</strong><span>{{ t('karaoke_preview_follows_playback') }}</span>
    </header>
    <div v-if="projectStore.project.lines.length" class="lyrics-preview-viewport">
      <button
        v-for="({ line, groups }, lineIndex) in displayLines"
        :key="line.id"
        :ref="
          (element) => {
            if (element) lineRefs[lineIndex] = element as HTMLElement
          }
        "
        type="button"
        class="preview-lyric-line"
        :class="{ current: lineIndex === currentLineIndex }"
        @click="projectStore.selectToken(lineIndex, 0)"
      >
        <span
          v-for="(group, groupIndex) in groups"
          :key="line.tokens[groupIndex]?.id ?? groupIndex"
          class="preview-token"
        ><span
          v-for="character in group"
          :key="character.index"
          class="preview-character"
          :style="lineIndex === currentLineIndex ? characterStyle(character, groups) : undefined"
        >{{ character.text }}</span></span>
      </button>
    </div>
    <div v-else class="lyrics-preview-empty">
      <strong>{{ t('import_lyrics_to_preview_the_karaoke_effect') }}</strong>
      <span>{{ t('after_timing_the_lyrics_play_the_audio_to_highlight_each_token') }}</span>
    </div>
  </section>
</template>
