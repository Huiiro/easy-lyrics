import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import {
  cloneExportTemplates,
  DEFAULT_EXPORT_TEMPLATES,
  parseExportTemplates
} from '../src/shared/export'

describe('export template persistence validation', () => {
  it('accepts multiple valid templates', () => {
    const templates = DEFAULT_EXPORT_TEMPLATES.concat({
      id: 'plain',
      name: 'Plain',
      extension: 'txt',
      lineTemplate: '{{line.text}}',
      tokenTemplate: '{{token.text}}',
      separator: '\\n'
    })
    expect(parseExportTemplates(templates)).toHaveLength(2)
  })

  it('filters invalid and duplicate entries', () => {
    const valid = DEFAULT_EXPORT_TEMPLATES[0]!
    expect(parseExportTemplates([valid, { ...valid }, { id: 1 }])).toEqual([valid])
  })

  it('restores the default when no valid templates remain', () => {
    expect(parseExportTemplates([])).toEqual(DEFAULT_EXPORT_TEMPLATES)
  })

  it('creates an IPC-cloneable payload from reactive templates', () => {
    const templates = reactive(structuredClone(DEFAULT_EXPORT_TEMPLATES))

    expect(() => structuredClone(templates)).toThrow()
    expect(structuredClone(cloneExportTemplates(templates))).toEqual(DEFAULT_EXPORT_TEMPLATES)
  })
})
