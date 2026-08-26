import { describe, expect, it } from 'vitest'
import type { ColorId, Draft, ThreadColor, Turn } from './types'
import {
  cloneDraft,
  colorHexMap,
  createEmptyDraft,
  makeColor,
  makeRow,
  makeTablet,
  paletteFromHexes,
  projectFromJson,
  projectToJson,
  validateDraft,
} from './draft'

const palette: ThreadColor[] = [
  { id: 'w', hex: '#ffffff', name: 'white' },
  { id: 'k', hex: '#000000', name: 'black' },
]

export function buildDraft(
  tablets: { holes: ColorId[]; twist?: 'S' | 'Z' }[],
  turns: Turn[][],
): Draft {
  return {
    version: 1,
    name: 'test',
    tablets: tablets.map((t) => makeTablet(t.holes, t.twist ?? 'Z')),
    rows: turns.map((row) => makeRow(row, 'w')),
    palette,
  }
}

const F = 'F' as Turn
const B = 'B' as Turn

describe('draft', () => {
  it('validates a correct draft', () => {
    const draft = buildDraft([{ holes: ['w', 'k', 'w', 'k'] }], [[F], [B]])
    expect(validateDraft(draft)).toEqual([])
  })

  it('detects unknown color in holes', () => {
    const draft = buildDraft([{ holes: ['w', 'k', 'x', 'w'] }], [[F]])
    expect(validateDraft(draft)).toContain('tablets.0.holes.2.unknownColor')
  })

  it('detects wrong turn array length', () => {
    const draft = buildDraft([{ holes: ['w'] }, { holes: ['k'] }], [[F]])
    expect(validateDraft(draft)).toContain('rows.0.turns')
  })

  it('detects invalid turn value', () => {
    const draft: Draft = buildDraft([{ holes: ['w'] }], [[F]])
    ;(draft.rows[0].turns as string[])[0] = 'X'
    expect(validateDraft(draft).some((e) => e.startsWith('rows.0.turns.0'))).toBe(true)
  })

  it('round-trips through project json', () => {
    const draft = buildDraft(
      [
        { holes: ['w', 'k', 'k', 'w'], twist: 'S' },
        { holes: ['k', 'k', 'w', 'w'] },
      ],
      [
        [F, F],
        [F, B],
        [B, B],
      ],
    )
    const json = projectToJson(draft, null)
    const loaded = projectFromJson(json)
    expect(loaded.draft).toEqual(draft)
    expect(loaded.generator).toBeNull()
  })

  it('rejects foreign json', () => {
    expect(() => projectFromJson('{"hello":1}')).toThrow()
    expect(() => projectFromJson('not json')).toThrow()
  })

  it('rejects unsupported version', () => {
    const draft = buildDraft([{ holes: ['w'] }], [[F]])
    const file = JSON.parse(projectToJson(draft, null))
    file.version = 99
    expect(() => projectFromJson(JSON.stringify(file))).toThrow(/version/)
  })
})

describe('draft helpers', () => {
  it('makeColor normalizes the hex', () => {
    expect(makeColor('r', 'FF0000', 'red')).toEqual({ id: 'r', hex: '#ff0000', name: 'red' })
    expect(makeColor('b', '#0000ff')).toEqual({ id: 'b', hex: '#0000ff', name: '' })
  })

  it('paletteFromHexes dedupes and assigns sequential ids in order of appearance', () => {
    expect(paletteFromHexes(['#ff0000', '#00ff00', '#ff0000', '#0000ff', '#00ff00'])).toEqual([
      { id: 'c0', hex: '#ff0000', name: '' },
      { id: 'c1', hex: '#00ff00', name: '' },
      { id: 'c2', hex: '#0000ff', name: '' },
    ])
  })

  it('paletteFromHexes supports a custom prefix', () => {
    expect(paletteFromHexes(['#123456'], 't')).toEqual([{ id: 't0', hex: '#123456', name: '' }])
  })

  it('makeTablet pads short holes by repeating the last color', () => {
    expect(makeTablet(['k']).holes).toEqual(['k', 'k', 'k', 'k'])
    expect(makeTablet(['k', 'w']).holes).toEqual(['k', 'w', 'w', 'w'])
    expect(makeTablet(['k', 'w', 'k']).holes).toEqual(['k', 'w', 'k', 'k'])
    expect(makeTablet(['k', 'w', 'k', 'w']).holes).toEqual(['k', 'w', 'k', 'w'])
  })

  it('makeTablet defaults to Z twist', () => {
    expect(makeTablet(['k']).twist).toBe('Z')
    expect(makeTablet(['k'], 'S').twist).toBe('S')
  })

  it('makeRow copies the turns array', () => {
    const turns: Turn[] = [F]
    const row = makeRow(turns, 'w')
    turns[0] = B
    expect(row.turns).toEqual([F])
    expect(row.weft).toBe('w')
  })

  it('createEmptyDraft builds a uniform valid draft', () => {
    const color = makeColor('w', '#ffffff', 'white')
    const draft = createEmptyDraft('empty', 3, 2, color)
    expect(draft.name).toBe('empty')
    expect(draft.tablets).toHaveLength(3)
    expect(draft.rows).toHaveLength(2)
    expect(draft.tablets[0].holes).toEqual(['w', 'w', 'w', 'w'])
    expect(draft.rows[0].turns).toEqual(['F', 'F', 'F'])
    expect(draft.rows[0].weft).toBe('w')
    expect(validateDraft(draft)).toEqual([])
  })

  it('cloneDraft deep-copies the draft', () => {
    const draft = buildDraft([{ holes: ['w', 'k'] }], [[F, F]])
    const copy = cloneDraft(draft)
    expect(copy).toEqual(draft)
    expect(copy).not.toBe(draft)
    copy.tablets[0].holes[0] = 'k'
    copy.rows[0].turns[0] = B
    expect(draft.tablets[0].holes[0]).toBe('w')
    expect(draft.rows[0].turns[0]).toBe(F)
  })

  it('colorHexMap maps palette ids to hexes', () => {
    const draft = buildDraft([{ holes: ['w'] }], [[F]])
    expect(colorHexMap(draft)).toEqual(
      new Map([
        ['w', '#ffffff'],
        ['k', '#000000'],
      ]),
    )
  })
})
