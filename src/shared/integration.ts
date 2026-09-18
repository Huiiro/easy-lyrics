export const LYRIC_TIMELINE_PROTOCOL = 'lyric-timeline'

export interface PlayerSongPayload {
  version: 1
  audioPath: string
  title: string
  artist: string
  album: string
  lyrics: string
  lyricFormat?: 'lrc' | 'elrc' | 'yrc' | 'ttml' | 'plain'
}

export function parsePlayerSongPayload(value: unknown): PlayerSongPayload {
  if (!value || typeof value !== 'object') throw new Error('Invalid player payload')
  const item = value as Record<string, unknown>
  if (item.version !== 1 || typeof item.audioPath !== 'string' || !item.audioPath.trim()) {
    throw new Error('Invalid player payload')
  }

  const text = (key: string): string => (typeof item[key] === 'string' ? item[key] : '')
  const format = item.lyricFormat
  const lyricFormat = ['lrc', 'elrc', 'yrc', 'ttml', 'plain'].includes(String(format))
    ? (format as PlayerSongPayload['lyricFormat'])
    : undefined

  return {
    version: 1,
    audioPath: item.audioPath,
    title: text('title'),
    artist: text('artist'),
    album: text('album'),
    lyrics: text('lyrics'),
    ...(lyricFormat ? { lyricFormat } : {})
  }
}

export function payloadPathFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== `${LYRIC_TIMELINE_PROTOCOL}:` || url.hostname !== 'open') return null
    return url.searchParams.get('payload')
  } catch {
    return null
  }
}
