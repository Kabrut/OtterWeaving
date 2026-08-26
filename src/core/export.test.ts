import { describe, expect, it } from 'vitest'
import type { Turn } from './types'
import { draftSvg, fabricSvg, threadingSvg, turningSvg } from './export'
import { buildDraft } from './draft.test'

const F = 'F' as Turn
const B = 'B' as Turn

const draft = buildDraft(
  [
    { holes: ['w', 'k', 'w', 'k'] },
    { holes: ['k', 'k', 'k', 'k'] },
    { holes: ['w', 'w', 'w', 'w'] },
  ],
  [
    [F, F, F],
    [F, F, B],
    [B, B, B],
    [F, F, F],
  ],
)

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

describe('fabricSvg', () => {
  it('renders an svg with one rect per grid cell', () => {
    const svg = fabricSvg(draft, 10, 8)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(count(svg, '<rect')).toBeGreaterThanOrEqual(draft.rows.length * draft.tablets.length)
  })

  it('fills cells with the simulated warp colors', () => {
    const svg = fabricSvg(draft, 10, 8)
    expect(count(svg, 'fill="#ffffff"')).toBeGreaterThanOrEqual(2)
    expect(count(svg, 'fill="#000000"')).toBeGreaterThanOrEqual(1)
  })
})

describe('turningSvg', () => {
  it('renders an svg with one turn cell per row and tablet', () => {
    const svg = turningSvg(draft)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(count(svg, '<rect')).toBeGreaterThanOrEqual(draft.rows.length * draft.tablets.length)
  })

  it('styles F cells white and B cells gray', () => {
    const svg = turningSvg(draft)
    const fCells = (svg.match(/<rect[^>]*fill="#ffffff"/g) ?? []).length
    const bCells = (svg.match(/<rect[^>]*fill="#d6d3d1"/g) ?? []).length
    expect(fCells).toBe(8)
    expect(bCells).toBe(4)
  })

  it('marks reversals with a red marker', () => {
    const svg = turningSvg(draft)
    expect(svg).toContain('#dc2626')
  })
})

describe('threadingSvg', () => {
  it('renders one circle per tablet hole', () => {
    const svg = threadingSvg(draft)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(count(svg, '<circle')).toBe(draft.tablets.length * 4)
  })

  it('labels rows with hole letters A-D', () => {
    const svg = threadingSvg(draft)
    for (const letter of ['A', 'B', 'C', 'D']) {
      expect(svg).toContain(`>${letter}</text>`)
    }
  })
})

describe('draftSvg', () => {
  it('embeds both the turning and threading diagrams', () => {
    const svg = draftSvg(draft)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(count(svg, '<circle')).toBe(draft.tablets.length * 4)
    expect(count(svg, '<rect')).toBeGreaterThanOrEqual(draft.rows.length * draft.tablets.length)
    expect(svg).toContain('test')
  })
})
