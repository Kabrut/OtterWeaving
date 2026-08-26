import type { ColorId, Draft, HexMatrix, ThreadColor } from './types'
import { HOLES } from './types'
import { makeRow, makeTablet } from './draft'

export function columnDistinctColors(column: ColorId[], maxColors: number): ColorId[] {
  const counts = new Map<ColorId, number>()
  const firstIndex = new Map<ColorId, number>()
  column.forEach((c, i) => {
    counts.set(c, (counts.get(c) ?? 0) + 1)
    if (!firstIndex.has(c)) firstIndex.set(c, i)
  })
  const byFrequency = [...counts.keys()].sort((a, b) => {
    const ca = counts.get(a) ?? 0
    const cb = counts.get(b) ?? 0
    if (ca !== cb) return cb - ca
    return (firstIndex.get(a) ?? 0) - (firstIndex.get(b) ?? 0)
  })
  const selected = new Set(byFrequency.slice(0, maxColors))
  const ordered: ColorId[] = []
  column.forEach((c) => {
    if (selected.has(c) && !ordered.includes(c)) ordered.push(c)
  })
  return ordered
}

export function threadedinHoles(distinct: ColorId[]): ColorId[] {
  const m = distinct.length
  const holes: ColorId[] = []
  for (let j = 0; j < HOLES; j++) {
    holes.push(distinct[(HOLES - 1 - j) % m])
  }
  return holes
}

export interface ThreadedinOptions {
  reverseEvery: number
  weft: ColorId
}

export function generateThreadedin(
  target: HexMatrix,
  palette: ThreadColor[],
  name: string,
  options: ThreadedinOptions,
): Draft {
  const rowsCount = target.length
  const tabletsCount = target[0]?.length ?? 0
  const hexToId = new Map(palette.map((c) => [c.hex, c.id]))
  const columns: ColorId[][] = []
  for (let x = 0; x < tabletsCount; x++) {
    columns.push(target.map((row) => hexToId.get(row[x]) ?? palette[0].id))
  }
  const tablets = columns.map((column) => {
    const distinct = columnDistinctColors(column, HOLES)
    return makeTablet(threadedinHoles(distinct))
  })
  const rows = []
  for (let r = 0; r < rowsCount; r++) {
    const blockIndex = Math.floor(r / Math.max(1, options.reverseEvery))
    const turn = blockIndex % 2 === 0 ? 'F' : 'B'
    rows.push(makeRow(Array(tabletsCount).fill(turn), options.weft))
  }
  return { version: 1, name, tablets, rows, palette: [...palette] }
}
