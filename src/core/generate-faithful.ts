import type { ColorId, Draft, HexMatrix, ThreadColor, Turn } from './types'
import { HOLES } from './types'
import { makeRow, makeTablet, colorHexMap } from './draft'
import { columnDistinctColors, threadedinHoles } from './generate-threadedin'
import { simulate, gridToHex } from './simulator'

const FLIP_PENALTY = 1e-3
const INF = Infinity

function enumerateArrangements(distinct: ColorId[]): ColorId[][] {
  const m = distinct.length
  if (m === 0) return []
  const results: ColorId[][] = []
  const seen = new Set<string>()
  const current: ColorId[] = []
  const used = new Array<boolean>(m).fill(false)
  const recurse = () => {
    if (current.length === HOLES) {
      if (used.every(Boolean) && !seen.has(current.join('\u0000'))) {
        seen.add(current.join('\u0000'))
        results.push([...current])
      }
      return
    }
    for (let i = 0; i < m; i++) {
      current.push(distinct[i])
      const wasUsed = used[i]
      used[i] = true
      recurse()
      used[i] = wasUsed
      current.pop()
    }
  }
  recurse()
  return results
}

export interface ColumnSolution {
  holes: ColorId[]
  turns: Turn[]
  cost: number
}

export function solveColumn(column: ColorId[]): ColumnSolution {
  const distinct = columnDistinctColors(column, HOLES)
  const canonical = threadedinHoles(distinct)
  const arrangements = enumerateArrangements(distinct)
  const ordered = [canonical, ...arrangements.filter((a) => a.join('\u0000') !== canonical.join('\u0000'))]
  let best: ColumnSolution | null = null
  for (const holes of ordered) {
    const solution = solveColumnForHoles(holes, column)
    if (best === null || solution.cost < best.cost) best = solution
  }
  return best as ColumnSolution
}

function solveColumnForHoles(holes: ColorId[], column: ColorId[]): ColumnSolution {
  const n = column.length
  const turnsOrder: Turn[] = ['F', 'B']
  let dp: number[][] = Array.from({ length: HOLES }, () => [INF, INF])
  const choices: number[][][] = []
  for (let r = 0; r < n; r++) {
    const ndp: number[][] = Array.from({ length: HOLES }, () => [INF, INF])
    const rowChoice: number[][] = Array.from({ length: HOLES }, () => [-1, -1])
    for (let s = 0; s < HOLES; s++) {
      for (let ti = 0; ti < 2; ti++) {
        const turn = turnsOrder[ti]
        const prevS = turn === 'F' ? (s + 1) % HOLES : (s + HOLES - 1) % HOLES
        const revealed = turn === 'F' ? holes[prevS] : holes[(prevS + 1) % HOLES]
        const cellCost = revealed === column[r] ? 0 : 1
        if (r === 0) {
          if (prevS !== HOLES - 1) continue
          ndp[s][ti] = cellCost
          rowChoice[s][ti] = -1
          continue
        }
        let bestPrev = INF
        let bestPrevTi = -1
        for (let pti = 0; pti < 2; pti++) {
          const base = dp[prevS][pti]
          if (base === INF) continue
          const penalty = pti !== ti ? FLIP_PENALTY : 0
          const total = base + penalty
          if (total < bestPrev) {
            bestPrev = total
            bestPrevTi = pti
          }
        }
        if (bestPrevTi === -1) continue
        ndp[s][ti] = bestPrev + cellCost
        rowChoice[s][ti] = bestPrevTi
      }
    }
    dp = ndp
    choices.push(rowChoice)
  }
  let bestCost = INF
  let bestS = 0
  let bestTi = 0
  for (let s = 0; s < HOLES; s++) {
    for (let ti = 0; ti < 2; ti++) {
      if (dp[s][ti] < bestCost) {
        bestCost = dp[s][ti]
        bestS = s
        bestTi = ti
      }
    }
  }
  const turns: Turn[] = new Array(n)
  let s = bestS
  let ti = bestTi
  for (let r = n - 1; r >= 0; r--) {
    turns[r] = turnsOrder[ti]
    const prevTi = choices[r][s][ti]
    const turn = turnsOrder[ti]
    const prevS = turn === 'F' ? (s + 1) % HOLES : (s + HOLES - 1) % HOLES
    s = prevS
    ti = prevTi === -1 ? 0 : prevTi
  }
  return { holes, turns, cost: bestCost }
}

export interface FaithfulOptions {
  weft: ColorId
}

export interface FaithfulResult {
  draft: Draft
  mismatch: number
}

export function generateFaithful(
  target: HexMatrix,
  palette: ThreadColor[],
  name: string,
  options: FaithfulOptions,
): FaithfulResult {
  const rowsCount = target.length
  const tabletsCount = target[0]?.length ?? 0
  const hexToId = new Map(palette.map((c) => [c.hex, c.id]))
  const tablets = []
  const turnColumns: Turn[][] = []
  for (let x = 0; x < tabletsCount; x++) {
    const column = target.map((row) => hexToId.get(row[x]) ?? palette[0].id)
    const solution = solveColumn(column)
    tablets.push(makeTablet(solution.holes))
    turnColumns.push(solution.turns)
  }
  const rows = []
  for (let r = 0; r < rowsCount; r++) {
    rows.push(
      makeRow(
        turnColumns.map((col) => col[r]),
        options.weft,
      ),
    )
  }
  const draft: Draft = { version: 1, name, tablets, rows, palette: [...palette] }
  const sim = simulate(draft)
  const simHex = gridToHex(sim.grid, colorHexMap(draft))
  let mismatch = 0
  for (let r = 0; r < rowsCount; r++) {
    for (let x = 0; x < tabletsCount; x++) {
      if (simHex[r][x] !== target[r][x]) mismatch++
    }
  }
  return { draft, mismatch }
}
