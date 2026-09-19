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
          <p class="eyebrow">{{ t('unsaved_changes') }}</p>
          <h2 id="unsaved-changes-title">{{ t('save_the_current_project_alternate') }}</h2>
        </div>
      </header>
      <p>
        {{
          t('name_has_unsaved_changes_save_before_continuing_to_avoid_losing_them', {
            name: projectName
          })
        }}
      </p>
      <footer class="dialog-footer">
        <button class="secondary-button" type="button" :disabled="saving" @click="emit('discard')">
          {{ t('dont_save') }}
        </button>
        <div>
          <button class="secondary-button" type="button" :disabled="saving" @click="emit('cancel')">
            {{ t('cancel') }}
          </button>
          <button class="primary-button" type="button" :disabled="saving" @click="emit('save')">
            {{ saving ? t('saving') : t('save') }}
          </button>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>
