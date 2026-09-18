import { describe, expect, it } from 'vitest'

import { parsePlayerSongPayload, payloadPathFromUrl } from '../src/shared/integration'

describe('player integration', () => {
  it('parses a valid player payload', () => {
    expect(
      parsePlayerSongPayload({
        version: 1,
        audioPath: '/music/song.flac',
        title: 'Song',
        artist: 'Artist',
        album: 'Album',
        lyrics: '[00:01.00]Hello',
        lyricFormat: 'lrc'
      })
    ).toMatchObject({ title: 'Song', lyricFormat: 'lrc' })
  })

  it('extracts the payload path only from the open endpoint', () => {
    expect(payloadPathFromUrl('lyric-timeline://open?payload=%2Ftmp%2Fsong.json')).toBe(
      '/tmp/song.json'
    )
    expect(payloadPathFromUrl('https://example.com/?payload=/tmp/song.json')).toBeNull()
  })
})
