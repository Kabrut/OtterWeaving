import { describe, expect, it } from 'vitest'
import { validateDraft } from './draft'
import { simulate } from './simulator'
import { TABLET_PATTERNS } from './patterns'

function patternById(id: string) {
  const pattern = TABLET_PATTERNS.find((p) => p.id === id)
  if (!pattern) throw new Error(`nieznany wzór: ${id}`)
  return pattern
}

describe('galeria wzorów', () => {
  it('zawiera komplet sześciu wzorów o unikalnych id', () => {
    expect(TABLET_PATTERNS.map((p) => p.id)).toEqual([
      'pasy',
      'diagonale',
      'diagonale-3',
      'jodelka',
      'romby',
      'plastry-miodu',
    ])
  })

  for (const pattern of TABLET_PATTERNS) {
    describe(`wzór ${pattern.id}`, () => {
      const draft = pattern.build()

      it('przechodzi walidację bez błędów', () => {
        expect(validateDraft(draft)).toEqual([])
      })

      it('ma rozsądne rozmiary i spójną nazwę', () => {
        expect(draft.name).toBe(pattern.name)
        expect(draft.tablets.length).toBeGreaterThanOrEqual(12)
        expect(draft.tablets.length).toBeLessThanOrEqual(24)
        expect(draft.rows.length).toBeGreaterThanOrEqual(28)
        expect(draft.rows.length).toBeLessThanOrEqual(64)
      })

      it('symulacja zwraca siatkę rzędy × tabliczki', () => {
        const grid = simulate(draft).grid
        expect(grid).toHaveLength(draft.rows.length)
        expect(grid.every((row) => row.length === draft.tablets.length)).toBe(true)
      })
    })
  }

  it('pasy: różne grupy tabliczek dają różny rytm pasów', () => {
    const draft = patternById('pasy').build()
    const grid = simulate(draft).grid
    const column = (c: number) => grid.map((row) => row[c]).join(' ')
    expect(new Set([column(0), column(6), column(11)]).size).toBe(3)
  })

  it('diagonale: ujawniony kolor zmienia się między sąsiednimi rzędami', () => {
    const draft = patternById('diagonale').build()
    const grid = simulate(draft).grid
    expect(grid.slice(1).some((row, r) => row[4] !== grid[r][4])).toBe(true)
  })

  it('diagonale: każda kolumna powtarza cykl czterech rzędów', () => {
    const draft = patternById('diagonale').build()
    const grid = simulate(draft).grid
    for (let c = 0; c < draft.tablets.length; c++) {
      for (let r = 0; r + 4 < grid.length; r++) {
        expect(grid[r + 4][c]).toBe(grid[r][c])
      }
    }
  })

  it('diagonale trójkolorowe: akcent różni się między tabliczkami parzystymi i nieparzystymi', () => {
    const draft = patternById('diagonale-3').build()
    expect(draft.tablets[0].holes).not.toEqual(draft.tablets[1].holes)
    expect(new Set(draft.tablets.flatMap((t) => [...t.holes])).size).toBe(3)
  })

  it('jodełka: kierunek obrotów zmienia się dokładnie raz, z F na B', () => {
    const draft = patternById('jodelka').build()
    const dirs = draft.rows.map((r) => r.turns[0])
    const flips = dirs.filter((turn, i) => i > 0 && turn !== dirs[i - 1])
    expect(flips).toEqual(['B'])
    expect(draft.rows[0].turns.every((t) => t === 'F')).toBe(true)
  })

  it('romby: co najmniej trzy zmiany kierunku obrotów', () => {
    const draft = patternById('romby').build()
    const dirs = draft.rows.map((r) => r.turns[0])
    let changes = 0
    for (let i = 1; i < dirs.length; i++) {
      if (dirs[i] !== dirs[i - 1]) changes++
    }
    expect(changes).toBeGreaterThanOrEqual(3)
  })

  it('plastry miodu: sąsiednie kolumny są w przeciwfazie', () => {
    const draft = patternById('plastry-miodu').build()
    const grid = simulate(draft).grid
    for (let c = 0; c + 1 < draft.tablets.length; c++) {
      expect(grid.some((row) => row[c] !== row[c + 1])).toBe(true)
    }
  })
})
