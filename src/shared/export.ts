import type { LyricLine, LyricProject, LyricToken } from './models/project'

export type ExportFormat = 'json' | 'lrc' | 'enhanced-lrc' | 'srt' | 'txt' | 'template'
export type TimeFormatter = 'seconds' | 'milliseconds' | 'mm:ss.xx' | 'mm:ss.xxx' | 'hh:mm:ss.xxx'

export interface ExportTemplate {
  id: string
  name: string
  extension: string
  lineTemplate: string
  tokenTemplate: string
  separator: string
}

export const DEFAULT_EXPORT_TEMPLATES: ExportTemplate[] = [
  {
    id: 'enhanced-lrc-template',
    name: '逐字 LRC 模板',
    extension: 'lrc',
    lineTemplate: '[{{line.start|mm:ss.xx}}]{{tokens}}',
    tokenTemplate: '<{{token.start|mm:ss.xx}}>{{token.text}}',
    separator: '\\n'
  }
]

export function cloneExportTemplates(templates: readonly ExportTemplate[]): ExportTemplate[] {
  return templates.map(({ id, name, extension, lineTemplate, tokenTemplate, separator }) => ({
    id,
    name,
    extension,
    lineTemplate,
    tokenTemplate,
    separator
  }))
}

export function parseExportTemplates(value: unknown): ExportTemplate[] {
  if (!Array.isArray(value)) return structuredClone(DEFAULT_EXPORT_TEMPLATES)
  const ids = new Set<string>()
  const templates = value.filter((item): item is ExportTemplate => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as Record<string, unknown>
    const valid = ['id', 'name', 'extension', 'lineTemplate', 'tokenTemplate', 'separator'].every(
      (key) => typeof candidate[key] === 'string'
    )
    if (!valid || !candidate.id || ids.has(candidate.id as string)) return false
    ids.add(candidate.id as string)
    return true
  })
  return templates.length ? structuredClone(templates) : structuredClone(DEFAULT_EXPORT_TEMPLATES)
}

export const BUILTIN_EXPORT_FORMATS: Array<{
  id: Exclude<ExportFormat, 'template'>
  name: string
  extension: string
}> = [
  { id: 'json', name: 'JSON', extension: 'json' },
  { id: 'lrc', name: '普通 LRC', extension: 'lrc' },
  { id: 'enhanced-lrc', name: '逐字 LRC', extension: 'lrc' },
  { id: 'srt', name: 'SRT 字幕', extension: 'srt' },
  { id: 'txt', name: '纯文本', extension: 'txt' }
]

const safeTime = (value: number | null | undefined): number =>
  Number.isFinite(value) ? Math.max(0, value ?? 0) : 0

export function formatExportTime(
  value: number | null | undefined,
  formatter: TimeFormatter
): string {
  const seconds = safeTime(value)
  if (formatter === 'seconds') return String(Number(seconds.toFixed(3)))
  if (formatter === 'milliseconds') return String(Math.round(seconds * 1000))
  const milliseconds = Math.round(seconds * 1000)
  const hours = Math.floor(milliseconds / 3_600_000)
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000)
  const secs = Math.floor((milliseconds % 60_000) / 1000)
  const millis = milliseconds % 1000
  if (formatter === 'hh:mm:ss.xxx') {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
  }
  const totalMinutes = hours * 60 + minutes
  const fraction =
    formatter === 'mm:ss.xx'
      ? String(Math.floor(millis / 10)).padStart(2, '0')
      : String(millis).padStart(3, '0')
  return `${String(totalMinutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${fraction}`
}

function lineBounds(line: LyricLine): { start: number; end: number } {
  const timed = line.tokens.filter((token) => token.start !== null)
  const start = safeTime(timed[0]?.start)
  const last = timed.at(-1)
  return { start, end: safeTime(last?.end ?? last?.start ?? start) }
}

function renderVariables(
  template: string,
  values: Record<string, string | number>,
  defaultFormatter: TimeFormatter
): string {
  return template.replace(
    /{{\s*([\w.]+)(?:\|([\w:.]+))?\s*}}/g,
    (_match, key: string, formatter?: string) => {
      if (!(key in values)) return ''
      const value = values[key]
      if (formatter) return formatExportTime(Number(value), formatter as TimeFormatter)
      if (/\.(?:start|end|duration)$/.test(key))
        return formatExportTime(Number(value), defaultFormatter)
      return String(value)
    }
  )
}

export function exportWithTemplate(project: LyricProject, template: ExportTemplate): string {
  return project.lines
    .map((line, lineIndex) => {
      const bounds = lineBounds(line)
      const tokens = line.tokens
        .map((token: LyricToken, tokenIndex) => {
          const start = safeTime(token.start)
          const end = safeTime(token.end ?? token.start)
          return renderVariables(
            template.tokenTemplate,
            {
              'token.index': tokenIndex + 1,
              'token.text': token.text,
              'token.start': start,
              'token.end': end,
              'token.duration': Math.max(0, end - start)
            },
            'seconds'
          )
        })
        .join('')
      return renderVariables(
        template.lineTemplate,
        {
          'line.index': lineIndex + 1,
          'line.text': line.text,
          'line.start': bounds.start,
          'line.end': bounds.end,
          'line.duration': Math.max(0, bounds.end - bounds.start),
          tokens
        },
        'seconds'
      )
    })
    .join(template.separator.replace(/\\n/g, '\n'))
}

function srtTime(seconds: number): string {
  return formatExportTime(seconds, 'hh:mm:ss.xxx').replace('.', ',')
}

export function exportLyrics(
  project: LyricProject,
  format: Exclude<ExportFormat, 'template'>
): string {
  if (format === 'json') return `${JSON.stringify(project, null, 2)}\n`
  if (format === 'txt') return `${project.lines.map((line) => line.text).join('\n')}\n`
  if (format === 'lrc')
    return `${project.lines.map((line) => `[${formatExportTime(lineBounds(line).start, 'mm:ss.xx')}]${line.text}`).join('\n')}\n`
  if (format === 'enhanced-lrc')
    return `${project.lines
      .map((line) => {
        const start = lineBounds(line).start
        const tokens = line.tokens
          .map((token) => `<${formatExportTime(token.start ?? start, 'mm:ss.xx')}>${token.text}`)
          .join('')
        return `[${formatExportTime(start, 'mm:ss.xx')}]${tokens}`
      })
      .join('\n')}\n`
  return `${project.lines
    .map((line, index) => {
      const bounds = lineBounds(line)
      return `${index + 1}\n${srtTime(bounds.start)} --> ${srtTime(Math.max(bounds.end, bounds.start + 0.5))}\n${line.text}`
    })
    .join('\n\n')}\n`
}
