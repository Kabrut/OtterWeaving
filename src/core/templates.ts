import type { ColorId, Draft } from './types'
import { HOLES } from './types'
import { makeRow, makeTablet } from './draft'

function egyptianTablet(index: number, dark: ColorId, light: ColorId) {
  const holes: ColorId[] = []
  for (let h = 0; h < HOLES; h++) {
    holes.push(h === index % HOLES || h === (index + 1) % HOLES ? dark : light)
  }
  return makeTablet(holes)
}

export function templateStripes(
  name: string,
  tablets: number,
  rows: number,
  a: ColorId,
  b: ColorId,
): Draft {
  const holes = [b, a, b, a]
  return {
    version: 1,
    name,
    tablets: Array.from({ length: tablets }, () => makeTablet(holes)),
    rows: Array.from({ length: rows }, () => makeRow(Array(tablets).fill('F'), a)),
    palette: [],
  }
}

export function templateDiagonals(
  name: string,
  tablets: number,
  rows: number,
  dark: ColorId,
  light: ColorId,
): Draft {
  return {
    version: 1,
    name,
    tablets: Array.from({ length: tablets }, (_, i) => egyptianTablet(i, dark, light)),
    rows: Array.from({ length: rows }, () => makeRow(Array(tablets).fill('F'), dark)),
    palette: [],
  }
}

export function templateChevron(
  name: string,
  tablets: number,
  rows: number,
  dark: ColorId,
  light: ColorId,
): Draft {
  const forwardRows = Math.ceil(rows / 2)
  return {
    version: 1,
    name,
    tablets: Array.from({ length: tablets }, (_, i) => egyptianTablet(i, dark, light)),
    rows: Array.from({ length: rows }, (_, r) =>
      makeRow(Array(tablets).fill(r < forwardRows ? 'F' : 'B'), dark),
    ),
    palette: [],
  }
}
