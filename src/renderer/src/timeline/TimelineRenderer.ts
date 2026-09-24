import type { LyricLine } from '@shared/models/project'
import type { WaveformData } from '@renderer/services/waveform'
import { TimelineHitTester, type TimelineHitRegion } from '@renderer/timeline/TimelineHitTester'
import { timeToX, type TimelineViewport } from '@renderer/timeline/viewport'

export interface TimelineRenderState {
  viewport: TimelineViewport
  height: number
  duration: number
  currentTime: number
  waveform: WaveformData | null
  lines: LyricLine[]
  activeTokenId: string | null
  selectedTokenIds: string[]
  selectionRect: { x: number; y: number; width: number; height: number } | null
  snapGuideTime: number | null
  loopStart: number | null
  loopEnd: number | null
}

type TimelineStaticRenderState = Omit<TimelineRenderState, 'currentTime'>

const rulerIntervals = [0.001, 0.01, 0.1, 0.5, 1, 5, 10, 30, 60, 300]

export function selectRulerInterval(pixelsPerSecond: number, minimumSpacing = 72): number {
  return rulerIntervals.find((interval) => interval * pixelsPerSecond >= minimumSpacing) ?? 300
}

export function formatRulerLabel(time: number, interval: number): string {
  const minutes = Math.floor(time / 60)
  const seconds = time - minutes * 60
  const decimals = interval < 0.01 ? 3 : interval < 1 ? 2 : 0
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(decimals).padStart(2 + (decimals ? decimals + 1 : 0), '0')}`
}

export class TimelineRenderer {
  private readonly hitTester = new TimelineHitTester()
  private hitRegions: TimelineHitRegion[] = []
  private playheadRegion: TimelineHitRegion | null = null

  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly playheadContext: CanvasRenderingContext2D
  ) {}

  drawStatic(state: TimelineStaticRenderState): void {
    const { context } = this
    this.hitRegions = []
    context.clearRect(0, 0, state.viewport.width, state.height)
    this.drawBackground(state)
    this.drawRuler(state)
    this.drawWaveform(state)
    this.drawLoopRange(state)
    this.drawTokens(state)
    this.drawSelectionRect(state)
    this.drawSnapGuide(state)
    this.hitTester.setRegions(this.hitRegions)
  }

  drawPlayhead(state: Pick<TimelineRenderState, 'viewport' | 'height' | 'currentTime'>): void {
    const context = this.playheadContext
    context.clearRect(0, 0, state.viewport.width, state.height)
    this.playheadRegion = null
    const x = Math.round(timeToX(state.currentTime, state.viewport)) + 0.5
    if (x < 0 || x > state.viewport.width) return
    context.strokeStyle = '#ff6b78'
    context.fillStyle = '#ff6b78'
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, state.height)
    context.stroke()
    context.beginPath()
    context.moveTo(x - 5, 0)
    context.lineTo(x + 5, 0)
    context.lineTo(x, 7)
    context.closePath()
    context.fill()
    this.playheadRegion = {
      type: 'playhead',
      id: 'playhead',
      x: x - 5,
      y: 0,
      width: 10,
      height: state.height
    }
  }

  private drawLoopRange(state: TimelineStaticRenderState): void {
    if (state.loopStart === null || state.loopEnd === null || state.loopEnd <= state.loopStart) return
    const x1 = timeToX(state.loopStart, state.viewport)
    const x2 = timeToX(state.loopEnd, state.viewport)
    if (x2 < 0 || x1 > state.viewport.width) return
    const { context } = this
    context.fillStyle = 'rgb(114 228 189 / 10%)'
    context.fillRect(x1, 27, x2 - x1, state.height - 27)
    context.strokeStyle = 'rgb(114 228 189 / 65%)'
    context.setLineDash([3, 3])
    for (const x of [x1, x2]) {
      context.beginPath()
      context.moveTo(x, 27)
      context.lineTo(x, state.height)
      context.stroke()
    }
    context.setLineDash([])
  }

  hitTest(x: number, y: number): TimelineHitRegion | null {
    const playhead = this.playheadRegion
    if (
      playhead &&
      x >= playhead.x &&
      x <= playhead.x + playhead.width &&
      y >= playhead.y &&
      y <= playhead.y + playhead.height
    ) {
      return playhead
    }
    return this.hitTester.hitTest(x, y)
  }

  private drawBackground(state: TimelineStaticRenderState): void {
    const { context } = this
    context.fillStyle = '#0b1014'
    context.fillRect(0, 0, state.viewport.width, state.height)
    context.fillStyle = '#10171c'
    context.fillRect(0, 27, state.viewport.width, state.height - 27)
  }

  private drawRuler(state: TimelineStaticRenderState): void {
    const { context } = this
    const interval = selectRulerInterval(state.viewport.pixelsPerSecond)
    const endTime = state.viewport.startTime + state.viewport.width / state.viewport.pixelsPerSecond
    const firstTick = Math.floor(state.viewport.startTime / interval) * interval

    context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
    context.textBaseline = 'top'
    context.strokeStyle = '#2b353d'
    context.fillStyle = '#778590'
    context.lineWidth = 1

    for (let time = firstTick; time <= endTime + interval; time += interval) {
      const x = Math.round(timeToX(time, state.viewport)) + 0.5
      if (x < 0) continue
      context.beginPath()
      context.moveTo(x, 18)
      context.lineTo(x, state.height)
      context.stroke()
      context.fillText(formatRulerLabel(Math.max(0, time), interval), x + 4, 4)
    }
  }

  private drawWaveform(state: TimelineStaticRenderState): void {
    if (!state.waveform?.peaks.length || state.waveform.duration <= 0) return

    const { context } = this
    const top = 34
    const bottom = Math.max(top + 10, state.height - 52)
    const center = (top + bottom) / 2
    const amplitude = (bottom - top) / 2
    const peaks = state.waveform.peaks

    context.strokeStyle = '#4aa98c'
    context.globalAlpha = 0.72
    context.beginPath()
    for (let x = 0; x < state.viewport.width; x += 1) {
      const time = state.viewport.startTime + x / state.viewport.pixelsPerSecond
      const peakIndex = Math.min(
        peaks.length - 1,
        Math.max(0, Math.floor((time / state.waveform.duration) * peaks.length))
      )
      const height = (peaks[peakIndex] ?? 0) * amplitude
      context.moveTo(x + 0.5, center - height)
      context.lineTo(x + 0.5, center + height)
    }
    context.stroke()
    context.globalAlpha = 1
  }

  private drawTokens(state: TimelineStaticRenderState): void {
    const { context } = this
    const y = state.height - 42
    const height = 27
    const selectedIds = new Set(state.selectedTokenIds)

    for (let lineIndex = 0; lineIndex < state.lines.length; lineIndex += 1) {
      const line = state.lines[lineIndex]
      if (!line) continue
      for (let index = 0; index < line.tokens.length; index += 1) {
        const token = line.tokens[index]
        if (!token || token.start === null) continue
        const nextStart = line.tokens[index + 1]?.start ?? null
        const end = token.end ?? nextStart ?? token.start + 0.12
        const x1 = timeToX(token.start, state.viewport)
        const x2 = timeToX(Math.max(end, token.start + 0.01), state.viewport)
        if (x2 < 0 || x1 > state.viewport.width) continue

        const width = Math.max(3, x2 - x1)
        const active = token.id === state.activeTokenId
        const selected = selectedIds.has(token.id)
        this.hitRegions.push({
          type: 'token-body',
          id: token.id,
          lineIndex,
          tokenIndex: index,
          x: x1,
          y,
          width,
          height
        })
        context.fillStyle = selected ? '#72e4bd' : '#203d35'
        context.strokeStyle = selected ? '#e3fff5' : '#3c7463'
        context.lineWidth = selected ? 1.5 : 1
        context.beginPath()
        context.roundRect(x1, y, width, height, 4)
        context.fill()
        context.stroke()

        if (width > 18) {
          context.save()
          context.beginPath()
          context.rect(x1 + 3, y, width - 6, height)
          context.clip()
          context.fillStyle = selected ? '#0b1713' : '#b2c9c1'
          context.font = '11px system-ui, sans-serif'
          context.textBaseline = 'middle'
          context.fillText(token.text, x1 + 6, y + height / 2)
          context.restore()
        }

        if (active && selected && selectedIds.size === 1) {
          const handleWidth = 8
          context.fillStyle = '#e3fff5'
          context.fillRect(x1 - handleWidth / 2, y + 3, handleWidth, height - 6)
          context.fillRect(x2 - handleWidth / 2, y + 3, handleWidth, height - 6)
          this.hitRegions.push(
            {
              type: 'token-left',
              id: token.id,
              lineIndex,
              tokenIndex: index,
              x: x1 - handleWidth,
              y,
              width: handleWidth * 2,
              height
            },
            {
              type: 'token-right',
              id: token.id,
              lineIndex,
              tokenIndex: index,
              x: x2 - handleWidth,
              y,
              width: handleWidth * 2,
              height
            }
          )
        }
      }
    }
  }

  private drawSelectionRect(state: TimelineStaticRenderState): void {
    if (!state.selectionRect) return
    const { x, y, width, height } = state.selectionRect
    const { context } = this
    context.save()
    context.fillStyle = 'rgb(114 228 189 / 12%)'
    context.strokeStyle = '#72e4bd'
    context.setLineDash([5, 3])
    context.fillRect(x, y, width, height)
    context.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1))
    context.restore()
  }

  private drawSnapGuide(state: TimelineStaticRenderState): void {
    if (state.snapGuideTime === null) return
    const x = Math.round(timeToX(state.snapGuideTime, state.viewport)) + 0.5
    const { context } = this
    context.save()
    context.strokeStyle = '#ffd166'
    context.setLineDash([4, 3])
    context.beginPath()
    context.moveTo(x, 27)
    context.lineTo(x, state.height)
    context.stroke()
    context.restore()
  }

}
