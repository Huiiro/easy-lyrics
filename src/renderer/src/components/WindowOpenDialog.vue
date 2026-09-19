<script setup lang="ts">
import BaseDialog from '@renderer/components/ui/BaseDialog.vue'
import { useI18n } from '@renderer/i18n'

defineProps<{ open: boolean; operation: 'new' | 'open' }>()
const emit = defineEmits<{ cancel: []; current: []; newWindow: [] }>()
const { t } = useI18n()
</script>

<template>
  <BaseDialog
    :open="open"
    title-id="window-open-title"
    :close-on-backdrop="false"
    @close="emit('cancel')"
  >
    <div class="window-open-dialog">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">{{ t('window') }}</p>
          <h2 id="window-open-title">
            {{ operation === 'new' ? t('create_project_where') : t('open_project_where') }}
          </h2>
        </div>
        <button class="icon-button" type="button" :aria-label="t('close')" @click="emit('cancel')">
          ×
        </button>
      </header>
      <div class="window-open-dialog-body">
        <p>{{ t('choose_whether_to_use_this_window_or_a_new_window') }}</p>
      </div>
      <footer class="dialog-footer">
        <span>{{
          operation === 'new' ? t('new_project_alternate') : t('open_project_dialog')
        }}</span>
        <div>
          <button class="secondary-button" type="button" @click="emit('cancel')">
            {{ t('cancel') }}
          </button>
          <button class="secondary-button" type="button" @click="emit('current')">
            {{ t('current_window') }}
          </button>
          <button class="primary-button" type="button" @click="emit('newWindow')">
            {{ t('new_window') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
