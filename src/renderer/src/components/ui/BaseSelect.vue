<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  modelValue: string | number
  options: Array<{ value: string | number; label: string }>
  disabled?: boolean
  ariaLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()
const root = ref<HTMLElement | null>(null)
const optionElements = ref<HTMLButtonElement[]>([])
const open = ref(false)
const highlightedIndex = ref(-1)
const selectedIndex = computed(() =>
  props.options.findIndex((option) => String(option.value) === String(props.modelValue))
)
const selectedLabel = computed(
  () => props.options[selectedIndex.value]?.label ?? props.options[0]?.label ?? ''
)

function show(): void {
  if (props.disabled) return
  open.value = true
  highlightedIndex.value = Math.max(selectedIndex.value, 0)
  void nextTick(() => optionElements.value[highlightedIndex.value]?.focus())
}

function close(focusTrigger = false): void {
  open.value = false
  if (focusTrigger) root.value?.querySelector<HTMLButtonElement>('.base-select-trigger')?.focus()
}

function toggle(): void {
  if (open.value) close()
  else show()
}

function choose(index: number): void {
  const option = props.options[index]
  if (!option) return
  emit('update:modelValue', option.value)
  close(true)
}

function move(delta: number): void {
  if (!open.value) {
    show()
    return
  }
  const count = props.options.length
  if (!count) return
  highlightedIndex.value = (highlightedIndex.value + delta + count) % count
  void nextTick(() => optionElements.value[highlightedIndex.value]?.focus())
}

function handleTriggerKey(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    show()
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggle()
  } else if (event.key === 'Escape') {
    close()
  }
}

function handleOptionKey(event: KeyboardEvent, index: number): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    choose(index)
  } else if (event.key === 'Escape' || event.key === 'Tab') {
    close(event.key === 'Escape')
  }
}

function closeFromOutside(event: PointerEvent): void {
  if (event.target instanceof Node && root.value?.contains(event.target)) return
  close()
}

onMounted(() => document.addEventListener('pointerdown', closeFromOutside))
onUnmounted(() => document.removeEventListener('pointerdown', closeFromOutside))
</script>

<template>
  <span ref="root" class="base-select" :class="{ disabled, open }">
    <button
      type="button"
      class="base-select-trigger"
      role="combobox"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :disabled="disabled"
      @click="toggle"
      @keydown="handleTriggerKey"
    >
      <span>{{ selectedLabel }}</span><span class="base-select-chevron" aria-hidden="true">⌄</span>
    </button>
    <span v-if="open" class="base-select-options" role="listbox" :aria-label="ariaLabel">
      <button
        v-for="(option, index) in options"
        :key="String(option.value)"
        :ref="(element) => { if (element) optionElements[index] = element as HTMLButtonElement }"
        type="button"
        role="option"
        :aria-selected="index === selectedIndex"
        :class="{ selected: index === selectedIndex, highlighted: index === highlightedIndex }"
        @mouseenter="highlightedIndex = index"
        @click="choose(index)"
        @keydown="handleOptionKey($event, index)"
      >
        <span>{{ option.label }}</span><span v-if="index === selectedIndex">✓</span>
      </button>
    </span>
  </span>
</template>
