import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { createAudioResponse } from '../src/main/audio-response'

describe('audio protocol response', () => {
  let audioPath: string

  beforeAll(async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lyric-audio-test-'))
    audioPath = join(directory, 'sample.mp3')
    await writeFile(audioPath, Buffer.from('0123456789'))
  })

  it('serves the complete audio file with range support', async () => {
    const response = await createAudioResponse(audioPath, null)

    expect(response.status).toBe(200)
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.headers.get('content-length')).toBe('10')
    expect(response.headers.get('content-type')).toBe('audio/mpeg')
    expect(await response.text()).toBe('0123456789')
  })

  it('returns a partial response for media seek requests', async () => {
    const response = await createAudioResponse(audioPath, 'bytes=3-6')

    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 3-6/10')
    expect(response.headers.get('content-length')).toBe('4')
    expect(await response.text()).toBe('3456')
  })

  it('rejects an unsatisfiable media range', async () => {
    const response = await createAudioResponse(audioPath, 'bytes=20-30')

    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */10')
  })
})
