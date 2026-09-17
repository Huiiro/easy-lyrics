<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { tokenizeLine } from '@renderer/services/tokenizer'
import type { TokenizerMode } from '@shared/models/project'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  close: []
  import: [payload: { text: string; mode: TokenizerMode }]
}>()

const text = ref('')
const mode = ref<TokenizerMode>('smart')
const textarea = ref<HTMLTextAreaElement | null>(null)

const preview = computed(() => {
  const lines = text.value
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    lines: lines.filter((line) => tokenizeLine(line, mode.value).length > 0).length,
    tokens: lines.reduce((total, line) => total + tokenizeLine(line, mode.value).length, 0)
  }
})

watch(
  () => props.open,
  (open) => {
    if (open) requestAnimationFrame(() => textarea.value?.focus())
  }
)

function submit(): void {
  if (preview.value.lines === 0) return
  emit('import', { text: text.value, mode: mode.value })
  emit('close')
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" role="presentation" @mousedown.self="emit('close')">
    <section
      class="import-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lyrics-import-title"
      @keydown.esc="emit('close')"
    >
      <header class="dialog-header">
        <div>
          <p class="eyebrow">Lyrics</p>
          <h2 id="lyrics-import-title">导入歌词</h2>
        </div>
        <button class="icon-button" type="button" aria-label="关闭" @click="emit('close')">
          ×
        </button>
      </header>

      <label class="field-label" for="lyrics-source">每行一句歌词</label>
      <textarea
        id="lyrics-source"
        ref="textarea"
        v-model="text"
        rows="12"
        placeholder="徘徊着的在路上的&#10;你要走吗 via via&#10;易碎的骄傲着"
      />

      <fieldset class="tokenizer-options">
        <legend>拆分方式</legend>
        <label><input v-model="mode" type="radio" value="smart" /> 智能</label>
        <label><input v-model="mode" type="radio" value="char" /> 逐字</label>
        <label><input v-model="mode" type="radio" value="word" /> 逐词</label>
      </fieldset>

      <p class="tokenizer-hint">智能模式按中文字、英文单词和数字拆分；空行及纯标点行会忽略。</p>

      <footer class="dialog-footer">
        <span>{{ preview.lines }} 行 · {{ preview.tokens }} 个 Token</span>
        <div>
          <button class="secondary-button" type="button" @click="emit('close')">取消</button>
          <button
            class="primary-button"
            type="button"
            :disabled="preview.lines === 0"
            @click="submit"
          >
            导入
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>
