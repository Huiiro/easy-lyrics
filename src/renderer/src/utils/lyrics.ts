import type { LyricLine } from '@shared/models/project'

export type LineTimingStatus = 'pending' | 'partial' | 'complete'

export function getLineStart(line: LyricLine): number | null {
  return line.tokens.find((token) => token.start !== null)?.start ?? null
}

export function getLineTimingStatus(line: LyricLine): LineTimingStatus {
  const timedCount = line.tokens.filter((token) => token.start !== null).length
  if (timedCount === 0) return 'pending'
  if (timedCount === line.tokens.length) return 'complete'
  return 'partial'
}
