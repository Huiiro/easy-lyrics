import type { LyricLine, LyricToken } from '@shared/models/project'

export interface TokenCursor {
  lineIndex: number
  tokenIndex: number
}

export interface TimingResult {
  cursor: TokenCursor
  finished: boolean
}

export interface AutomaticTimingUpdate {
  lineIndex: number
  tokenIndex: number
  start: number
  end: number
}

/** Build a continuous first-pass track while retaining valid imported anchors. */
export function createAutomaticTiming(
  lines: LyricLine[],
  duration: number
): AutomaticTimingUpdate[] {
  if (!Number.isFinite(duration) || duration <= 0) return []

  const flat = lines.flatMap((line, lineIndex) =>
    line.tokens.map((token, tokenIndex) => ({ lineIndex, tokenIndex, token }))
  )
  if (flat.length === 0) return []

  const anchors: Array<{ index: number; time: number }> = []
  let previousTime = -1
  for (let index = 0; index < flat.length; index += 1) {
    const start = flat[index]?.token.start
    if (start === null || start === undefined || start < previousTime || start > duration) continue
    anchors.push({ index, time: start })
    previousTime = start
  }

  if (anchors[0]?.index !== 0) anchors.unshift({ index: 0, time: 0 })
  anchors.push({ index: flat.length, time: duration })

  const starts = new Array<number>(flat.length)
  for (let anchorIndex = 0; anchorIndex < anchors.length - 1; anchorIndex += 1) {
    const from = anchors[anchorIndex]!
    const to = anchors[anchorIndex + 1]!
    const count = to.index - from.index
    if (count <= 0) continue
    for (let offset = 0; offset < count; offset += 1) {
      starts[from.index + offset] = from.time + ((to.time - from.time) * offset) / count
    }
  }

  return flat.map(({ lineIndex, tokenIndex }, index) => ({
    lineIndex,
    tokenIndex,
    start: starts[index] ?? 0,
    end: starts[index + 1] ?? duration
  }))
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
