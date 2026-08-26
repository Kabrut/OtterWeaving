import { describe, expect, it } from 'vitest'
import type { Turn } from './types'
import { computeMetrics } from './metrics'
import { buildDraft } from './draft.test'

const F = 'F' as Turn
const B = 'B' as Turn

describe('computeMetrics', () => {
  const draft = buildDraft(
    [
      { holes: ['w', 'k', 'w', 'k'] },
      { holes: ['k', 'k', 'k', 'k'] },
    ],
    [
      [F, F],
      [F, B],
      [B, B],
      [B, B],
      [F, F],
      [F, F],
      [F, F],
      [F, F],
    ],
  )
  const metrics = computeMetrics(draft)

  it('counts tablets and rows', () => {
    expect(metrics.tablets).toBe(2)
    expect(metrics.rows).toBe(8)
  })

  it('derives band width from tablet count', () => {
    expect(metrics.bandWidthCm).toBeCloseTo(2 * 0.3, 5)
  })

  it('derives woven length from pick spacing', () => {
    expect(metrics.wovenLengthCm).toBeCloseTo(8 * 0.25, 5)
  })

  it('adds takeup and loom waste to the warp length', () => {
    expect(metrics.warpLengthCm).toBeCloseTo(2 * 1.35 + 60, 5)
  })

  it('splits weft length per color with slack and takeup', () => {
    expect(metrics.weft).toHaveLength(1)
    expect(metrics.weft[0].colorId).toBe('w')
    expect(metrics.weft[0].rows).toBe(8)
    expect(metrics.weft[0].lengthCm).toBeCloseTo(8 * (0.6 + 8) * 1.05, 1)
  })

  it('sums thread counts to tablets times four', () => {
    expect(metrics.threads.reduce((acc, t) => acc + t.threadCount, 0)).toBe(8)
    expect(metrics.threads).toHaveLength(2)
  })

  it('counts threads per color across holes', () => {
    const byId = new Map(metrics.threads.map((t) => [t.colorId, t.threadCount]))
    expect(byId.get('k')).toBe(6)
    expect(byId.get('w')).toBe(2)
  })

  it('sorts thread usage by descending count', () => {
    const counts = metrics.threads.map((t) => t.threadCount)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    expect(metrics.threads[0].colorId).toBe('k')
  })

  it('scales for a wider band', () => {
    const wide = buildDraft(
      Array.from({ length: 10 }, () => ({ holes: ['w'] })),
      [
        Array<Turn>(10).fill(F),
        Array<Turn>(10).fill(B),
        Array<Turn>(10).fill(F),
        Array<Turn>(10).fill(B),
        Array<Turn>(10).fill(F),
        Array<Turn>(10).fill(B),
        Array<Turn>(10).fill(F),
        Array<Turn>(10).fill(B),
      ],
    )
    const m = computeMetrics(wide)
    expect(m.bandWidthCm).toBeCloseTo(10 * 0.3, 5)
    expect(m.wovenLengthCm).toBeCloseTo(8 * 0.25, 5)
    expect(m.warpLengthCm).toBeCloseTo(2 * 1.35 + 60, 5)
    expect(m.threads).toHaveLength(1)
    expect(m.threads[0].threadCount).toBe(40)
    expect(m.threads[0].warpLengthCm).toBeCloseTo(62.7, 5)
    expect(m.weft[0].lengthCm).toBeCloseTo(8 * (3 + 8) * 1.05, 1)
  })
})
