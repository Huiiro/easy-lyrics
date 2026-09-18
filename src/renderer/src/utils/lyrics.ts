import type { LyricLine } from '@shared/models/project'

export function getPlaybackLineIndex(lines: LyricLine[], time: number): number {
  if (!Number.isFinite(time) || time < 0) return -1
  let matchedLine = -1
  let latestStart = -1
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    for (const token of lines[lineIndex]?.tokens ?? []) {
      if (token.start !== null && token.start <= time && token.start >= latestStart) {
        matchedLine = lineIndex
        latestStart = token.start
      }
    }
  }
  return matchedLine
}

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
