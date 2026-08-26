import { describe, expect, it } from 'vitest'
import type { ColorId, HexMatrix } from './types'
import { colorHexMap, paletteFromHexes } from './draft'
import { gridToHex, simulate } from './simulator'
import { generateFaithful, solveColumn } from './generate-faithful'

const k = '#000000'
const w = '#ffffff'
const r = '#ff0000'
const g = '#00ff00'

function column(c: string, rows: number): HexMatrix {
  return Array.from({ length: rows }, () => [c])
}

function fromColumn(colors: string[]): HexMatrix {
  return colors.map((c) => [c])
}

function roundTrip(target: HexMatrix) {
  const palette = paletteFromHexes(target.flat())
  const { draft, mismatch } = generateFaithful(target, palette, 'faithful', { weft: 'c0' })
  const sim = simulate(draft)
  const hex = gridToHex(sim.grid, colorHexMap(draft))
  return { draft, mismatch, hex, palette }
}

describe('solveColumn', () => {
  it('solves a single-color column with zero cost and uniform turns', () => {
    const sol = solveColumn(['k', 'k', 'k', 'k', 'k'])
    expect(sol.cost).toBe(0)
    expect(new Set(sol.turns).size).toBe(1)
    expect(sol.holes).toHaveLength(4)
  })

  it('solves an alternating two-color column with zero cost', () => {
    const sol = solveColumn(['k', 'w', 'k', 'w', 'k', 'w', 'k', 'w'])
    expect(sol.cost).toBe(0)
  })

  it('solves two-color blocks with zero cost and continuous turning', () => {
    const sol = solveColumn(['k', 'k', 'w', 'w', 'k', 'k', 'w', 'w'])
    expect(sol.cost).toBe(0)
    expect(sol.turns[0]).toBe(sol.turns[1])
  })

  it('prefers one flip over one mismatched cell', () => {
    const sol = solveColumn(['k', 'w', 'w', 'k', 'w'])
    expect(sol.cost).toBeLessThan(0.5)
  })

  it('solves a four-color cycle with zero cost', () => {
    const sol = solveColumn(['k', 'w', 'r', 'g', 'k', 'w', 'r', 'g'])
    expect(sol.cost).toBe(0)
  })
})

describe('generateFaithful', () => {
  it('reproduces a two-color blocked column exactly', () => {
    const target = fromColumn([k, k, w, w, k, k, w, w])
    const { mismatch, hex } = roundTrip(target)
    expect(mismatch).toBe(0)
    expect(hex).toEqual(target)
  })

  it('reproduces an alternating k,w,k,w column exactly', () => {
    const target = fromColumn([k, w, k, w, k, w, k, w])
    const { mismatch, hex } = roundTrip(target)
    expect(mismatch).toBe(0)
    expect(hex).toEqual(target)
  })

  it('reproduces a single-color column with any holes and uniform turns', () => {
    const target = column(k, 6)
    const { mismatch, hex, draft } = roundTrip(target)
    expect(mismatch).toBe(0)
    expect(hex).toEqual(target)
    expect(new Set(draft.rows.map((row) => row.turns[0])).size).toBe(1)
    expect(new Set(draft.tablets[0].holes as ColorId[])).toEqual(new Set(['c0']))
  })

  it('reproduces a four-color cycling column k,w,r,g exactly', () => {
    const target = fromColumn([k, w, r, g, k, w, r, g])
    const { mismatch, hex } = roundTrip(target)
    expect(mismatch).toBe(0)
    expect(hex).toEqual(target)
  })

  it('accepts a turning flip instead of a mismatched cell', () => {
    const target = fromColumn([k, w, w, k, w])
    const { mismatch, hex } = roundTrip(target)
    expect(mismatch).toBe(0)
    expect(hex).toEqual(target)
  })

  it('reproduces a multi-column pattern whose columns are each feasible', () => {
    const target: HexMatrix = [
      [k, w, w],
      [w, k, w],
      [w, w, k],
      [k, w, w],
      [w, k, w],
      [w, w, k],
    ]
    const { mismatch, hex } = roundTrip(target)
    expect(mismatch).toBe(0)
    expect(hex).toEqual(target)
  })

  it('reports a positive mismatch for an infeasible column', () => {
    const target = fromColumn([k, w, r, g, w, k])
    const { mismatch } = roundTrip(target)
    expect(mismatch).toBeGreaterThan(0)
    expect(mismatch).toBeLessThan(target.length)
  })
})
