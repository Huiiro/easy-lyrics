export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.000'

  const totalMilliseconds = Math.floor(seconds * 1000)
  const minutes = Math.floor(totalMilliseconds / 60_000)
  const remaining = totalMilliseconds % 60_000
  const wholeSeconds = Math.floor(remaining / 1000)
  const milliseconds = remaining % 1000

  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}
