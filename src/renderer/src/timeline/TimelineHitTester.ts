export type TimelineHitRegionType = 'token-body' | 'token-left' | 'token-right' | 'playhead'

export interface TimelineHitRegion {
  type: TimelineHitRegionType
  id: string
  x: number
  y: number
  width: number
  height: number
  lineIndex?: number
  tokenIndex?: number
}

export class TimelineHitTester {
  private regions: TimelineHitRegion[] = []

  setRegions(regions: TimelineHitRegion[]): void {
    this.regions = regions
  }

  hitTest(x: number, y: number): TimelineHitRegion | null {
    for (let index = this.regions.length - 1; index >= 0; index -= 1) {
      const region = this.regions[index]
      if (
        region &&
        x >= region.x &&
        x <= region.x + region.width &&
        y >= region.y &&
        y <= region.y + region.height
      ) {
        return region
      }
    }
    return null
  }
}
