import type { HexMatrix } from './types'
import { hexToRgb, nearestHex, rgbToHex } from './color'

export function rgbaToHexMatrix(
  data: Uint8ClampedArray | number[],
  width: number,
  height: number,
): HexMatrix {
  const rows: HexMatrix = []
  for (let y = 0; y < height; y++) {
    const row: string[] = []
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = data[i + 3] / 255
      const r = data[i] * a + 255 * (1 - a)
      const g = data[i + 1] * a + 255 * (1 - a)
      const b = data[i + 2] * a + 255 * (1 - a)
      row.push(rgbToHex(r, g, b))
    }
    rows.push(row)
  }
  return rows
}

interface Box {
  pixels: { r: number; g: number; b: number }[]
}

function boxRange(box: Box): { channel: 'r' | 'g' | 'b'; spread: number } {
  let best: { channel: 'r' | 'g' | 'b'; spread: number } = { channel: 'r', spread: -1 }
  for (const channel of ['r', 'g', 'b'] as const) {
    let min = Infinity
    let max = -Infinity
    for (const p of box.pixels) {
      if (p[channel] < min) min = p[channel]
      if (p[channel] > max) max = p[channel]
    }
    const spread = max - min
    if (spread > best.spread) best = { channel, spread }
  }
  return best
}

function boxAverageHex(box: Box): string {
  let r = 0
  let g = 0
  let b = 0
  for (const p of box.pixels) {
    r += p.r
    g += p.g
    b += p.b
  }
  const n = box.pixels.length
  return rgbToHex(r / n, g / n, b / n)
}

export function medianCutPalette(hexes: string[], maxColors: number): string[] {
  const pixels = hexes.map((h) => hexToRgb(h))
  const distinct = new Set(hexes)
  const target = Math.max(1, Math.min(maxColors, distinct.size))
  let boxes: Box[] = [{ pixels }]
  while (boxes.length < target) {
    let splitIndex = -1
    let splitSpread = -1
    let splitChannel: 'r' | 'g' | 'b' = 'r'
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].pixels.length < 2) continue
      const { channel, spread } = boxRange(boxes[i])
      if (spread > splitSpread) {
        splitSpread = spread
        splitIndex = i
        splitChannel = channel
      }
    }
    if (splitIndex === -1 || splitSpread === 0) break
    const box = boxes[splitIndex]
    const sorted = [...box.pixels].sort((a, b) => a[splitChannel] - b[splitChannel])
    const mid = Math.floor(sorted.length / 2)
    boxes = [
      ...boxes.slice(0, splitIndex),
      { pixels: sorted.slice(0, mid) },
      { pixels: sorted.slice(mid) },
      ...boxes.slice(splitIndex + 1),
    ]
  }
  const averaged = boxes.map(boxAverageHex)
  const unique: string[] = []
  for (const hex of averaged) {
    if (!unique.includes(hex)) unique.push(hex)
  }
  return unique.length > 0 ? unique : [averaged[0] ?? '#000000']
}

export interface QuantizeResult {
  paletteHex: string[]
  matrix: HexMatrix
}

export function quantizeMatrix(matrix: HexMatrix, maxColors: number): QuantizeResult {
  const all: string[] = []
  for (const row of matrix) all.push(...row)
  const palette = medianCutPalette(all, maxColors)
  const snapped = matrix.map((row) => row.map((hex) => nearestHex(hex, palette)))
  return { paletteHex: palette, matrix: snapped }
}

export function matrixMismatch(a: HexMatrix, b: HexMatrix): number {
  if (a.length !== b.length) return 1
  let total = 0
  let wrong = 0
  for (let y = 0; y < a.length; y++) {
    if (a[y].length !== b[y].length) return 1
    for (let x = 0; x < a[y].length; x++) {
      total++
      if (a[y][x] !== b[y][x]) wrong++
    }
  }
  return total === 0 ? 0 : wrong / total
}

export function suggestedRows(width: number, height: number, tablets: number): number {
  if (width <= 0 || height <= 0) return 32
  return Math.max(8, Math.min(240, Math.round((height / width) * tablets)))
}
