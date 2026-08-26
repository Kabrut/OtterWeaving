import type { ColorId, Draft, Tablet, Turn } from './types'
import { HOLES } from './types'
import { makeRow, makeTablet, paletteFromHexes } from './draft'

export interface TabletPattern {
  id: string
  name: string
  description: string
  build: () => Draft
}

function egyptianTablet(index: number, dark: ColorId, light: ColorId): Tablet {
  const holes: ColorId[] = []
  for (let h = 0; h < HOLES; h++) {
    holes.push(h === index % HOLES || h === (index + 1) % HOLES ? dark : light)
  }
  return makeTablet(holes)
}

function uniformRows(count: number, tablets: number, turn: Turn, weft: ColorId): Draft['rows'] {
  return Array.from({ length: count }, () => makeRow(Array(tablets).fill(turn), weft))
}

function blockRows(
  count: number,
  tablets: number,
  blockSize: number,
  weft: ColorId,
): Draft['rows'] {
  return Array.from({ length: count }, (_, r) =>
    makeRow(Array(tablets).fill(Math.floor(r / blockSize) % 2 === 0 ? 'F' : 'B'), weft),
  )
}

function buildPasy(): Draft {
  const palette = paletteFromHexes(['#43302b', '#ead9bd'])
  const dark = palette[0].id
  const light = palette[1].id
  const count = 17
  const tablets: Tablet[] = [
    ...Array.from({ length: 5 }, () => makeTablet([dark, dark, light, light])),
    makeTablet([light]),
    ...Array.from({ length: 4 }, () => makeTablet([dark, dark, dark, light])),
    makeTablet([dark]),
    ...Array.from({ length: 5 }, () => makeTablet([dark, light, dark, light])),
    makeTablet([dark]),
  ]
  return {
    version: 1,
    name: 'Pasy ozdobne',
    tablets,
    rows: uniformRows(40, count, 'F', dark),
    palette,
  }
}

function buildDiagonale(): Draft {
  const palette = paletteFromHexes(['#1f3a5f', '#f2ead8'])
  const dark = palette[0].id
  const light = palette[1].id
  const count = 16
  return {
    version: 1,
    name: 'Diagonale egipskie',
    tablets: Array.from({ length: count }, (_, i) => egyptianTablet(i, dark, light)),
    rows: uniformRows(40, count, 'F', dark),
    palette,
  }
}

function buildDiagonale3(): Draft {
  const palette = paletteFromHexes(['#312e5e', '#f2ead8', '#c98a2d'])
  const dark = palette[0].id
  const first = palette[1].id
  const second = palette[2].id
  const count = 16
  return {
    version: 1,
    name: 'Diagonale trójkolorowe',
    tablets: Array.from({ length: count }, (_, i) =>
      egyptianTablet(i, dark, i % 2 === 0 ? first : second),
    ),
    rows: uniformRows(40, count, 'F', dark),
    palette,
  }
}

function buildJodelka(): Draft {
  const palette = paletteFromHexes(['#7a2e2e', '#f0e3c8'])
  const dark = palette[0].id
  const light = palette[1].id
  const count = 16
  const rows = 32
  return {
    version: 1,
    name: 'Jodełka',
    tablets: Array.from({ length: count }, (_, i) => egyptianTablet(i, dark, light)),
    rows: blockRows(rows, count, rows / 2, dark),
    palette,
  }
}

function buildRomby(): Draft {
  const palette = paletteFromHexes(['#1f4e4a', '#efe0c3'])
  const dark = palette[0].id
  const light = palette[1].id
  const count = 16
  const rows = 40
  return {
    version: 1,
    name: 'Romby',
    tablets: Array.from({ length: count }, (_, i) => egyptianTablet(i, dark, light)),
    rows: blockRows(rows, count, rows / 4, dark),
    palette,
  }
}

function buildPlastryMiodu(): Draft {
  const palette = paletteFromHexes(['#8a5a24', '#f3d9a4'])
  const dark = palette[0].id
  const light = palette[1].id
  const count = 16
  const tablets = Array.from({ length: count }, (_, i) =>
    makeTablet(
      i % 2 === 0 ? [dark, light, dark, light] : [light, dark, light, dark],
      i % 2 === 0 ? 'S' : 'Z',
    ),
  )
  return {
    version: 1,
    name: 'Plastry miodu',
    tablets,
    rows: uniformRows(32, count, 'F', dark),
    palette,
  }
}

export const TABLET_PATTERNS: TabletPattern[] = [
  {
    id: 'pasy',
    name: 'Pasy ozdobne',
    description:
      'Poziome pasy o zróżnicowanym rytmie — szerokie smugi, rytm 3:1 i drobne prążki, przedzielone jednokolorowymi tabliczkami.',
    build: buildPasy,
  },
  {
    id: 'diagonale',
    name: 'Diagonale egipskie',
    description:
      'Ukośne linie z klasycznego nawleczenia egipskiego, przesuniętego o jeden otwór co tabliczkę.',
    build: buildDiagonale,
  },
  {
    id: 'diagonale-3',
    name: 'Diagonale trójkolorowe',
    description: 'Ukośny pas w trzech kolorach — jasny akcent zamienia się co tabliczkę.',
    build: buildDiagonale3,
  },
  {
    id: 'jodelka',
    name: 'Jodełka',
    description: 'Zygzak w kształcie jodełki dzięki odwróceniu kierunku obrotów w połowie wzoru.',
    build: buildJodelka,
  },
  {
    id: 'romby',
    name: 'Romby',
    description:
      'Romby i zygzaki z nawleczenia egipskiego oraz czterech naprzemiennych bloków obrotów F i B.',
    build: buildRomby,
  },
  {
    id: 'plastry-miodu',
    name: 'Plastry miodu',
    description:
      'Miodowa kratka z tabliczek nawleczonych w przeciwfazie, ze skrętem S i Z na zmianę.',
    build: buildPlastryMiodu,
  },
]
