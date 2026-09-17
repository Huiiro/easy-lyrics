export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.000'

  const totalMilliseconds = Math.floor(seconds * 1000)
  const minutes = Math.floor(totalMilliseconds / 60_000)
  const remaining = totalMilliseconds % 60_000
  const wholeSeconds = Math.floor(remaining / 1000)
  const milliseconds = remaining % 1000

  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

export function parseTimecode(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null

  if (!normalized.includes(':')) {
    const seconds = Number(normalized)
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
  }

  const match = /^(\d+):([0-5]?\d)(?:\.(\d{1,3}))?$/u.exec(normalized)
  if (!match) return null

  const minutes = Number(match[1])
  const seconds = Number(match[2])
  const milliseconds = Number((match[3] ?? '').padEnd(3, '0'))
  return minutes * 60 + seconds + milliseconds / 1000
}
