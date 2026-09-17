export const MIN_TOKEN_DURATION = 0.01
export const SNAP_THRESHOLD_PIXELS = 5

export interface TokenTimingSnapshot {
  id: string
  lineIndex: number
  tokenIndex: number
  start: number | null
  end: number | null
}

export interface SnapResult {
  time: number
  snappedTo: number | null
}

export function snapTime(time: number, candidates: number[], threshold: number): SnapResult {
  let snappedTo: number | null = null
  let distance = threshold + Number.EPSILON

  for (const candidate of candidates) {
    const nextDistance = Math.abs(candidate - time)
    if (nextDistance <= threshold && nextDistance < distance) {
      snappedTo = candidate
      distance = nextDistance
    }
  }

  return { time: snappedTo ?? time, snappedTo }
}

export function clampTokenMove(
  start: number,
  end: number | null,
  delta: number,
  duration = Number.POSITIVE_INFINITY
): { start: number; end: number | null } {
  const latestDelta = end === null ? duration - start : duration - end
  const appliedDelta = Math.min(Math.max(delta, -start), latestDelta)
  return {
    start: start + appliedDelta,
    end: end === null ? null : end + appliedDelta
  }
}

export function clampTokenStart(start: number, end: number | null): number {
  return Math.max(0, end === null ? start : Math.min(start, end - MIN_TOKEN_DURATION))
}

export function clampTokenEnd(start: number, end: number, duration: number): number {
  return Math.min(Math.max(end, start + MIN_TOKEN_DURATION), duration || Number.POSITIVE_INFINITY)
}

export function clampGroupDelta(
  tokens: TokenTimingSnapshot[],
  delta: number,
  duration = Number.POSITIVE_INFINITY
): number {
  const timed = tokens.filter((token) => token.start !== null)
  if (!timed.length) return 0
  const minimumStart = Math.min(...timed.map((token) => token.start as number))
  const ends = timed.flatMap((token) =>
    token.end === null ? [token.start as number] : [token.end]
  )
  const maximumEnd = Math.max(...ends)
  return Math.min(Math.max(delta, -minimumStart), duration - maximumEnd)
}
