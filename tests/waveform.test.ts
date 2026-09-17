import { describe, expect, it } from 'vitest'

import { extractWaveformPeaks } from '../src/renderer/src/services/waveform'

describe('extractWaveformPeaks', () => {
  it('keeps the maximum absolute sample across channels in each bucket', () => {
    const waveform = extractWaveformPeaks(
      [
        new Float32Array([0.1, -0.5, 0.2, 0.4, -0.1, 0.3, 0.2, -0.2]),
        new Float32Array([0.2, 0.1, -1, 0.2, 0.6, 0.1, -0.4, 0.2])
      ],
      8,
      4,
      4
    )

    expect(Array.from(waveform.peaks, (peak) => Number(peak.toFixed(3)))).toEqual([
      0.5, 1, 0.6, 0.4
    ])
    expect(waveform.duration).toBe(4)
  })

  it('returns an empty waveform for invalid audio data', () => {
    expect(extractWaveformPeaks([], 0, 0).peaks).toHaveLength(0)
  })
})
