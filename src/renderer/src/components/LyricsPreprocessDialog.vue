<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseDialog from '@renderer/components/ui/BaseDialog.vue'
import { preprocessLyrics } from '@renderer/services/lyrics-preprocess'
import { useI18n } from '@renderer/i18n'

const props = defineProps<{ open: boolean; source: string }>()
const emit = defineEmits<{ close: []; apply: [text: string] }>()
const { t } = useI18n()
const removeMetadata = ref(true)
const removeParentheses = ref(true)
const removeBraces = ref(true)
const customPattern = ref('')
const customFlags = ref('giu')

const result = computed(() =>
  preprocessLyrics(props.source, {
    removeMetadata: removeMetadata.value,
    removeParentheses: removeParentheses.value,
    removeBraces: removeBraces.value,
    customPattern: customPattern.value,
    customFlags: customFlags.value
  })
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    customPattern.value = ''
    customFlags.value = 'giu'
  }
)

function apply(): void {
  if (result.value.error || !result.value.text.trim()) return
  emit('apply', result.value.text)
}
</script>

<template>
  <BaseDialog :open="open" title-id="lyrics-preprocess-title" size="large" @close="emit('close')">
    <div class="preprocess-dialog">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">Cleanup</p>
          <h2 id="lyrics-preprocess-title">{{ t('lyrics_preprocessing') }}</h2>
        </div>
        <button class="icon-button" type="button" :aria-label="t('close')" @click="emit('close')">
          ×
        </button>
      </header>

      <div class="preprocess-layout">
        <section class="preprocess-rules">
          <h3>{{ t('built_in_rules') }}</h3>
          <label><input v-model="removeMetadata" type="checkbox" />
            {{ t('remove_lrc_metadata_ti_ar_al_etc') }}</label>
          <label><input v-model="removeParentheses" type="checkbox" />
            {{ t('remove_annotations_in_parentheses') }}</label>
          <label><input v-model="removeBraces" type="checkbox" />
            {{ t('remove_annotations_in_braces') }}</label>
          <h3>{{ t('custom_regular_expression') }}</h3>
          <label class="field-label">Pattern<input v-model="customPattern" type="text" placeholder="\\[Verse.*?\\]" /></label>
          <label class="field-label">Flags<input v-model="customFlags" type="text" placeholder="giu" /></label>
          <p v-if="result.error" class="inspector-error" role="alert">{{ result.error }}</p>
        </section>
        <section class="preprocess-preview">
          <header>
            {{ t('result_preview') }}
            <span>{{ t('count_replacements', { count: result.replacements }) }}</span>
          </header>
          <pre>{{ result.text }}</pre>
        </section>
      </div>

      <footer class="dialog-footer">
        <span>{{ t('review_the_result_in_the_lyric_editor_before_applying') }}</span>
        <div>
          <button class="secondary-button" type="button" @click="emit('close')">
            {{ t('cancel') }}
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="Boolean(result.error) || !result.text"
            @click="apply"
          >
            {{ t('apply_and_edit') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
