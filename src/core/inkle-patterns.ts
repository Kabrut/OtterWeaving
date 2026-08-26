import type { ColorId } from './types'
import type { InkleDraft, InklePass, InkleWarpThread } from './inkle'
import { paletteFromHexes } from './draft'
import { normalizeHex } from './color'

export interface InklePattern {
  id: string
  name: string
  description: string
  chart: string[]
  colors: { border: string; ground: string; pattern: string; weft: string }
}

export const INKLE_PATTERNS: InklePattern[] = [
  {
    id: 'gwiazda-baltycka',
    name: 'Gwiazda bałtycka',
    description: 'Ośmioramienna gwiazda o ostrych ramionach, przerzucana na jasnym tle.',
    chart: [
      '#...#...#',
      '.#.###.#.',
      '..#####..',
      '.#######.',
      '.#######.',
      '..#####..',
      '.#.###.#.',
      '#...#...#',
    ],
    colors: { border: '#1c1917', ground: '#f5f0e6', pattern: '#b91c1c', weft: '#1c1917' },
  },
  {
    id: 'serca',
    name: 'Serce',
    description: 'Serce o dwóch pełnych płatach u góry i ostrym czubku u dołu.',
    chart: [
      '.##...##.',
      '#########',
      '#########',
      '.#######.',
      '..#####..',
      '...###...',
      '....#....',
    ],
    colors: { border: '#292524', ground: '#faf5ef', pattern: '#dc2626', weft: '#292524' },
  },
  {
    id: 'romby',
    name: 'Romby',
    description: 'Łańcuszek konturowych rombów z kropką w środku każdego oka.',
    chart: [
      '...#...',
      '..#.#..',
      '.#...#.',
      '#..#..#',
      '.#...#.',
      '..#.#..',
      '...#...',
    ],
    colors: { border: '#1c1917', ground: '#f5f5f4', pattern: '#0f766e', weft: '#1c1917' },
  },
  {
    id: 'barani-rog',
    name: 'Barani róg',
    description: 'Dwa spiralne rogi wyrastające z czubka i zawijające się do środka.',
    chart: [
      '.....#.....',
      '...##.##...',
      '..##...##..',
      '.##.....##.',
      '##.......##',
      '.##.....##.',
      '..##...##..',
      '...#...#...',
      '..#.....#..',
    ],
    colors: { border: '#292524', ground: '#faf0dd', pattern: '#b45309', weft: '#292524' },
  },
]

export function inkleDraftFromChart(pattern: InklePattern, repeats = 3): InkleDraft {
  const chart = pattern.chart
  const width = chart[0]?.length ?? 0
  const palette = paletteFromHexes([
    pattern.colors.border,
    pattern.colors.ground,
    pattern.colors.pattern,
    pattern.colors.weft,
  ])
  const idByHex = new Map(palette.map((c) => [c.hex, c.id]))
  const idOf = (hex: string): ColorId => idByHex.get(normalizeHex(hex)) ?? 'c0'
  const borderId = idOf(pattern.colors.border)
  const groundId = idOf(pattern.colors.ground)
  const warp: InkleWarpThread[] = [
    { colorId: borderId, heddled: true, pattern: false },
    { colorId: borderId, heddled: false, pattern: false },
  ]
  for (let col = 0; col < width; col++) {
    warp.push({ colorId: groundId, heddled: true, pattern: false })
    warp.push({ colorId: idOf(pattern.colors.pattern), heddled: false, pattern: true })
  }
  warp.push({ colorId: borderId, heddled: false, pattern: false })
  warp.push({ colorId: borderId, heddled: true, pattern: false })
  const emptyPicks = () => new Array<boolean>(warp.length).fill(false)
  const passes: InklePass[] = []
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (const row of chart) {
      const picks = emptyPicks()
      for (let col = 0; col < width; col++) {
        if (row[col] === '#') picks[2 + 2 * col + 1] = true
      }
      passes.push({ up: true, picks })
      passes.push({ up: false, picks: emptyPicks() })
    }
  }
  return {
    version: 1,
    name: pattern.name,
    warp,
    weft: idOf(pattern.colors.weft),
    passes,
    palette,
  }
}
