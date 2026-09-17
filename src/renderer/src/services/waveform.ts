export interface WaveformData {
  peaks: Float32Array
  duration: number
}

export function extractWaveformPeaks(
  channels: readonly Float32Array[],
  sampleCount: number,
  duration: number,
  targetPeakCount = 12_000
): WaveformData {
  if (sampleCount <= 0 || channels.length === 0 || duration <= 0) {
    return { peaks: new Float32Array(), duration: Math.max(0, duration) }
  }

  const samplesPerPeak = Math.max(1, Math.ceil(sampleCount / targetPeakCount))
  const peakCount = Math.ceil(sampleCount / samplesPerPeak)
  const peaks = new Float32Array(peakCount)

  for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
    const from = peakIndex * samplesPerPeak
    const to = Math.min(from + samplesPerPeak, sampleCount)
    let peak = 0

    for (const channel of channels) {
      for (let sampleIndex = from; sampleIndex < to; sampleIndex += 1) {
        peak = Math.max(peak, Math.abs(channel[sampleIndex] ?? 0))
      }
    }
    peaks[peakIndex] = peak
  }

  return { peaks, duration }
}

export async function decodeWaveform(source: string, signal?: AbortSignal): Promise<WaveformData> {
  const response = await fetch(source, { signal })
  if (!response.ok) throw new Error(`Unable to load audio: ${response.status}`)

  const encoded = await response.arrayBuffer()
  const context = new AudioContext()
  try {
    const buffer = await context.decodeAudioData(encoded)
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
      buffer.getChannelData(index)
    )
    return extractWaveformPeaks(channels, buffer.length, buffer.duration)
  } finally {
    await context.close()
  }
}
