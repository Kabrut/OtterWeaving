import type { ColorId, HexMatrix } from './types'
import type { InkleDraft, InklePass, InkleWarpThread } from './inkle'
import { paletteFromHexes } from './draft'
import { nearestHex, normalizeHex } from './color'

export interface InkleGenerateOptions {
  name: string
  groundHex: string
  borderHex: string
  weftHex: string
  patternColorCount?: number
}

function countBy(hexes: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const hex of hexes) {
    const key = normalizeHex(hex)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function dominantHex(counts: Map<string, number>): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const [hex, count] of counts) {
    if (count > bestCount) {
      best = hex
      bestCount = count
    }
  }
  return best
}

export function dominantGround(matrix: HexMatrix): string {
  const all: string[] = []
  for (const row of matrix) all.push(...row)
  if (all.length === 0) return ''
  return dominantHex(countBy(all)) ?? ''
}

export function generateInkleFromMatrix(
  matrix: HexMatrix,
  options: InkleGenerateOptions,
): InkleDraft {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  const ground = normalizeHex(options.groundHex)
  const maxPatternColors = Math.max(1, Math.min(3, Math.floor(options.patternColorCount ?? 1)))
  const nonGroundCounts = new Map<string, number>()
  for (const row of matrix) {
    for (const cell of row) {
      const hex = normalizeHex(cell)
      if (hex === ground) continue
      nonGroundCounts.set(hex, (nonGroundCounts.get(hex) ?? 0) + 1)
    }
  }
  const globalDominant = dominantHex(nonGroundCounts)
  const allowedColors = [...nonGroundCounts.keys()]
    .sort((a, b) => (nonGroundCounts.get(b) ?? 0) - (nonGroundCounts.get(a) ?? 0))
    .slice(0, maxPatternColors)
  const patternHexes: string[] = []
  for (let col = 0; col < cols; col++) {
    const columnCounts = new Map<string, number>()
    for (let r = 0; r < rows; r++) {
      const hex = normalizeHex(matrix[r][col] ?? ground)
      if (hex === ground) continue
      columnCounts.set(hex, (columnCounts.get(hex) ?? 0) + 1)
    }
    const dominant = dominantHex(columnCounts) ?? globalDominant
    let patternHex = ground
    if (dominant !== null) {
      patternHex = allowedColors.includes(dominant)
        ? dominant
        : nearestHex(dominant, allowedColors)
    }
    patternHexes.push(patternHex)
  }
  const palette = paletteFromHexes([
    options.borderHex,
    ground,
    ...patternHexes,
    options.weftHex,
  ])
  const idByHex = new Map(palette.map((c) => [c.hex, c.id]))
  const idOf = (hex: string): ColorId => idByHex.get(normalizeHex(hex)) ?? 'c0'
  const borderId = idOf(options.borderHex)
  const groundId = idOf(ground)
  const warp: InkleWarpThread[] = [
    { colorId: borderId, heddled: true, pattern: false },
    { colorId: borderId, heddled: false, pattern: false },
  ]
  for (let col = 0; col < cols; col++) {
    warp.push({ colorId: groundId, heddled: true, pattern: false })
    warp.push({ colorId: idOf(patternHexes[col]), heddled: false, pattern: true })
  }
  warp.push({ colorId: borderId, heddled: false, pattern: false })
  warp.push({ colorId: borderId, heddled: true, pattern: false })
  const emptyPicks = () => new Array<boolean>(warp.length).fill(false)
  const passes: InklePass[] = []
  for (let r = 0; r < rows; r++) {
    const picks = emptyPicks()
    for (let col = 0; col < cols; col++) {
      if (normalizeHex(matrix[r][col] ?? ground) !== ground) picks[2 + 2 * col + 1] = true
    }
    passes.push({ up: true, picks })
    passes.push({ up: false, picks: emptyPicks() })
  }
  return {
    version: 1,
    name: options.name,
    warp,
    weft: idOf(options.weftHex),
    passes,
    palette,
  }
}
