import { describe, expect, it } from 'vitest'
import type { ColorId } from './types'
import { paletteFromHexes, validateDraft } from './draft'
import { simulate } from './simulator'
import { columnDistinctColors, generateThreadedin, threadedinHoles } from './generate-threadedin'

describe('columnDistinctColors', () => {
  it('picks the most frequent colors capped at four, ordered by first appearance', () => {
    const col: ColorId[] = ['a', 'b', 'a', 'c', 'b', 'a', 'd', 'e', 'a']
    expect(columnDistinctColors(col, 4)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('breaks frequency ties by first appearance', () => {
    expect(columnDistinctColors(['x', 'y', 'x', 'y'], 1)).toEqual(['x'])
    expect(columnDistinctColors(['y', 'x', 'x', 'y'], 1)).toEqual(['y'])
    expect(columnDistinctColors(['x', 'y', 'y', 'x'], 2)).toEqual(['x', 'y'])
  })

  it('returns fewer colors when the column has fewer distinct colors', () => {
    expect(columnDistinctColors(['k', 'k', 'k'], 4)).toEqual(['k'])
    expect(columnDistinctColors(['k', 'w'], 4)).toEqual(['k', 'w'])
  })
})

describe('threadedinHoles', () => {
  it('repeats a single color across all holes', () => {
    expect(threadedinHoles(['k'])).toEqual(['k', 'k', 'k', 'k'])
  })

  it('arranges two colors so pure-F shows them alternately from the top', () => {
    expect(threadedinHoles(['k', 'w'])).toEqual(['w', 'k', 'w', 'k'])
  })

  it('wraps three colors around four holes', () => {
    expect(threadedinHoles(['a', 'b', 'c'])).toEqual(['a', 'c', 'b', 'a'])
  })

  it('reverses four colors top-to-bottom', () => {
    expect(threadedinHoles(['a', 'b', 'c', 'd'])).toEqual(['d', 'c', 'b', 'a'])
  })
})

describe('generateThreadedin', () => {
  const red = '#ff0000'
  const green = '#00ff00'
  const blue = '#0000ff'
  const yellow = '#ffff00'
  const target = [
    [red, blue],
    [green, yellow],
    [red, blue],
    [green, yellow],
    [red, blue],
    [green, yellow],
  ]
  const palette = paletteFromHexes([red, green, blue, yellow])

  it('threads columns so continuous F weaving reproduces the column cycle', () => {
    const draft = generateThreadedin(target, palette, 'gen', { reverseEvery: 6, weft: 'c0' })
    expect(validateDraft(draft)).toEqual([])
    const hexById = new Map(palette.map((c) => [c.id, c.hex]))
    const grid = simulate(draft).grid.map((row) => row.map((id) => hexById.get(id) ?? ''))
    expect(grid).toEqual(target)
  })

  it('alternates F and B blocks of reverseEvery rows', () => {
    const draft = generateThreadedin(target, palette, 'gen', { reverseEvery: 2, weft: 'c1' })
    expect(draft.rows.map((r) => r.turns[0])).toEqual(['F', 'F', 'B', 'B', 'F', 'F'])
    expect(draft.rows.map((r) => r.weft)).toEqual(['c1', 'c1', 'c1', 'c1', 'c1', 'c1'])
    expect(draft.rows[0].turns).toEqual(['F', 'F'])
  })

  it('creates one tablet per column with a shared weft', () => {
    const draft = generateThreadedin(target, palette, 'gen', { reverseEvery: 3, weft: 'c0' })
    expect(draft.tablets).toHaveLength(2)
    expect(draft.rows).toHaveLength(6)
    expect(draft.name).toBe('gen')
    expect(draft.version).toBe(1)
  })

  it('limits distinct colors per column to four', () => {
    const many = [
      ['#100000', '#000000'],
      ['#200000', '#000000'],
      ['#300000', '#000000'],
      ['#400000', '#000000'],
      ['#500000', '#000000'],
    ]
    const pal = paletteFromHexes([
      '#100000',
      '#200000',
      '#300000',
      '#400000',
      '#500000',
      '#000000',
    ])
    const draft = generateThreadedin(many, pal, 'many', { reverseEvery: 5, weft: 'c0' })
    expect(draft.tablets[0].holes.every((h) => h !== 'c4')).toBe(true)
    expect(new Set(draft.tablets[1].holes)).toEqual(new Set(['c5']))
  })

  it('maps unknown hexes to the first palette color', () => {
    const draft = generateThreadedin([['#123456']], palette, 'x', { reverseEvery: 1, weft: 'c0' })
    expect(draft.tablets[0].holes).toEqual(['c0', 'c0', 'c0', 'c0'])
  })
})
