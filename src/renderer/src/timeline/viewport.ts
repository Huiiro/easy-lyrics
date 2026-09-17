export interface TimelineViewport {
  startTime: number
  pixelsPerSecond: number
  width: number
}

export const MIN_PIXELS_PER_SECOND = 20
export const MAX_PIXELS_PER_SECOND = 2000

export function timeToX(time: number, viewport: TimelineViewport): number {
  return (time - viewport.startTime) * viewport.pixelsPerSecond
}

export function xToTime(x: number, viewport: TimelineViewport): number {
  return viewport.startTime + x / viewport.pixelsPerSecond
}

export function clampStartTime(
  startTime: number,
  viewport: TimelineViewport,
  duration: number
): number {
  const visibleDuration = viewport.width / viewport.pixelsPerSecond
  const maximum = Math.max(0, duration - visibleDuration)
  return Math.min(Math.max(startTime, 0), maximum)
}

export function zoomViewportAt(
  viewport: TimelineViewport,
  anchorX: number,
  scale: number,
  duration: number
): TimelineViewport {
  const anchorTime = xToTime(anchorX, viewport)
  const pixelsPerSecond = Math.min(
    Math.max(viewport.pixelsPerSecond * scale, MIN_PIXELS_PER_SECOND),
    MAX_PIXELS_PER_SECOND
  )
  const next = {
    ...viewport,
    pixelsPerSecond,
    startTime: anchorTime - anchorX / pixelsPerSecond
  }
  next.startTime = clampStartTime(next.startTime, next, duration)
  return next
}

export function panViewportByPixels(
  viewport: TimelineViewport,
  deltaPixels: number,
  duration: number
): TimelineViewport {
  const next = {
    ...viewport,
    startTime: viewport.startTime - deltaPixels / viewport.pixelsPerSecond
  }
  next.startTime = clampStartTime(next.startTime, next, duration)
  return next
}
