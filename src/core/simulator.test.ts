import { describe, expect, it } from 'vitest'
import type { ColorId, Turn } from './types'
import { gridToHex, nextState, revealIndex, simulate } from './simulator'
import { templateChevron, templateDiagonals, templateStripes } from './templates'
import { buildDraft } from './draft.test'

const F = 'F' as Turn
const B = 'B' as Turn

function gridOf(tablets: { holes: ColorId[] }[], turns: Turn[][]): ColorId[][] {
  return simulate(buildDraft(tablets, turns)).grid
}

describe('simulator — konwencja TDD (odsłoń, potem obrót; start: otwór D)', () => {
  it('pasy poziome: naprzemienne otwory, same obroty F', () => {
    const grid = gridOf([{ holes: ['w', 'k', 'w', 'k'] }], [[F], [F], [F], [F]])
    expect(grid.map((row) => row[0])).toEqual(['k', 'w', 'k', 'w'])
  })

  it('pasy pionowe: jednolita tabliczka niezależnie od obrotów', () => {
    const grid = gridOf(
      [
        { holes: ['k', 'k', 'k', 'k'] },
        { holes: ['w', 'w', 'w', 'w'] },
      ],
      [
        [F, F],
        [B, F],
        [F, B],
      ],
    )
    expect(grid).toEqual([
      ['k', 'w'],
      ['k', 'w'],
      ['k', 'w'],
    ])
  })

  it('sekwencja F odsłania D→C→B→A, sekwencja B odsłania A→B→C→D', () => {
    const holes: ColorId[] = ['c0', 'c1', 'c2', 'c3']
    const palette = holes.map((id) => ({ id, hex: `#0000${id.slice(1)}0`.padEnd(7, '0'), name: id }))
    const draft = {
      version: 1 as const,
      name: 'seq',
      tablets: [{ holes: [holes[0], holes[1], holes[2], holes[3]] as [ColorId, ColorId, ColorId, ColorId], twist: 'Z' as const }],
      rows: [
        { turns: [F], weft: holes[0] },
        { turns: [F], weft: holes[0] },
        { turns: [F], weft: holes[0] },
        { turns: [F], weft: holes[0] },
      ],
      palette,
    }
    const forward = simulate(draft).grid.map((row) => row[0])
    expect(forward).toEqual(['c3', 'c2', 'c1', 'c0'])
    const backward = simulate({
      ...draft,
      rows: draft.rows.map((r) => ({ turns: [B], weft: r.weft })),
    })
      .grid.map((row) => row[0])
    expect(backward).toEqual(['c0', 'c1', 'c2', 'c3'])
  })

  it('ciągłość stanu: F,F,B odsłania c3,c2,c2', () => {
    const grid = gridOf([{ holes: ['c0', 'c1', 'c2', 'c3'] }], [[F], [F], [B]])
    expect(grid.map((r) => r[0])).toEqual(['c3', 'c2', 'c2'])
  })

  it('kierunek nawleczenia S/Z nie zmienia drawdownu (konwencja TDD)', () => {
    const tablets = [{ holes: ['w', 'k', 'w', 'k'], twist: 'Z' as const }]
    const turns = [
      [F],
      [F],
      [B],
      [F],
    ]
    const z = simulate(buildDraft(tablets, turns)).grid
    const s = simulate(buildDraft([{ ...tablets[0], twist: 'S' }], turns)).grid
    expect(z).toEqual(s)
  })

  it('liczy netto obrotów per tabliczka', () => {
    const sim = simulate(buildDraft([{ holes: ['w'] }], [[F], [F], [F], [B]]))
    expect(sim.netTurns).toEqual([2])
  })
})

describe('szablony referencyjne', () => {
  const dk = 'k'
  const lt = 'w'

  function egyptianHoles(i: number): ColorId[] {
    const holes: ColorId[] = []
    for (let h = 0; h < 4; h++) {
      holes.push(h === i % 4 || h === (i + 1) % 4 ? dk : lt)
    }
    return holes
  }

  it('diagonale egipskie: pasy 2-szerokie przesuwają się co prześwit', () => {
    const draft = templateDiagonals('d', 8, 4, dk, lt)
    const grid = simulate(draft).grid
    const expected = [
      [0, 0, 1, 1, 0, 0, 1, 1],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [1, 1, 0, 0, 1, 1, 0, 0],
      [1, 0, 0, 1, 1, 0, 0, 1],
    ]
    expect(grid.map((row) => row.map((c) => (c === dk ? 1 : 0)))).toEqual(expected)
    expect(draft.tablets[3].holes).toEqual(egyptianHoles(3))
  })

  it('jodełka: odwrócenie kierunku w połowie tworzy V', () => {
    const draft = templateChevron('c', 8, 8, dk, lt)
    const grid = simulate(draft).grid
    const expected = [
      [0, 0, 1, 1, 0, 0, 1, 1],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [1, 1, 0, 0, 1, 1, 0, 0],
      [1, 0, 0, 1, 1, 0, 0, 1],
      [1, 0, 0, 1, 1, 0, 0, 1],
      [1, 1, 0, 0, 1, 1, 0, 0],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 0, 1, 1, 0, 0, 1, 1],
    ]
    expect(grid.map((row) => row.map((c) => (c === dk ? 1 : 0)))).toEqual(expected)
  })

  it('pasy: naprzemienne wiersze dwóch kolorów', () => {
    const draft = templateStripes('s', 4, 4, dk, lt)
    const grid = simulate(draft).grid
    expect(grid[0]).toEqual([dk, dk, dk, dk])
    expect(grid[1]).toEqual([lt, lt, lt, lt])
    expect(grid[2]).toEqual([dk, dk, dk, dk])
  })

  it('pasy: threading [b,a,b,a] z wątkiem a, same obroty F', () => {
    const draft = templateStripes('s', 2, 2, dk, lt)
    expect(draft.tablets[0].holes).toEqual([lt, dk, lt, dk])
    expect(draft.tablets[0].twist).toBe('Z')
    expect(draft.rows[0].weft).toBe(dk)
    expect(draft.rows.map((r) => r.turns)).toEqual([
      ['F', 'F'],
      ['F', 'F'],
    ])
  })

  it('diagonale: threading egipskie ma ciemne w parach sąsiednich otworów', () => {
    const draft = templateDiagonals('d', 8, 2, dk, lt)
    for (let i = 0; i < 8; i++) {
      expect(draft.tablets[i].holes).toEqual(egyptianHoles(i))
    }
    expect(draft.rows.every((r) => r.turns.every((t) => t === 'F'))).toBe(true)
  })
})

describe('przejścia stanu i gridToHex', () => {
  it('F odsłania stan bieżący i przechodzi do s-1, B odsłania s+1 i przechodzi do s+1', () => {
    expect(revealIndex(3, 'F')).toBe(3)
    expect(nextState(3, 'F')).toBe(2)
    expect(revealIndex(3, 'B')).toBe(0)
    expect(nextState(3, 'B')).toBe(0)
    expect(revealIndex(0, 'F')).toBe(0)
    expect(nextState(0, 'F')).toBe(3)
  })

  it('gridToHex mapuje id na hexy z czarnym fallbackiem', () => {
    const grid: ColorId[][] = [
      ['w', 'k'],
      ['k', 'x'],
    ]
    const hexById = new Map<ColorId, string>([
      ['w', '#ffffff'],
      ['k', '#000000'],
    ])
    expect(gridToHex(grid, hexById)).toEqual([
      ['#ffffff', '#000000'],
      ['#000000', '#000000'],
    ])
  })
})
