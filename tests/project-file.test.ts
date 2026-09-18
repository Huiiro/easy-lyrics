import { describe, expect, it } from 'vitest'

import { createEmptyProject } from '../src/shared/models/project'
import { parseProjectFile } from '../src/shared/project-file'

describe('project file validation', () => {
  it('accepts a valid v1 project and returns a copy', () => {
    const project = createEmptyProject(123)
    const parsed = parseProjectFile(project)
    expect(parsed).toEqual(project)
    expect(parsed).not.toBe(project)
  })

  it('explains unsupported versions', () => {
    expect(() => parseProjectFile({ version: 99 })).toThrow('不支持的工程版本')
  })

  it('rejects invalid token ranges', () => {
    const project = createEmptyProject(123)
    project.lines = [
      {
        id: 'line',
        text: 'a',
        tokens: [{ id: 'token', text: 'a', start: 2, end: 1 }]
      }
    ]
    expect(() => parseProjectFile(project)).toThrow('Token 时间无效')
  })
})
