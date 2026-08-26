import type { Draft } from './types'
import { HOLES, HOLE_LETTERS } from './types'
import { colorHexMap } from './draft'
import { simulate } from './simulator'

const INK = '#1c1917'
const F_BG = '#ffffff'
const B_BG = '#d6d3d1'
const ACCENT = '#0f766e'

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function turnArrowPaths(cx: number, cy: number, r: number, turn: 'F' | 'B'): string {
  const head = r * 0.5
  if (turn === 'F') {
    const startX = cx + r * Math.cos(0.75 * Math.PI)
    const startY = cy + r * Math.sin(0.75 * Math.PI)
    const endX = cx + r * Math.cos(0.25 * Math.PI)
    const endY = cy + r * Math.sin(0.25 * Math.PI)
    const tx = -Math.sin(0.25 * Math.PI)
    const ty = Math.cos(0.25 * Math.PI)
    const tipX = endX + tx * head
    const tipY = endY + ty * head
    const nx = tx
    const ny = ty
    return [
      `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${r} ${r} 0 1 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`,
      `M ${tipX.toFixed(2)} ${tipY.toFixed(2)} L ${(endX - ny * head * 0.7).toFixed(2)} ${(endY + nx * head * 0.7).toFixed(2)} L ${(endX + ny * head * 0.7).toFixed(2)} ${(endY - nx * head * 0.7).toFixed(2)} Z`,
    ].join(' ')
  }
  const startX = cx + r * Math.cos(0.25 * Math.PI)
  const startY = cy + r * Math.sin(0.25 * Math.PI)
  const endX = cx + r * Math.cos(0.75 * Math.PI)
  const endY = cy + r * Math.sin(0.75 * Math.PI)
  const tx = Math.sin(0.75 * Math.PI)
  const ty = -Math.cos(0.75 * Math.PI)
  const tipX = endX + tx * head
  const tipY = endY + ty * head
  const nx = tx
  const ny = ty
  return [
    `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${r} ${r} 0 1 0 ${endX.toFixed(2)} ${endY.toFixed(2)}`,
    `M ${tipX.toFixed(2)} ${tipY.toFixed(2)} L ${(endX - ny * head * 0.7).toFixed(2)} ${(endY + nx * head * 0.7).toFixed(2)} L ${(endX + ny * head * 0.7).toFixed(2)} ${(endY - nx * head * 0.7).toFixed(2)} Z`,
  ].join(' ')
}

export function fabricSvg(draft: Draft, cellW: number, cellH: number): string {
  const { grid } = simulate(draft)
  const hexById = colorHexMap(draft)
  const w = draft.tablets.length * cellW
  const h = draft.rows.length * cellH
  let rects = ''
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const hex = hexById.get(grid[y][x]) ?? '#000000'
      rects += `<rect x="${x * cellW}" y="${y * cellH}" width="${cellW}" height="${cellH}" fill="${hex}"/>`
    }
  }
  rects += `<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="${INK}" stroke-width="1"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rects}</svg>`
}

export interface TurningSvgOptions {
  cell?: number
  gutter?: number
  header?: number
  showRowNumbers?: boolean
  fontSize?: number
}

export function turningSvg(draft: Draft, options: TurningSvgOptions = {}): string {
  const cell = options.cell ?? 20
  const gutter = options.gutter ?? Math.max(24, cell * 1.4)
  const header = options.header ?? Math.max(16, cell)
  const showRowNumbers = options.showRowNumbers ?? true
  const fontSize = options.fontSize ?? Math.max(8, cell * 0.5)
  const tablets = draft.tablets.length
  const rows = draft.rows.length
  const w = gutter + tablets * cell
  const h = header + rows * cell
  let body = ''
  for (let x = 0; x < tablets; x++) {
    body += `<text x="${gutter + x * cell + cell / 2}" y="${header - 4}" font-size="${fontSize}" text-anchor="middle" fill="${INK}" font-family="sans-serif">${x + 1}</text>`
  }
  for (let y = 0; y < rows; y++) {
    const rowTop = header + y * cell
    if (showRowNumbers) {
      const isStart = y === 0
      body += `<text x="${gutter - 6}" y="${rowTop + cell / 2 + fontSize * 0.35}" font-size="${fontSize}" text-anchor="end" fill="${isStart ? ACCENT : INK}" font-family="sans-serif"${isStart ? ' font-weight="bold"' : ''}>${y + 1}</text>`
    }
    for (let x = 0; x < tablets; x++) {
      const turn = draft.rows[y].turns[x]
      const cx = gutter + x * cell + cell / 2
      const cy = rowTop + cell / 2
      const prevTurn = y > 0 ? draft.rows[y - 1].turns[x] : turn
      const reversal = y > 0 && prevTurn !== turn
      body += `<rect x="${gutter + x * cell + 0.5}" y="${rowTop + 0.5}" width="${cell - 1}" height="${cell - 1}" fill="${turn === 'F' ? F_BG : B_BG}" stroke="#a8a29e" stroke-width="0.5"/>`
      body += `<path d="${turnArrowPaths(cx, cy, cell * 0.3, turn)}" fill="${turn === 'F' ? INK : '#ffffff'}" stroke="${turn === 'F' ? INK : '#ffffff'}" stroke-width="1.2"/>`
      if (reversal) {
        body += `<rect x="${gutter + x * cell}" y="${rowTop + cell - 1.5}" width="${cell}" height="2" fill="#dc2626"/>`
      }
    }
    body += `<rect x="${gutter - 1.5}" y="${rowTop}" width="1.5" height="${cell}" fill="${INK}" opacity="0.08"/>`
  }
  body += `<path d="M ${gutter - 2} ${header + cell / 2} l -7 -5 l 0 10 Z" fill="${ACCENT}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fafaf9"/>${body}</svg>`
}

export interface ThreadingSvgOptions {
  cell?: number
  gap?: number
}

export function threadingSvg(draft: Draft, options: ThreadingSvgOptions = {}): string {
  const cell = options.cell ?? 20
  const gap = options.gap ?? Math.max(24, cell * 1.2)
  const fontSize = Math.max(8, cell * 0.5)
  const hexById = colorHexMap(draft)
  const tablets = draft.tablets.length
  const gutter = Math.max(28, cell * 1.6)
  const w = gutter + tablets * cell
  const h = gap + HOLES * cell + cell * 1.6
  let body = ''
  for (let hIdx = 0; hIdx < HOLES; hIdx++) {
    const cy = gap + hIdx * cell + cell / 2
    body += `<text x="${gutter - 8}" y="${cy + fontSize * 0.35}" font-size="${fontSize}" text-anchor="end" fill="${INK}" font-family="sans-serif">${HOLE_LETTERS[hIdx]}</text>`
  }
  for (let x = 0; x < tablets; x++) {
    const tablet = draft.tablets[x]
    body += `<text x="${gutter + x * cell + cell / 2}" y="${gap - 5}" font-size="${fontSize}" text-anchor="middle" fill="${INK}" font-family="sans-serif">${x + 1}</text>`
    for (let hIdx = 0; hIdx < HOLES; hIdx++) {
      const cx = gutter + x * cell + cell / 2
      const cy = gap + hIdx * cell + cell / 2
      const hex = hexById.get(tablet.holes[hIdx]) ?? '#000000'
      body += `<circle cx="${cx}" cy="${cy}" r="${cell * 0.38}" fill="${hex}" stroke="${INK}" stroke-width="0.8"/>`
    }
    const szCy = gap + HOLES * cell + cell * 0.55
    body += `<text x="${gutter + x * cell + cell / 2}" y="${szCy}" font-size="${fontSize}" text-anchor="middle" fill="${INK}" font-family="sans-serif">${tablet.twist} ${tablet.twist === 'S' ? '/' : '\\'}</text>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fafaf9"/>${body}</svg>`
}

export function draftSvg(draft: Draft, cell = 20): string {
  const turning = turningSvg(draft, { cell })
  const threading = threadingSvg(draft, { cell })
  const dims = (svg: string) => {
    const m = svg.match(/width="(\d+)" height="(\d+)"/)
    return { w: Number(m?.[1] ?? 0), h: Number(m?.[2] ?? 0) }
  }
  const t = dims(turning)
  const th = dims(threading)
  const w = Math.max(t.w, th.w)
  const gap = 24
  const totalH = 18 + t.h + gap + th.h
  const strip = (svg: string) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}"><text x="0" y="13" font-size="12" fill="${INK}" font-family="sans-serif">${escapeXml(draft.name)}</text><svg x="0" y="18" width="${t.w}" height="${t.h}" viewBox="0 0 ${t.w} ${t.h}">${strip(turning)}</svg><svg x="0" y="${18 + t.h + gap}" width="${th.w}" height="${th.h}" viewBox="0 0 ${th.w} ${th.h}">${strip(threading)}</svg></svg>`
}
