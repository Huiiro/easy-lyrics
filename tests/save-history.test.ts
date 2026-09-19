import { describe, expect, it } from 'vitest'

import { addSaveHistoryEntry, parseSaveHistory } from '../src/shared/save-history'

describe('save history', () => {
  it('filters invalid records and orders new entries by save time', () => {
    const valid = {
      id: 'save-1',
      projectId: 'project-1',
      projectName: 'Song',
      path: '/song.lyricproj',
      savedAt: 100,
      archiveAvailable: true,
      kind: 'manual' as const
    }
    expect(parseSaveHistory([valid, { projectId: 12 }])).toEqual([valid])

    const next = { ...valid, id: 'save-2', savedAt: 200 }
    expect(addSaveHistoryEntry([valid], next).map((entry) => entry.id)).toEqual([
      'save-2',
      'save-1'
    ])
  })

  it('limits retained records', () => {
    const entries = Array.from({ length: 3 }, (_, index) => ({
      id: String(index),
      projectId: 'project',
      projectName: 'Song',
      path: '/song.lyricproj',
      savedAt: index,
      archiveAvailable: true,
      kind: 'manual' as const
    }))
    expect(
      addSaveHistoryEntry(entries, { ...entries[0]!, id: 'new', savedAt: 10 }, 2)
    ).toHaveLength(2)
  })

  it('keeps old metadata-only records visible but marks them unavailable', () => {
    expect(
      parseSaveHistory([
        {
          id: 'old',
          projectId: 'project',
          projectName: 'Song',
          path: '/song.lyricproj',
          savedAt: 1
        }
      ])[0]?.archiveAvailable
    ).toBe(false)
    expect(
      parseSaveHistory([
        {
          id: 'old',
          projectId: 'project',
          projectName: 'Song',
          path: '/song.lyricproj',
          savedAt: 1
        }
      ])[0]?.kind
    ).toBe('manual')
  })
})
