import type { ColorId, ThreadColor } from './types'

export interface InkleWarpThread {
  colorId: ColorId
  heddled: boolean
  pattern: boolean
}

export interface InklePass {
  up: boolean
  picks: boolean[]
}

export interface InkleDraft {
  version: 1
  name: string
  warp: InkleWarpThread[]
  weft: ColorId
  passes: InklePass[]
  palette: ThreadColor[]
}

export interface InkleSimulation {
  grid: ColorId[][]
}

export interface InkleMetrics {
  warpCount: number
  passes: number
  bandWidthCm: number
  wovenLengthCm: number
  warpLengthCm: number
  threads: { colorId: string; hex: string; name: string; count: number }[]
}

const THREAD_WIDTH_CM = 0.3
const PICK_SPACING_CM = 0.25
const WARP_TAKEUP = 1.35
const LOOM_WASTE_CM = 60

export function plainPasses(passes: number, warpCount: number): InklePass[] {
  return Array.from({ length: passes }, (_, i) => ({
    up: i % 2 === 0,
    picks: new Array<boolean>(warpCount).fill(false),
  }))
}

export function simulateInkle(draft: InkleDraft): InkleSimulation {
  const grid = draft.passes.map((pass) =>
    draft.warp.map((thread, i) => {
      if (pass.picks[i]) return thread.colorId
      const visible = pass.up ? thread.heddled : !thread.heddled
      return visible ? thread.colorId : draft.weft
    }),
  )
  return { grid }
}

export function validateInkleDraft(draft: InkleDraft): string[] {
  const errors: string[] = []
  if (draft.version !== 1) errors.push('draft.version')
  if (!Array.isArray(draft.warp) || draft.warp.length === 0) errors.push('draft.warp')
  if (!Array.isArray(draft.passes) || draft.passes.length === 0) errors.push('draft.passes')
  if (errors.length > 0) return errors
  const ids = new Set(draft.palette.map((c) => c.id))
  if (ids.size !== draft.palette.length) errors.push('palette.duplicateIds')
  const hexRe = /^#[0-9a-f]{6}$/
  for (const c of draft.palette) {
    if (!hexRe.test(c.hex)) errors.push(`palette.${c.id}.hex`)
  }
  draft.warp.forEach((thread, i) => {
    if (!ids.has(thread.colorId)) errors.push(`warp.${i}.unknownColor`)
  })
  if (!ids.has(draft.weft)) errors.push('draft.weft')
  draft.passes.forEach((pass, i) => {
    if (pass.picks.length !== draft.warp.length) errors.push(`passes.${i}.picks`)
  })
  return errors
}

export function cloneInkleDraft(draft: InkleDraft): InkleDraft {
  return structuredClone(draft)
}

export function computeInkleMetrics(draft: InkleDraft): InkleMetrics {
  const warpCount = draft.warp.length
  const passes = draft.passes.length
  const bandWidthCm = Math.round(warpCount * THREAD_WIDTH_CM * 10) / 10
  const wovenLengthCm = Math.round(passes * PICK_SPACING_CM * 10) / 10
  const warpLengthCm = Math.round((wovenLengthCm * WARP_TAKEUP + LOOM_WASTE_CM) * 10) / 10
  const colorById = new Map(draft.palette.map((c) => [c.id, c]))
  const counts = new Map<string, number>()
  for (const thread of draft.warp) {
    counts.set(thread.colorId, (counts.get(thread.colorId) ?? 0) + 1)
  }
  const threads = [...counts.entries()].map(([colorId, count]) => ({
    colorId,
    hex: colorById.get(colorId)?.hex ?? '#000000',
    name: colorById.get(colorId)?.name ?? '',
    count,
  }))
  threads.sort((a, b) => b.count - a.count)
  return { warpCount, passes, bandWidthCm, wovenLengthCm, warpLengthCm, threads }
}
