import type { ColorId, Draft } from './types'
import { HOLES } from './types'

export const START_POSITION = HOLES - 1

export function revealIndex(state: number, turn: 'F' | 'B'): number {
  return turn === 'F' ? state : (state + 1) % HOLES
}

export function nextState(state: number, turn: 'F' | 'B'): number {
  return turn === 'F' ? (state + HOLES - 1) % HOLES : (state + 1) % HOLES
}

export interface Simulation {
  grid: ColorId[][]
  netTurns: number[]
}

export function simulate(draft: Draft): Simulation {
  const states = new Array<number>(draft.tablets.length).fill(START_POSITION)
  const grid = draft.rows.map((row) =>
    draft.tablets.map((tablet, i) => {
      const turn = row.turns[i]
      const revealed = tablet.holes[revealIndex(states[i], turn)]
      states[i] = nextState(states[i], turn)
      return revealed
    }),
  )
  const netTurns = draft.tablets.map((_, i) =>
    draft.rows.reduce((acc, row) => acc + (row.turns[i] === 'F' ? 1 : -1), 0),
  )
  return { grid, netTurns }
}

export function gridToHex(grid: ColorId[][], hexById: Map<ColorId, string>): string[][] {
  return grid.map((row) => row.map((id) => hexById.get(id) ?? '#000000'))
}
