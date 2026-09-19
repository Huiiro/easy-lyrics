<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseDialog from '@renderer/components/ui/BaseDialog.vue'
import { useI18n } from '@renderer/i18n'
import { parseLyricSource, tokenizeLine } from '@renderer/services/tokenizer'
import type { TokenizerMode } from '@shared/models/project'

const props = withDefaults(
  defineProps<{ open: boolean; initialText?: string; initialMode?: TokenizerMode }>(),
  { initialText: '', initialMode: 'smart' }
)
const emit = defineEmits<{
  close: []
  import: [payload: { text: string; mode: TokenizerMode }]
}>()

const text = ref('')
const mode = ref<TokenizerMode>('smart')
const textarea = ref<HTMLTextAreaElement | null>(null)
const { t } = useI18n()

const preview = computed(() => {
  const lines = parseLyricSource(text.value).map((line) => line.text)
  return {
    lines: lines.filter((line) => tokenizeLine(line, mode.value).length > 0).length,
    tokens: lines.reduce((total, line) => total + tokenizeLine(line, mode.value).length, 0)
  }
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      text.value = props.initialText
      mode.value = props.initialMode
      requestAnimationFrame(() => textarea.value?.focus())
    }
  }
)

function submit(): void {
  if (preview.value.lines === 0) return
  emit('import', { text: text.value, mode: mode.value })
  emit('close')
}
</script>

<template>
  <BaseDialog :open="open" title-id="lyrics-import-title" @close="emit('close')">
    <div class="import-dialog">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">Lyrics</p>
          <h2 id="lyrics-import-title">
            {{ initialText ? t('edit_lyrics') : t('import_lyrics') }}
          </h2>
        </div>
        <button class="icon-button" type="button" :aria-label="t('close')" @click="emit('close')">
          ×
        </button>
      </header>

      <label class="field-label" for="lyrics-source">{{ t('one_lyric_line_per_row') }}</label>
      <textarea
        id="lyrics-source"
        ref="textarea"
        v-model="text"
        rows="12"
        :placeholder="t('lyrics_input_example')"
      />

      <fieldset class="tokenizer-options">
        <legend>{{ t('tokenization') }}</legend>
        <label><input v-model="mode" type="radio" value="smart" /> {{ t('smart') }}</label>
        <label><input v-model="mode" type="radio" value="char" /> {{ t('character') }}</label>
        <label><input v-model="mode" type="radio" value="word" /> {{ t('word') }}</label>
      </fieldset>

      <p class="tokenizer-hint">
        {{
          t(
            'supports_plain_text_and_lrc_timestamps_smart_mode_recognizes_cjk_and_languages_without_spaces'
          )
        }}
      </p>

      <footer class="dialog-footer">
        <span>{{ t('lines_lines_tokens_tokens', preview) }}</span>
        <div>
          <button class="secondary-button" type="button" @click="emit('close')">
            {{ t('cancel') }}
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="preview.lines === 0"
            @click="submit"
          >
            {{ initialText ? t('apply_changes') : t('import') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
