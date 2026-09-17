import { describe, expect, it, vi } from 'vitest'

import { createEmptyProject } from '../src/shared/models/project'

describe('createEmptyProject', () => {
  it('creates a versioned, unsaved project with stable timestamps', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'project-id' })
    const project = createEmptyProject(1234)

    expect(project).toMatchObject({
      version: 1,
      id: 'project-id',
      name: 'Untitled Project',
      audio: null,
      lines: [],
      createdAt: 1234,
      updatedAt: 1234
    })

    vi.unstubAllGlobals()
  })
})
