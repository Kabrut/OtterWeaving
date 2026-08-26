import type { Draft } from './types'

const TABLET_WIDTH_CM = 0.3
const PICK_SPACING_CM = 0.25
const WARP_TAKEUP = 1.35
const LOOM_WASTE_CM = 60
const WEFT_SLACK_CM = 8
const WEFT_TAKEUP = 1.05

export interface ThreadUsage {
  colorId: string
  hex: string
  name: string
  threadCount: number
  warpLengthCm: number
}

export interface WeftUsage {
  colorId: string
  hex: string
  rows: number
  lengthCm: number
}

export interface Metrics {
  tablets: number
  rows: number
  bandWidthCm: number
  wovenLengthCm: number
  warpLengthCm: number
  threads: ThreadUsage[]
  weft: WeftUsage[]
}

export function computeMetrics(draft: Draft): Metrics {
  const tablets = draft.tablets.length
  const rows = draft.rows.length
  const bandWidthCm = Math.round(tablets * TABLET_WIDTH_CM * 10) / 10
  const wovenLengthCm = Math.round(rows * PICK_SPACING_CM * 10) / 10
  const warpLengthCm = Math.round((wovenLengthCm * WARP_TAKEUP + LOOM_WASTE_CM) * 10) / 10
  const hexById = new Map(draft.palette.map((c) => [c.id, c]))
  const threadCounts = new Map<string, number>()
  for (const tablet of draft.tablets) {
    for (const hole of tablet.holes) {
      threadCounts.set(hole, (threadCounts.get(hole) ?? 0) + 1)
    }
  }
  const threads: ThreadUsage[] = []
  for (const [colorId, threadCount] of threadCounts) {
    const color = hexById.get(colorId)
    threads.push({
      colorId,
      hex: color?.hex ?? '#000000',
      name: color?.name ?? '',
      threadCount,
      warpLengthCm,
    })
  }
  threads.sort((a, b) => b.threadCount - a.threadCount)
  const weftCounts = new Map<string, number>()
  for (const row of draft.rows) {
    weftCounts.set(row.weft, (weftCounts.get(row.weft) ?? 0) + 1)
  }
  const weft: WeftUsage[] = []
  for (const [colorId, rowCount] of weftCounts) {
    const color = hexById.get(colorId)
    weft.push({
      colorId,
      hex: color?.hex ?? '#000000',
      rows: rowCount,
      lengthCm: Math.round(rowCount * (bandWidthCm + WEFT_SLACK_CM) * WEFT_TAKEUP * 10) / 10,
    })
  }
  weft.sort((a, b) => b.rows - a.rows)
  return { tablets, rows, bandWidthCm, wovenLengthCm, warpLengthCm, threads, weft }
}
