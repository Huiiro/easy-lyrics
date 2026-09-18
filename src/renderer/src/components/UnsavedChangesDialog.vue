<script setup lang="ts">
import BaseDialog from '@renderer/components/ui/BaseDialog.vue'
import { useI18n } from '@renderer/i18n'

defineProps<{ open: boolean; projectName: string; saving?: boolean }>()
const emit = defineEmits<{ cancel: []; discard: []; save: [] }>()
const { t } = useI18n()
</script>

<template>
  <BaseDialog
    :open="open"
    title-id="unsaved-changes-title"
    :close-on-backdrop="false"
    @close="emit('cancel')"
  >
    <div class="unsaved-changes-dialog">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">{{ t('未保存的修改') }}</p>
          <h2 id="unsaved-changes-title">{{ t('是否保存当前工程？') }}</h2>
        </div>
      </header>
      <p>
        {{
          t('“{name}”包含尚未保存的修改。保存后再继续，可以避免丢失这些修改。', {
            name: projectName
          })
        }}
      </p>
      <footer class="dialog-footer">
        <button class="secondary-button" type="button" :disabled="saving" @click="emit('discard')">
          {{ t('不保存') }}
        </button>
        <div>
          <button class="secondary-button" type="button" :disabled="saving" @click="emit('cancel')">
            {{ t('取消') }}
          </button>
          <button class="primary-button" type="button" :disabled="saving" @click="emit('save')">
            {{ saving ? t('正在保存…') : t('保存') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
