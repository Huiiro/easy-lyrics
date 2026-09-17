<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    titleId: string
    size?: 'medium' | 'large'
    closeOnBackdrop?: boolean
  }>(),
  { size: 'medium', closeOnBackdrop: true }
)

const emit = defineEmits<{ close: [] }>()

function closeOnEscape(event: KeyboardEvent): void {
  if (props.open && event.key === 'Escape') emit('close')
}

function syncBodyLock(open: boolean): void {
  document.body.classList.toggle('dialog-open', open)
}

onMounted(() => {
  window.addEventListener('keydown', closeOnEscape)
  syncBodyLock(props.open)
})
watch(() => props.open, syncBodyLock)
onUnmounted(() => {
  window.removeEventListener('keydown', closeOnEscape)
  document.body.classList.remove('dialog-open')
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="dialog-backdrop"
      role="presentation"
      @mousedown.self="closeOnBackdrop && emit('close')"
    >
      <section
        class="base-dialog"
        :class="`base-dialog--${size}`"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <slot />
      </section>
    </div>
  </Teleport>
</template>
