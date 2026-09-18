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
          <h2 id="lyrics-import-title">{{ initialText ? t('编辑歌词') : t('导入歌词') }}</h2>
        </div>
        <button class="icon-button" type="button" :aria-label="t('关闭')" @click="emit('close')">
          ×
        </button>
      </header>

      <label class="field-label" for="lyrics-source">{{ t('每行一句歌词') }}</label>
      <textarea
        id="lyrics-source"
        ref="textarea"
        v-model="text"
        rows="12"
        :placeholder="t('歌词输入示例')"
      />

      <fieldset class="tokenizer-options">
        <legend>{{ t('拆分方式') }}</legend>
        <label><input v-model="mode" type="radio" value="smart" /> {{ t('智能') }}</label>
        <label><input v-model="mode" type="radio" value="char" /> {{ t('逐字') }}</label>
        <label><input v-model="mode" type="radio" value="word" /> {{ t('逐词') }}</label>
      </fieldset>

      <p class="tokenizer-hint">
        {{ t('支持普通文本和 LRC 时间标签；智能模式按中文字、英文单词和数字拆分。') }}
      </p>

      <footer class="dialog-footer">
        <span>{{ t('{lines} 行 · {tokens} 个 Token', preview) }}</span>
        <div>
          <button class="secondary-button" type="button" @click="emit('close')">{{ t('取消') }}</button>
          <button
            class="primary-button"
            type="button"
            :disabled="preview.lines === 0"
            @click="submit"
          >
            {{ initialText ? t('应用修改') : t('导入') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
