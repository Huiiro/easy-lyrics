import { describe, expect, it } from 'vitest'
import { exportLyrics, exportWithTemplate, formatExportTime } from '../src/shared/export'
import type { LyricProject } from '../src/shared/models/project'

const project: LyricProject = {
  version: 1, id: 'p', name: 'Song', audio: null,
  metadata: { title: '', artist: '', album: '' }, settings: { timingOffsetMs: 0, tokenizer: 'char' },
  createdAt: 0, updatedAt: 0,
  lines: [{ id: 'l', text: '你好', tokens: [
    { id: 'a', text: '你', start: 10.36, end: 10.82 },
    { id: 'b', text: '好', start: 10.82, end: 11.2 }
  ] }]
}

describe('lyric export', () => {
  it('formats supported timestamps', () => {
    expect(formatExportTime(70.369, 'mm:ss.xx')).toBe('01:10.36')
    expect(formatExportTime(70.369, 'hh:mm:ss.xxx')).toBe('00:01:10.369')
    expect(formatExportTime(1.234, 'milliseconds')).toBe('1234')
  })
  it('exports line and enhanced LRC', () => {
    expect(exportLyrics(project, 'lrc')).toBe('[00:10.36]你好\n')
    expect(exportLyrics(project, 'enhanced-lrc')).toContain('<00:10.36>你<00:10.82>好')
  })
  it('exports SRT and templates', () => {
    expect(exportLyrics(project, 'srt')).toContain('00:00:10,360 --> 00:00:11,200')
    expect(exportWithTemplate(project, {
      id: 'x', name: 'x', extension: 'txt', separator: '\\n',
      lineTemplate: '{{line.index}}:{{tokens}}', tokenTemplate: '{{token.text}}@{{token.start|milliseconds}}'
    })).toBe('1:你@10360好@10820')
  })
})
