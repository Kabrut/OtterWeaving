import { describe, expect, it } from 'vitest'
import {
  matrixMismatch,
  medianCutPalette,
  quantizeMatrix,
  rgbaToHexMatrix,
  suggestedRows,
} from './image'

function px(r: number, g: number, b: number, a = 255): number[] {
  return [r, g, b, a]
}

describe('rgbaToHexMatrix', () => {
  it('passes opaque pixels through', () => {
    const m = rgbaToHexMatrix([...px(255, 0, 0), ...px(0, 255, 0)], 2, 1)
    expect(m).toEqual([['#ff0000', '#00ff00']])
  })

  it('composites full transparency onto white', () => {
    const m = rgbaToHexMatrix(px(255, 0, 0, 0), 1, 1)
    expect(m).toEqual([['#ffffff']])
  })

  it('blends semi-transparent pixels onto white', () => {
    const m = rgbaToHexMatrix([...px(0, 0, 0, 128), ...px(255, 255, 255, 128)], 2, 1)
    expect(m).toEqual([['#7f7f7f', '#ffffff']])
  })

  it('lays pixels out row-major', () => {
    const data = [...px(255, 0, 0), ...px(0, 255, 0), ...px(0, 0, 255), ...px(0, 0, 0)]
    const m = rgbaToHexMatrix(data, 2, 2)
    expect(m).toEqual([
      ['#ff0000', '#00ff00'],
      ['#0000ff', '#000000'],
    ])
  })
})

describe('medianCutPalette', () => {
  it('returns the single color for uniform input', () => {
    expect(medianCutPalette(['#123456', '#123456', '#123456'], 4)).toEqual(['#123456'])
  })

  it('keeps box averages of a two-color split', () => {
    expect(medianCutPalette(['#000000', '#ffffff', '#000000', '#ffffff'], 2)).toEqual([
      '#000000',
      '#ffffff',
    ])
  })

  it('never exceeds maxColors', () => {
    const hexes = ['#000000', '#333333', '#666666', '#999999', '#cccccc']
    expect(medianCutPalette(hexes, 3)).toHaveLength(3)
  })

  it('never exceeds the number of distinct input colors', () => {
    const hexes = ['#000000', '#333333', '#666666', '#999999', '#cccccc']
    expect(medianCutPalette(hexes, 10)).toHaveLength(5)
    expect(medianCutPalette(['#ff0000', '#ff0000'], 8)).toEqual(['#ff0000'])
  })

  it('produces palette entries that are valid hex colors', () => {
    const hexes = ['#100000', '#002000', '#000030', '#404040', '#f0f0f0']
    for (const hex of medianCutPalette(hexes, 3)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('quantizeMatrix', () => {
  it('snaps every cell to a palette entry', () => {
    const matrix = [
      ['#000000', '#010101'],
      ['#ffffff', '#f0f0f0'],
    ]
    const { paletteHex, matrix: snapped } = quantizeMatrix(matrix, 2)
    expect(paletteHex).toHaveLength(2)
    expect(new Set(snapped.flat()).size).toBe(2)
    for (const hex of snapped.flat()) {
      expect(paletteHex).toContain(hex)
    }
    expect(snapped[0][0]).toBe(snapped[0][1])
    expect(snapped[1][0]).toBe(snapped[1][1])
    expect(snapped[0][0]).not.toBe(snapped[1][0])
  })

  it('keeps a matrix that already fits the palette unchanged', () => {
    const matrix = [['#000000', '#ffffff']]
    const { paletteHex, matrix: snapped } = quantizeMatrix(matrix, 4)
    expect(snapped).toEqual(matrix)
    expect(paletteHex).toEqual(['#000000', '#ffffff'])
  })
})

describe('matrixMismatch', () => {
  it('returns the fraction of differing cells', () => {
    const a = [
      ['#000000', '#000000'],
      ['#000000', '#000000'],
    ]
    const b = [
      ['#000000', '#ffffff'],
      ['#000000', '#000000'],
    ]
    expect(matrixMismatch(a, b)).toBe(0.25)
    expect(matrixMismatch(a, a)).toBe(0)
  })

  it('returns 1 when dimensions differ', () => {
    expect(matrixMismatch([['#000000']], [['#000000'], ['#000000']])).toBe(1)
    expect(matrixMismatch([['#000000', '#000000']], [['#000000']])).toBe(1)
  })
})

describe('suggestedRows', () => {
  it('scales the height/width ratio by tablet count', () => {
    expect(suggestedRows(10, 20, 12)).toBe(24)
  })

  it('clamps to the 8..240 range', () => {
    expect(suggestedRows(1000, 1, 100)).toBe(8)
    expect(suggestedRows(1, 1000, 100)).toBe(240)
  })

  it('falls back to 32 for non-positive dimensions', () => {
    expect(suggestedRows(0, 10, 10)).toBe(32)
    expect(suggestedRows(10, 0, 10)).toBe(32)
  })
})
