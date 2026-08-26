import { describe, expect, it } from 'vitest'
import { simulateInkle, validateInkleDraft } from './inkle'
import { dominantGround, generateInkleFromMatrix } from './generate-inkle'
import type { InkleGenerateOptions } from './generate-inkle'

const ground = '#faf5ef'
const pattern = '#dc2626'
const teal = '#0f766e'
const border = '#292524'
const weft = '#1c1917'

function baseOptions(overrides: Partial<InkleGenerateOptions> = {}): InkleGenerateOptions {
  return {
    name: 'krajka z foto',
    groundHex: ground,
    borderHex: border,
    weftHex: weft,
    ...overrides,
  }
}

function hexIds(draft: ReturnType<typeof generateInkleFromMatrix>): Map<string, string> {
  return new Map(draft.palette.map((c) => [c.hex, c.id]))
}

const heart = [
  [pattern, ground, pattern],
  [pattern, pattern, pattern],
]

describe('dominantGround', () => {
  it('zwraca najczęstszy hex, remis rozstrzyga kolejnością wystąpienia', () => {
    expect(
      dominantGround([
        ['#111111', '#222222'],
        ['#111111', '#333333'],
      ]),
    ).toBe('#111111')
    expect(
      dominantGround([
        ['#123456', '#654321'],
        ['#654321', '#123456'],
      ]),
    ).toBe('#123456')
  })

  it('zwraca pusty string dla pustej macierzy', () => {
    expect(dominantGround([])).toBe('')
  })
})

describe('generateInkleFromMatrix', () => {
  it('generuje poprawny draft o strukturze osnowy jak inkleDraftFromChart', () => {
    const draft = generateInkleFromMatrix(heart, baseOptions())
    expect(validateInkleDraft(draft)).toEqual([])
    expect(draft.name).toBe('krajka z foto')
    expect(draft.version).toBe(1)
    expect(draft.warp).toHaveLength(2 + 2 * 3 + 2)
    expect(draft.passes).toHaveLength(2 * 2)
    const byHex = hexIds(draft)
    expect(draft.warp[0]).toEqual({ colorId: byHex.get(border), heddled: true, pattern: false })
    expect(draft.warp[1]).toEqual({ colorId: byHex.get(border), heddled: false, pattern: false })
    for (let col = 0; col < 3; col++) {
      expect(draft.warp[2 + 2 * col]).toEqual({
        colorId: byHex.get(ground),
        heddled: true,
        pattern: false,
      })
      expect(draft.warp[2 + 2 * col + 1]).toEqual({
        colorId: byHex.get(pattern),
        heddled: false,
        pattern: true,
      })
    }
    const last = draft.warp.length - 1
    expect(draft.warp[last - 1]).toEqual({
      colorId: byHex.get(border),
      heddled: false,
      pattern: false,
    })
    expect(draft.warp[last]).toEqual({
      colorId: byHex.get(border),
      heddled: true,
      pattern: false,
    })
    expect(draft.warp.filter((t) => t.pattern)).toHaveLength(3)
    expect(draft.weft).toBe(byHex.get(weft))
  })

  it('picks odwzorowują piksele: pass 2r górny, pass 2r+1 dolny bez podniesień', () => {
    const draft = generateInkleFromMatrix(heart, baseOptions())
    expect(draft.passes.map((p) => p.up)).toEqual([true, false, true, false])
    expect(draft.passes.every((p) => p.picks.length === draft.warp.length)).toBe(true)
    for (let r = 0; r < heart.length; r++) {
      for (let c = 0; c < 3; c++) {
        expect(draft.passes[2 * r].picks[2 + 2 * c + 1]).toBe(heart[r][c] !== ground)
      }
      expect(draft.passes[2 * r + 1].picks.every((v) => !v)).toBe(true)
    }
  })

  it('symulacja: podniesiona nitka wzorcowa pokazuje swój kolor, niepodniesiona wątek', () => {
    const draft = generateInkleFromMatrix(heart, baseOptions())
    const byHex = hexIds(draft)
    const { grid } = simulateInkle(draft)
    expect(grid).toHaveLength(heart.length * 2)
    expect(grid[0]).toHaveLength(draft.warp.length)
    expect(grid[0][3]).toBe(byHex.get(pattern))
    expect(grid[0][7]).toBe(byHex.get(pattern))
    expect(grid[0][5]).toBe(byHex.get(weft))
    expect(grid[0][2]).toBe(byHex.get(ground))
    expect(grid[1][3]).toBe(byHex.get(pattern))
    expect(grid[1][2]).toBe(byHex.get(weft))
  })

  it('kolor tła bierze się z opcji, nie z dominaty macierzy, i porównanie jest po normalizacji', () => {
    const draft = generateInkleFromMatrix(
      [
        ['#ff0000', ground],
        ['#ff0000', ground],
      ],
      baseOptions(),
    )
    expect(validateInkleDraft(draft)).toEqual([])
    expect(draft.passes[0].picks[3]).toBe(true)
    expect(draft.passes[0].picks[5]).toBe(false)
    expect(hexIds(draft).get(ground)).toBeDefined()
    const upper = generateInkleFromMatrix([['#FAF5EF', pattern]], baseOptions())
    expect(upper.passes[0].picks[3]).toBe(false)
    expect(upper.passes[0].picks[5]).toBe(true)
  })

  it('patternColorCount 1 spina wszystkie nitki wzorowe z kolorem dominującym', () => {
    const multi = [
      [pattern, ground, teal],
      [pattern, pattern, teal],
    ]
    const draft = generateInkleFromMatrix(multi, baseOptions())
    expect(validateInkleDraft(draft)).toEqual([])
    const byHex = hexIds(draft)
    const patternIds = draft.warp.filter((t) => t.pattern).map((t) => t.colorId)
    expect(new Set(patternIds).size).toBe(1)
    expect(patternIds[0]).toBe(byHex.get(pattern))
    expect(byHex.get(teal)).toBeUndefined()
  })

  it('patternColorCount 2 zachowuje dominujący kolor każdej kolumny', () => {
    const multi = [
      [pattern, ground, teal],
      [pattern, pattern, teal],
    ]
    const draft = generateInkleFromMatrix(multi, baseOptions({ patternColorCount: 2 }))
    const byHex = hexIds(draft)
    expect(draft.warp[3].colorId).toBe(byHex.get(pattern))
    expect(draft.warp[5].colorId).toBe(byHex.get(pattern))
    expect(draft.warp[7].colorId).toBe(byHex.get(teal))
    const { grid } = simulateInkle(draft)
    expect(grid[0][7]).toBe(byHex.get(teal))
  })

  it('macierz bez koloru wzorowego daje poprawny pas bez podniesień', () => {
    const plain = [
      [ground, ground],
      [ground, ground],
    ]
    const draft = generateInkleFromMatrix(plain, baseOptions())
    expect(validateInkleDraft(draft)).toEqual([])
    expect(draft.passes.every((p) => p.picks.every((v) => !v))).toBe(true)
    expect(hexIds(draft).get('#dc2626')).toBeUndefined()
  })

  it('patternColorCount jest ograniczone do 3 kolorów wzorowych', () => {
    const c1 = '#101010'
    const c2 = '#505050'
    const c3 = '#a0a0a0'
    const c4 = '#b0b0b0'
    const matrix = [[c1, c2, c3, c4]]
    const draft = generateInkleFromMatrix(matrix, baseOptions({ patternColorCount: 99 }))
    expect(validateInkleDraft(draft)).toEqual([])
    const byHex = hexIds(draft)
    const patternIds = draft.warp.filter((t) => t.pattern).map((t) => t.colorId)
    expect(new Set(patternIds).size).toBe(3)
    expect(draft.warp[3].colorId).toBe(byHex.get(c1))
    expect(draft.warp[5].colorId).toBe(byHex.get(c2))
    expect(draft.warp[7].colorId).toBe(byHex.get(c3))
    expect(draft.warp[9].colorId).toBe(byHex.get(c3))
    expect(generateInkleFromMatrix(matrix, baseOptions({ patternColorCount: 99 }))).toEqual(
      generateInkleFromMatrix(matrix, baseOptions({ patternColorCount: 3 })),
    )
  })
})
