import type { LyricLine, LyricToken } from '@shared/models/project'

export interface TokenCursor {
  lineIndex: number
  tokenIndex: number
}

export interface TimingResult {
  cursor: TokenCursor
  finished: boolean
}

export function getToken(lines: LyricLine[], cursor: TokenCursor): LyricToken | null {
  return lines[cursor.lineIndex]?.tokens[cursor.tokenIndex] ?? null
}

export function previousCursor(lines: LyricLine[], cursor: TokenCursor): TokenCursor | null {
  if (cursor.tokenIndex > 0) {
    return { lineIndex: cursor.lineIndex, tokenIndex: cursor.tokenIndex - 1 }
  }

  for (let lineIndex = cursor.lineIndex - 1; lineIndex >= 0; lineIndex -= 1) {
    const tokens = lines[lineIndex]?.tokens
    if (tokens?.length) return { lineIndex, tokenIndex: tokens.length - 1 }
  }
  return null
}

export function nextCursor(lines: LyricLine[], cursor: TokenCursor): TokenCursor | null {
  const currentLine = lines[cursor.lineIndex]
  if (currentLine && cursor.tokenIndex + 1 < currentLine.tokens.length) {
    return { lineIndex: cursor.lineIndex, tokenIndex: cursor.tokenIndex + 1 }
  }

  for (let lineIndex = cursor.lineIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    if (lines[lineIndex]?.tokens.length) return { lineIndex, tokenIndex: 0 }
  }
  return null
}

export function markTokenAtTime(
  lines: LyricLine[],
  cursor: TokenCursor,
  requestedTime: number
): TimingResult | null {
  const token = getToken(lines, cursor)
  if (!token || !Number.isFinite(requestedTime)) return null

  const previous = previousCursor(lines, cursor)
  const previousToken = previous ? getToken(lines, previous) : null
  const time = Math.max(0, requestedTime, previousToken?.start ?? 0)
  const next = nextCursor(lines, cursor)

  if (!next && token.start !== null) {
    token.end = Math.max(token.start, time)
    return { cursor, finished: true }
  }

  token.start = time
  token.end = null
  if (previousToken?.start !== null && previousToken?.start !== undefined) {
    previousToken.end = Math.max(previousToken.start, time)
  }

  return { cursor: next ?? cursor, finished: false }
}
