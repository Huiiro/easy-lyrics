import { defineStore } from 'pinia'
import { ref } from 'vue'

import { createEmptyProject, type LyricProject } from '@shared/models/project'

export const useProjectStore = defineStore('project', () => {
  const project = ref<LyricProject>(createEmptyProject())
  const currentLineIndex = ref(0)
  const currentTokenIndex = ref(0)
  const dirty = ref(false)

  return { project, currentLineIndex, currentTokenIndex, dirty }
})
