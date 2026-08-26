import { create } from 'zustand'
import type { ColorId, Draft, GeneratorMeta, HexMatrix } from '../core/types'
import { cloneDraft, projectFromJson, projectToJson, type ProjectFile } from '../core/draft'
import type { InkleDraft } from '../core/inkle'
import { cloneInkleDraft, validateInkleDraft } from '../core/inkle'

export type Tab =
  'wizard' | 'result' | 'editor' | 'print' | 'inkleWizard' | 'inkleEditor' | 'inklePrint'

const STORAGE_KEY = 'otterweaving:autosave'
const INKLE_STORAGE_KEY = 'otterweaving:autosave-inkle'
const HISTORY_LIMIT = 100

export interface InkleSource {
  url: string
  fileName: string
  matrix: HexMatrix | null
}

export interface AppState {
  tab: Tab
  draft: Draft | null
  generator: GeneratorMeta | null
  manualEdits: boolean
  lastColorId: ColorId | null
  past: Draft[]
  future: Draft[]

  setTab: (tab: Tab) => void
  setLastColor: (colorId: ColorId) => void
  setGenerated: (draft: Draft, generator: GeneratorMeta) => void
  editDraft: (mutate: (draft: Draft) => void) => void
  replaceDraft: (draft: Draft, options?: { manual?: boolean }) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  loadFromProjectFile: (json: string) => boolean
  serializeProject: () => string | null
  newProject: (draft: Draft) => void
  clearProject: () => void

  inkleDraft: InkleDraft | null
  inklePast: InkleDraft[]
  inkleFuture: InkleDraft[]
  inkleSource: InkleSource | null

  setInkle: (draft: InkleDraft) => void
  editInkle: (mutate: (draft: InkleDraft) => void) => void
  undoInkle: () => void
  redoInkle: () => void
  canUndoInkle: () => boolean
  canRedoInkle: () => boolean
  clearInkle: () => void
  setInkleSource: (source: InkleSource | null) => void
}

function pushHistory<T>(past: T[], draft: T): T[] {
  const next = [...past, draft]
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
}

export const useAppStore = create<AppState>((set, get) => ({
  tab: 'wizard',
  draft: null,
  generator: null,
  manualEdits: false,
  lastColorId: null,
  past: [],
  future: [],
  inkleDraft: null,
  inklePast: [],
  inkleFuture: [],
  inkleSource: null,

  setTab: (tab) => set({ tab }),

  setLastColor: (colorId) => set({ lastColorId: colorId }),

  setGenerated: (draft, generator) => {
    set({ draft, generator, manualEdits: false, past: [], future: [], tab: 'result' })
  },

  editDraft: (mutate) => {
    const { draft } = get()
    if (!draft) return
    const next = cloneDraft(draft)
    mutate(next)
    set((state) => ({
      draft: next,
      manualEdits: true,
      past: pushHistory(state.past, draft),
      future: [],
    }))
  },

  replaceDraft: (draft, options) => {
    set((state) => ({
      draft,
      manualEdits: options?.manual ?? state.manualEdits,
      past: pushHistory(state.past, state.draft ?? draft),
      future: [],
    }))
  },

  undo: () => {
    const { past, draft, future } = get()
    if (past.length === 0 || !draft) return
    const previous = past[past.length - 1]
    set({
      draft: previous,
      past: past.slice(0, -1),
      future: [draft, ...future],
      manualEdits: past.length > 1,
    })
  },

  redo: () => {
    const { past, draft, future } = get()
    if (future.length === 0 || !draft) return
    const next = future[0]
    set({
      draft: next,
      past: pushHistory(past, draft),
      future: future.slice(1),
      manualEdits: true,
    })
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  loadFromProjectFile: (json) => {
    try {
      const file: ProjectFile = projectFromJson(json)
      set({
        draft: file.draft,
        generator: file.generator,
        manualEdits: false,
        past: [],
        future: [],
        tab: 'result',
      })
      return true
    } catch {
      return false
    }
  },

  serializeProject: () => {
    const { draft, generator } = get()
    if (!draft) return null
    return projectToJson(draft, generator)
  },

  newProject: (draft) => {
    set({ draft, generator: null, manualEdits: false, past: [], future: [], tab: 'editor' })
  },

  clearProject: () => {
    set({
      tab: 'wizard',
      draft: null,
      generator: null,
      manualEdits: false,
      past: [],
      future: [],
    })
  },

  setInkle: (draft) => {
    set({ inkleDraft: draft, inklePast: [], inkleFuture: [], tab: 'inkleEditor' })
  },

  editInkle: (mutate) => {
    const { inkleDraft } = get()
    if (!inkleDraft) return
    const next = cloneInkleDraft(inkleDraft)
    mutate(next)
    set((state) => ({
      inkleDraft: next,
      inklePast: pushHistory(state.inklePast, inkleDraft),
      inkleFuture: [],
    }))
  },

  undoInkle: () => {
    const { inklePast, inkleDraft, inkleFuture } = get()
    if (inklePast.length === 0 || !inkleDraft) return
    const previous = inklePast[inklePast.length - 1]
    set({
      inkleDraft: previous,
      inklePast: inklePast.slice(0, -1),
      inkleFuture: [inkleDraft, ...inkleFuture],
    })
  },

  redoInkle: () => {
    const { inklePast, inkleDraft, inkleFuture } = get()
    if (inkleFuture.length === 0 || !inkleDraft) return
    const next = inkleFuture[0]
    set({
      inkleDraft: next,
      inklePast: pushHistory(inklePast, inkleDraft),
      inkleFuture: inkleFuture.slice(1),
    })
  },

  canUndoInkle: () => get().inklePast.length > 0,
  canRedoInkle: () => get().inkleFuture.length > 0,

  clearInkle: () => {
    set({ inkleDraft: null, inklePast: [], inkleFuture: [], inkleSource: null, tab: 'inkleWizard' })
  },

  setInkleSource: (source) => set({ inkleSource: source }),
}))

let saveTimer: ReturnType<typeof setTimeout> | null = null

useAppStore.subscribe((state) => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      if (state.draft) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ draft: state.draft, generator: state.generator }),
        )
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // localStorage unavailable (private mode) — ignore
    }
    try {
      if (state.inkleDraft) {
        localStorage.setItem(INKLE_STORAGE_KEY, JSON.stringify(state.inkleDraft))
      } else {
        localStorage.removeItem(INKLE_STORAGE_KEY)
      }
    } catch {
      // localStorage unavailable (private mode) — ignore
    }
  }, 400)
})

export function restoreAutosave(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { draft?: unknown; generator?: unknown }
    const file = projectFromJson(
      projectToJson(parsed.draft as Draft, (parsed.generator as GeneratorMeta) ?? null),
    )
    useAppStore.setState({
      draft: file.draft,
      generator: file.generator,
      tab: 'result',
    })
    return true
  } catch {
    return false
  }
}

export function restoreInkleAutosave(): boolean {
  try {
    const raw = localStorage.getItem(INKLE_STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as InkleDraft
    if (validateInkleDraft(parsed).length > 0) return false
    useAppStore.setState({ inkleDraft: parsed, inklePast: [], inkleFuture: [] })
    return true
  } catch {
    return false
  }
}
