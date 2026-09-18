import { describe, expect, it } from 'vitest'

import { parseRecentProjects, prioritizeRecentProject } from '../src/shared/recent-projects'

describe('recent projects', () => {
  it('filters invalid and duplicate entries', () => {
    expect(
      parseRecentProjects([
        { path: '/a.lyricproj', name: 'A', lastOpenedAt: 2 },
        { path: '/a.lyricproj', name: 'duplicate', lastOpenedAt: 1 },
        { path: 12, name: 'invalid', lastOpenedAt: 0 }
      ])
    ).toEqual([{ path: '/a.lyricproj', name: 'A', lastOpenedAt: 2 }])
  })

  it('moves the opened project to the front', () => {
    const result = prioritizeRecentProject(
      [
        { path: '/a', name: 'A', lastOpenedAt: 1 },
        { path: '/b', name: 'B', lastOpenedAt: 2 }
      ],
      { path: '/a', name: 'A updated', lastOpenedAt: 3 }
    )
    expect(result.map(({ path }) => path)).toEqual(['/a', '/b'])
    expect(result[0]?.name).toBe('A updated')
  })
})
