import { describe, expect, it } from 'vitest'
import type { InkleDraft, InkleWarpThread } from './inkle'
import {
  cloneInkleDraft,
  computeInkleMetrics,
  plainPasses,
  simulateInkle,
  validateInkleDraft,
} from './inkle'
import { INKLE_PATTERNS, inkleDraftFromChart } from './inkle-patterns'

function makeDraft(): InkleDraft {
  return {
    version: 1,
    name: 'krajka testowa',
    warp: [
      { colorId: 'a', heddled: true, pattern: false },
      { colorId: 'b', heddled: false, pattern: true },
      { colorId: 'a', heddled: false, pattern: false },
      { colorId: 'b', heddled: true, pattern: false },
    ],
    weft: 'c',
    passes: plainPasses(4, 4),
    palette: [
      { id: 'a', hex: '#111111', name: 'ciemny' },
      { id: 'b', hex: '#eeeeee', name: 'jasny' },
      { id: 'c', hex: '#b91c1c', name: 'wątek' },
    ],
  }
}

describe('validateInkleDraft', () => {
  it('poprawny draft nie ma błędów', () => {
    expect(validateInkleDraft(makeDraft())).toEqual([])
  })

  it('zła wersja', () => {
    const bad = { ...makeDraft(), version: 2 } as unknown as InkleDraft
    expect(validateInkleDraft(bad)).toEqual(['draft.version'])
  })

  it('pusta osnowa lub brak prześwitów', () => {
    const emptyWarp = makeDraft()
    emptyWarp.warp = []
    expect(validateInkleDraft(emptyWarp)).toEqual(['draft.warp'])
    const noPasses = makeDraft()
    noPasses.passes = []
    expect(validateInkleDraft(noPasses)).toEqual(['draft.passes'])
  })

  it('zły format hex w palecie', () => {
    const badHex = makeDraft()
    badHex.palette = [{ id: 'a', hex: '#zz1111', name: 'x' }]
    expect(validateInkleDraft(badHex).length).toBeGreaterThan(0)
    const noHash = makeDraft()
    noHash.palette = noHash.palette.map((c) => ({ ...c, hex: '111111' }))
    expect(validateInkleDraft(noHash).length).toBeGreaterThan(0)
  })

  it('zła długość picks względem osnowy', () => {
    const badPicks = makeDraft()
    badPicks.passes = badPicks.passes.map((p, i) => (i === 1 ? { ...p, picks: [false] } : p))
    expect(validateInkleDraft(badPicks).length).toBeGreaterThan(0)
  })

  it('nieznany colorId wątku lub osnowy', () => {
    const badWeft = { ...makeDraft(), weft: 'x' }
    expect(validateInkleDraft(badWeft).length).toBeGreaterThan(0)
    const badWarp = makeDraft()
    badWarp.warp = badWarp.warp.map((t, i) => (i === 0 ? { ...t, colorId: 'x' } : t))
    expect(validateInkleDraft(badWarp).length).toBeGreaterThan(0)
  })

  it('zduplikowane id w palecie', () => {
    const dup = makeDraft()
    dup.palette = [...dup.palette, { id: 'a', hex: '#222222', name: 'duplikat' }]
    expect(validateInkleDraft(dup)).toContain('palette.duplicateIds')
  })
})

describe('plainPasses', () => {
  it('naprzemienne prześwity, pierwszy górny, picks puste', () => {
    const ps = plainPasses(5, 3)
    expect(ps.map((p) => p.up)).toEqual([true, false, true, false, true])
    expect(ps[0].picks).toEqual([false, false, false])
    expect(ps.every((p) => p.picks.every((v) => !v))).toBe(true)
  })
})

describe('simulateInkle', () => {
  it('tkanina gładka: górny prześwit pokazuje nitki w oczkach, dolny nitki wolne', () => {
    const draft = makeDraft()
    draft.passes = plainPasses(2, 4)
    const { grid } = simulateInkle(draft)
    expect(grid[0]).toEqual(['a', 'c', 'c', 'b'])
    expect(grid[1]).toEqual(['c', 'b', 'a', 'c'])
  })

  it('podniesiona nitka wzorcowa pokazuje swój kolor na górnym prześwicie', () => {
    const draft = makeDraft()
    draft.passes = [{ up: true, picks: [false, true, false, false] }]
    const { grid } = simulateInkle(draft)
    expect(grid[0][1]).toBe('b')
    expect(grid[0][2]).toBe('c')
  })

  it('pick nadpisuje również naturalny prześwit dolny', () => {
    const draft = makeDraft()
    draft.passes = [{ up: false, picks: [true, false, false, false] }]
    const { grid } = simulateInkle(draft)
    expect(grid[0][0]).toBe('a')
  })
})

describe('cloneInkleDraft', () => {
  it('zwraca niezależną kopię głęboką', () => {
    const draft = makeDraft()
    const copy = cloneInkleDraft(draft)
    expect(copy).toEqual(draft)
    expect(copy).not.toBe(draft)
    copy.warp[0].colorId = 'c'
    copy.passes[0].picks[0] = true
    expect(draft.warp[0].colorId).toBe('a')
    expect(draft.passes[0].picks[0]).toBe(false)
  })
})

describe('biblioteka wzorów i inkleDraftFromChart', () => {
  it('wykresy mają równe długości i są lustrzanie symetryczne', () => {
    for (const p of INKLE_PATTERNS) {
      const width = p.chart[0].length
      expect(width % 2).toBe(1)
      for (const row of p.chart) {
        expect(row.length).toBe(width)
        expect(row).toBe([...row].reverse().join(''))
      }
    }
  })

  it('generuje poprawny draft o właściwej strukturze osnowy i prześwitów', () => {
    for (const p of INKLE_PATTERNS) {
      const draft = inkleDraftFromChart(p)
      expect(validateInkleDraft(draft)).toEqual([])
      expect(draft.name).toBe(p.name)
      const width = p.chart[0].length
      expect(draft.warp).toHaveLength(2 + 2 * width + 2)
      expect(draft.passes).toHaveLength(2 * p.chart.length * 3)
      const idByHex = new Map(draft.palette.map((c) => [c.hex, c.id]))
      expect(draft.warp[0]).toEqual({
        colorId: idByHex.get(p.colors.border),
        heddled: true,
        pattern: false,
      })
      expect(draft.warp[1]).toEqual({
        colorId: idByHex.get(p.colors.border),
        heddled: false,
        pattern: false,
      })
      expect(draft.warp[2]).toEqual({
        colorId: idByHex.get(p.colors.ground),
        heddled: true,
        pattern: false,
      })
      expect(draft.warp[3]).toEqual({
        colorId: idByHex.get(p.colors.pattern),
        heddled: false,
        pattern: true,
      })
      const last = draft.warp.length - 1
      expect(draft.warp[last - 1]).toEqual({
        colorId: idByHex.get(p.colors.border),
        heddled: false,
        pattern: false,
      })
      expect(draft.warp[last]).toEqual({
        colorId: idByHex.get(p.colors.border),
        heddled: true,
        pattern: false,
      })
      expect(draft.warp.filter((t) => t.pattern)).toHaveLength(width)
      expect(draft.passes[0].up).toBe(true)
      expect(draft.passes[1].up).toBe(false)
      expect(draft.passes[1].picks.every((v) => !v)).toBe(true)
      expect(draft.passes.every((pass) => pass.picks.length === draft.warp.length)).toBe(true)
    }
  })

  it('picks odwzorowują wiersz wykresu na slocy nitek wzorcowych', () => {
    const p = INKLE_PATTERNS[0]
    const draft = inkleDraftFromChart(p)
    const row = p.chart[0]
    for (let col = 0; col < row.length; col++) {
      expect(draft.passes[0].picks[2 + 2 * col + 1]).toBe(row[col] === '#')
    }
    expect(draft.passes[0].picks[0]).toBe(false)
    expect(draft.passes[0].picks[2]).toBe(false)
  })

  it('parametr repeats powtarza cały wykres', () => {
    const p = INKLE_PATTERNS[0]
    expect(inkleDraftFromChart(p, 2).passes).toHaveLength(2 * p.chart.length * 2)
    expect(inkleDraftFromChart(p, 1).passes).toHaveLength(2 * p.chart.length)
  })

  it('punkt "#" z wykresu daje kolor wzorowy w siatce, kropka daje wątek', () => {
    for (const p of INKLE_PATTERNS) {
      const draft = inkleDraftFromChart(p)
      const idByHex = new Map(draft.palette.map((c) => [c.hex, c.id]))
      const patternId = idByHex.get(p.colors.pattern)
      const weftId = idByHex.get(p.colors.weft)
      expect(patternId).toBeDefined()
      const rowIdx = p.chart.findIndex((row) => row.includes('#'))
      const colIdx = p.chart[rowIdx].indexOf('#')
      const dotCol = p.chart[rowIdx].indexOf('.')
      const { grid } = simulateInkle(draft)
      expect(grid).toHaveLength(draft.passes.length)
      expect(grid[0]).toHaveLength(draft.warp.length)
      expect(grid[2 * rowIdx][2 + 2 * colIdx + 1]).toBe(patternId)
      expect(grid[2 * rowIdx][2 + 2 * dotCol + 1]).toBe(weftId)
    }
  })
})

describe('computeInkleMetrics', () => {
  it('liczy szerokość pasa, długość tkaniny i osnowy', () => {
    const palette = [
      { id: 'a', hex: '#111111', name: 'ciemny' },
      { id: 'b', hex: '#eeeeee', name: 'jasny' },
      { id: 'c', hex: '#b91c1c', name: 'wątek' },
    ]
    const warp: InkleWarpThread[] = []
    for (let i = 0; i < 10; i++) {
      warp.push({ colorId: i < 6 ? 'a' : 'b', heddled: i % 2 === 0, pattern: false })
    }
    const draft: InkleDraft = {
      version: 1,
      name: 'metryki',
      warp,
      weft: 'c',
      passes: plainPasses(8, 10),
      palette,
    }
    const m = computeInkleMetrics(draft)
    expect(m.warpCount).toBe(10)
    expect(m.passes).toBe(8)
    expect(m.bandWidthCm).toBe(3)
    expect(m.wovenLengthCm).toBe(2)
    expect(m.warpLengthCm).toBe(62.7)
    expect(m.threads).toEqual([
      { colorId: 'a', hex: '#111111', name: 'ciemny', count: 6 },
      { colorId: 'b', hex: '#eeeeee', name: 'jasny', count: 4 },
    ])
  })

  it('wątek nie jest doliczany do nitek osnowy', () => {
    const p = INKLE_PATTERNS.find((x) => x.id === 'gwiazda-baltycka')
    expect(p).toBeDefined()
    if (!p) return
    const draft = inkleDraftFromChart(p, 1)
    const m = computeInkleMetrics(draft)
    expect(m.warpCount).toBe(22)
    expect(m.passes).toBe(16)
    expect(m.bandWidthCm).toBe(6.6)
    expect(m.wovenLengthCm).toBe(4)
    expect(m.warpLengthCm).toBe(65.4)
    expect(m.threads.find((t) => t.hex === p.colors.border)?.count).toBe(4)
    expect(m.threads.find((t) => t.hex === p.colors.ground)?.count).toBe(9)
    expect(m.threads.find((t) => t.hex === p.colors.pattern)?.count).toBe(9)
  })
})
