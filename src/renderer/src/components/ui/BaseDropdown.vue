<script setup lang="ts">
import { onMounted, onUnmounted, ref, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{ group: string; closeGroupsOnOpen?: string[]; closeDelay?: number }>(),
  { closeGroupsOnOpen: () => [], closeDelay: 180 }
)
const attrs = useAttrs()
const root = ref<HTMLDetailsElement | null>(null)
const id = crypto.randomUUID()
let closeTimer: ReturnType<typeof setTimeout> | null = null

function cancelClose(): void {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
}

function open(): void {
  cancelClose()
  window.dispatchEvent(
    new CustomEvent('base-dropdown-open', {
      detail: { id, group: props.group, closeGroups: props.closeGroupsOnOpen }
    })
  )
  if (root.value) root.value.open = true
}

function scheduleClose(): void {
  cancelClose()
  closeTimer = setTimeout(() => {
    if (root.value) root.value.open = false
    closeTimer = null
  }, props.closeDelay)
}

function closeFromPeer(event: Event): void {
  const detail = (event as CustomEvent<{ id: string; group: string; closeGroups: string[] }>).detail
  if (detail.id !== id && (detail.group === props.group || detail.closeGroups.includes(props.group))) {
    if (root.value) root.value.open = false
  }
}

function closeFromOutside(event: PointerEvent): void {
  if (event.target instanceof Node && root.value?.contains(event.target)) return
  if (root.value) root.value.open = false
}

function closeAll(): void {
  if (root.value) root.value.open = false
}

onMounted(() => {
  window.addEventListener('base-dropdown-open', closeFromPeer)
  window.addEventListener('base-dropdown-close-all', closeAll)
  document.addEventListener('pointerdown', closeFromOutside)
})
onUnmounted(() => {
  cancelClose()
  window.removeEventListener('base-dropdown-open', closeFromPeer)
  window.removeEventListener('base-dropdown-close-all', closeAll)
  document.removeEventListener('pointerdown', closeFromOutside)
})
</script>

<template>
  <details
    ref="root"
    v-bind="attrs"
    class="base-dropdown"
    @mouseenter="open"
    @mouseleave="scheduleClose"
  >
    <summary @click.prevent><slot name="trigger" /></summary>
    <slot />
  </details>
</template>
