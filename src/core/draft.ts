import type { ColorId, Draft, GeneratorMeta, Tablet, ThreadColor, Turn, Twist } from './types'
import { HOLES } from './types'
import { normalizeHex } from './color'

export const PROJECT_MAGIC = 'otter-weaving'

export interface ProjectFile {
  magic: typeof PROJECT_MAGIC
  kind: 'project'
  version: 1
  draft: Draft
  generator: GeneratorMeta | null
  savedAt: string
}

export function makeColor(id: ColorId, hex: string, name = ''): ThreadColor {
  return { id, hex: normalizeHex(hex), name }
}

export function paletteFromHexes(hexes: string[], prefix = 'c'): ThreadColor[] {
  const seen = new Set<string>()
  const out: ThreadColor[] = []
  for (const hex of hexes) {
    const h = normalizeHex(hex)
    if (seen.has(h)) continue
    seen.add(h)
    out.push(makeColor(`${prefix}${out.length}`, h))
  }
  return out
}

export function makeTablet(holes: ColorId[], twist: Twist = 'Z'): Tablet {
  const filled: ColorId[] = []
  for (let i = 0; i < HOLES; i++) {
    filled.push(holes[i] ?? holes[holes.length - 1] ?? 'c0')
  }
  return { holes: filled as Tablet['holes'], twist }
}

export function makeRow(turns: Turn[], weft: ColorId): Draft['rows'][number] {
  return { turns: [...turns], weft }
}

export function createEmptyDraft(
  name: string,
  tablets: number,
  rows: number,
  color: ThreadColor,
): Draft {
  return {
    version: 1,
    name,
    tablets: Array.from({ length: tablets }, () => makeTablet([color.id])),
    rows: Array.from({ length: rows }, () => makeRow(Array(tablets).fill('F'), color.id)),
    palette: [color],
  }
}

export function cloneDraft(draft: Draft): Draft {
  return structuredClone(draft)
}

export function colorHexMap(draft: Draft): Map<ColorId, string> {
  const m = new Map<ColorId, string>()
  for (const c of draft.palette) m.set(c.id, c.hex)
  return m
}

export function validateDraft(draft: Draft): string[] {
  const errors: string[] = []
  if (draft.version !== 1) errors.push('draft.version')
  if (!Array.isArray(draft.tablets) || draft.tablets.length === 0) errors.push('draft.tablets')
  if (!Array.isArray(draft.rows) || draft.rows.length === 0) errors.push('draft.rows')
  if (errors.length > 0) return errors
  const ids = new Set(draft.palette.map((c) => c.id))
  if (ids.size !== draft.palette.length) errors.push('palette.duplicateIds')
  const hexRe = /^#[0-9a-f]{6}$/
  for (const c of draft.palette) {
    if (!hexRe.test(c.hex)) errors.push(`palette.${c.id}.hex`)
  }
  draft.tablets.forEach((t, i) => {
    if (t.holes.length !== HOLES) errors.push(`tablets.${i}.holes`)
    if (t.twist !== 'S' && t.twist !== 'Z') errors.push(`tablets.${i}.twist`)
    t.holes.forEach((h, j) => {
      if (!ids.has(h)) errors.push(`tablets.${i}.holes.${j}.unknownColor`)
    })
  })
  draft.rows.forEach((r, i) => {
    if (r.turns.length !== draft.tablets.length) errors.push(`rows.${i}.turns`)
    if (!ids.has(r.weft)) errors.push(`rows.${i}.weft`)
    r.turns.forEach((t, j) => {
      if (t !== 'F' && t !== 'B') errors.push(`rows.${i}.turns.${j}`)
    })
  })
  return errors
}

export function projectToJson(draft: Draft, generator: GeneratorMeta | null): string {
  const file: ProjectFile = {
    magic: PROJECT_MAGIC,
    kind: 'project',
    version: 1,
    draft,
    generator,
    savedAt: new Date().toISOString(),
  }
  return JSON.stringify(file, null, 2)
}

export class ProjectParseError extends Error {}

export function projectFromJson(text: string): ProjectFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ProjectParseError('invalid json')
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as Record<string, unknown>).magic !== PROJECT_MAGIC
  ) {
    throw new ProjectParseError('not an otter project')
  }
  const file = parsed as Partial<ProjectFile>
  if (file.version !== 1) {
    throw new ProjectParseError(`unsupported version ${String(file.version)}`)
  }
  const draft = file.draft as Draft
  const errors = validateDraft(draft)
  if (errors.length > 0) {
    throw new ProjectParseError(`invalid draft: ${errors.join(', ')}`)
  }
  return {
    magic: PROJECT_MAGIC,
    kind: 'project',
    version: 1,
    draft,
    generator: file.generator ?? null,
    savedAt: file.savedAt ?? '',
  }
}
