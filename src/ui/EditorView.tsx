import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  Eraser,
  Eye,
  EyeOff,
  Minus,
  Pencil,
  Plus,
  Redo2,
  Rows3,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useAppStore } from '../state/store'
import { t } from '../i18n/pl'
import type { Tablet, Turn } from '../core/types'
import { HOLE_LETTERS, HOLES } from '../core/types'
import { colorHexMap, makeColor, makeRow, makeTablet } from '../core/draft'
import { templateChevron, templateDiagonals, templateStripes } from '../core/templates'
import { normalizeHex, readableTextOn } from '../core/color'
import { FabricCanvas } from './common/FabricCanvas'
import { Palette } from './common/Palette'

type Tool = 'turn' | 'hole' | 'weft'

interface TurnRowProps {
  row: number
  turns: Turn[]
  prevTurns: Turn[] | null
  weftHex: string
  cell: number
  paintTool: boolean
  weftTool: boolean
  onCellDown: (row: number, col: number, shift: boolean) => void
  onCellEnter: (row: number, col: number) => void
  onHeaderDown: (row: number, shift: boolean) => void
}

const TurnRow = memo(function TurnRow({
  row,
  turns,
  prevTurns,
  weftHex,
  cell,
  paintTool,
  weftTool,
  onCellDown,
  onCellEnter,
  onHeaderDown,
}: TurnRowProps) {
  return (
    <>
      <div
        onMouseDown={(e) => {
          if (e.button === 0) onHeaderDown(row, e.shiftKey)
        }}
        className={`flex items-center justify-end gap-1.5 pr-1.5 text-xs tabular-nums text-stone-500 dark:text-stone-400 ${weftTool ? 'cursor-pointer' : ''}`}
      >
        <span>{row + 1}</span>
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border border-stone-300 dark:border-stone-600"
          style={{ backgroundColor: weftHex }}
        />
      </div>
      {turns.map((turn, col) => (
        <div
          key={col}
          onMouseDown={(e) => {
            if (e.button === 0) onCellDown(row, col, e.shiftKey)
          }}
          onMouseEnter={() => onCellEnter(row, col)}
          className={`relative flex items-center justify-center border border-stone-200 dark:border-stone-700 ${
            turn === 'F' ? 'bg-white' : 'bg-stone-300 dark:bg-stone-400'
          } ${paintTool ? 'cursor-pointer' : ''}`}
          style={{ width: cell, height: cell }}
        >
          {turn === 'F' ? (
            <Redo2 size={Math.round(cell * 0.55)} className="text-stone-800" aria-hidden />
          ) : (
            <Undo2 size={Math.round(cell * 0.55)} className="text-stone-800" aria-hidden />
          )}
          {prevTurns !== null && prevTurns[col] !== turn && (
            <span className="absolute inset-x-0 bottom-0 h-[2px] bg-red-600" />
          )}
        </div>
      ))}
    </>
  )
})

export default function EditorView() {
  const draft = useAppStore((s) => s.draft)
  const lastColorId = useAppStore((s) => s.lastColorId)
  const canUndo = useAppStore((s) => s.past.length > 0)
  const canRedo = useAppStore((s) => s.future.length > 0)
  const setLastColor = useAppStore((s) => s.setLastColor)
  const editDraft = useAppStore((s) => s.editDraft)
  const undo = useAppStore((s) => s.undo)
  const redo = useAppStore((s) => s.redo)
  const [tool, setTool] = useState<Tool>('turn')
  const [cell, setCell] = useState(18)
  const [showFabric, setShowFabric] = useState(true)
  const paintRef = useRef<Turn | null>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const pickTargetRef = useRef<{ kind: 'add' } | { kind: 'edit'; id: string } | null>(null)

  const hexById = useMemo(
    () => (draft ? colorHexMap(draft) : new Map<string, string>()),
    [draft],
  )

  useEffect(() => {
    const stop = () => {
      paintRef.current = null
    }
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useAppStore.getState().undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        useAppStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const el = colorInputRef.current
    if (!el) return
    const onChange = () => {
      const target = pickTargetRef.current
      pickTargetRef.current = null
      if (!target) return
      const hex = el.value
      const { editDraft } = useAppStore.getState()
      if (target.kind === 'add') {
        editDraft((d) => {
          const ids = new Set(d.palette.map((c) => c.id))
          let n = d.palette.length
          let id = `c${n}`
          while (ids.has(id)) {
            n += 1
            id = `c${n}`
          }
          d.palette.push(makeColor(id, hex))
        })
      } else {
        editDraft((d) => {
          const c = d.palette.find((p) => p.id === target.id)
          if (c) c.hex = normalizeHex(hex)
        })
      }
    }
    el.addEventListener('change', onChange)
    return () => el.removeEventListener('change', onChange)
  }, [])

  const applyTurn = useCallback((row: number, col: number, value: Turn) => {
    useAppStore.getState().editDraft((d) => {
      d.rows[row].turns[col] = value
    })
  }, [])

  const onCellDown = useCallback(
    (row: number, col: number, shift: boolean) => {
      if (tool !== 'turn') return
      const { draft } = useAppStore.getState()
      if (!draft) return
      if (shift) {
        const value = draft.rows[row].turns[col]
        paintRef.current = null
        useAppStore.getState().editDraft((d) => {
          d.rows.forEach((r) => {
            r.turns[col] = value
          })
        })
        return
      }
      const value: Turn = draft.rows[row].turns[col] === 'F' ? 'B' : 'F'
      paintRef.current = value
      applyTurn(row, col, value)
    },
    [tool, applyTurn],
  )

  const onCellEnter = useCallback(
    (row: number, col: number) => {
      const value = paintRef.current
      if (tool !== 'turn' || value === null) return
      const { draft } = useAppStore.getState()
      if (!draft || draft.rows[row].turns[col] === value) return
      applyTurn(row, col, value)
    },
    [tool, applyTurn],
  )

  const onHeaderDown = useCallback(
    (row: number, shift: boolean) => {
      const { draft } = useAppStore.getState()
      if (!draft) return
      if (shift && tool === 'turn') {
        const value = draft.rows[row].turns[0]
        useAppStore.getState().editDraft((d) => {
          d.rows[row].turns = d.rows[row].turns.map(() => value)
        })
        return
      }
      if (tool === 'weft') {
        const palette = draft.palette
        if (palette.length === 0) return
        const idx = palette.findIndex((c) => c.id === draft.rows[row].weft)
        const next = palette[(idx + 1) % palette.length].id
        useAppStore.getState().editDraft((d) => {
          d.rows[row].weft = next
        })
      }
    },
    [tool],
  )

  const onHoleDown = useCallback(
    (tablet: number, hole: number) => {
      if (tool !== 'hole') return
      const { draft, lastColorId } = useAppStore.getState()
      if (!draft) return
      const colorId = lastColorId ?? draft.palette[0]?.id
      if (!colorId) return
      useAppStore.getState().editDraft((d) => {
        d.tablets[tablet].holes[hole] = colorId
      })
    },
    [tool],
  )

  const onTwistClick = useCallback((tablet: number) => {
    useAppStore.getState().editDraft((d) => {
      const tb = d.tablets[tablet]
      tb.twist = tb.twist === 'S' ? 'Z' : 'S'
      d.rows.forEach((r) => {
        r.turns[tablet] = r.turns[tablet] === 'F' ? 'B' : 'F'
      })
    })
  }, [])

  if (!draft) return null

  const tablets = draft.tablets.length
  const rowsCount = draft.rows.length

  const openPicker = (
    target: { kind: 'add' } | { kind: 'edit'; id: string },
    currentHex: string,
  ) => {
    pickTargetRef.current = target
    const el = colorInputRef.current
    if (!el) return
    el.value = currentHex
    el.click()
  }

  const fillColumns = () =>
    editDraft((d) => {
      const top = d.rows[0].turns
      d.rows.forEach((r) => {
        r.turns = [...top]
      })
    })

  const fillRows = () =>
    editDraft((d) => {
      d.rows.forEach((r) => {
        const first = r.turns[0]
        r.turns = r.turns.map(() => first)
      })
    })

  const shiftHoles = (offset: number) =>
    editDraft((d) => {
      d.tablets.forEach((tb) => {
        const rotated = [0, 1, 2, 3].map((j) => tb.holes[(j + offset) % HOLES]) as Tablet['holes']
        tb.holes = rotated
      })
    })

  const clearTurning = () =>
    editDraft((d) => {
      d.rows.forEach((r) => {
        r.turns = r.turns.map(() => 'F')
      })
    })

  const addRow = () =>
    editDraft((d) => {
      const last = d.rows[d.rows.length - 1]
      d.rows.push(makeRow(last.turns, last.weft))
    })

  const removeRow = () =>
    editDraft((d) => {
      if (d.rows.length > 1) d.rows.pop()
    })

  const addTablet = () =>
    editDraft((d) => {
      const last = d.tablets[d.tablets.length - 1]
      d.tablets.push(makeTablet(last.holes, last.twist))
      d.rows.forEach((r) => {
        r.turns.push(r.turns[r.turns.length - 1] ?? 'F')
      })
    })

  const removeTablet = () =>
    editDraft((d) => {
      if (d.tablets.length <= 1) return
      d.tablets.pop()
      d.rows.forEach((r) => {
        r.turns.pop()
      })
    })

  const loadTemplate = (kind: 'stripes' | 'diagonals' | 'chevron') => {
    const current = useAppStore.getState().draft
    if (!current) return
    const palette =
      current.palette.length > 0
        ? current.palette
        : [makeColor('c0', '#1c1917'), makeColor('c1', '#fafaf9')]
    const a = palette[1] ?? palette[0]
    const b = palette[0]
    const loaded =
      kind === 'stripes'
        ? templateStripes(current.name, current.tablets.length, current.rows.length, a.id, b.id)
        : kind === 'diagonals'
          ? templateDiagonals(current.name, current.tablets.length, current.rows.length, a.id, b.id)
          : templateChevron(current.name, current.tablets.length, current.rows.length, a.id, b.id)
    loaded.palette = palette
    useAppStore.getState().replaceDraft(loaded, { manual: false })
  }

  const zoom = (delta: number) => setCell((c) => Math.min(32, Math.max(12, c + delta)))

  const toolDefs = [
    ['turn', 'toolTurn'],
    ['hole', 'toolHole'],
    ['weft', 'toolWeft'],
  ] as const

  return (
    <div className="flex flex-col gap-4">
      <input ref={colorInputRef} type="color" className="absolute h-0 w-0 opacity-0" tabIndex={-1} aria-hidden />

      <div className="panel flex flex-wrap items-center gap-1.5 p-2">
        <button
          type="button"
          className="btn-ghost"
          title={t('editor', 'undo')}
          aria-label={t('editor', 'undo')}
          disabled={!canUndo}
          onClick={undo}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className="btn-ghost"
          title={t('editor', 'redo')}
          aria-label={t('editor', 'redo')}
          disabled={!canRedo}
          onClick={redo}
        >
          <Redo2 size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-stone-200 dark:bg-stone-700" />
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={addRow}
          title={t('editor', 'addRow')}
        >
          <Plus size={14} /> {t('editor', 'addRow')}
        </button>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={removeRow}
          disabled={rowsCount <= 1}
          title={t('editor', 'removeRow')}
        >
          <Minus size={14} /> {t('editor', 'removeRow')}
        </button>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={addTablet}
          title={t('editor', 'addTablet')}
        >
          <Plus size={14} /> {t('editor', 'addTablet')}
        </button>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={removeTablet}
          disabled={tablets <= 1}
          title={t('editor', 'removeTablet')}
        >
          <Minus size={14} /> {t('editor', 'removeTablet')}
        </button>
        <span className="mx-1 h-5 w-px bg-stone-200 dark:bg-stone-700" />
        <span className="px-1 text-xs tabular-nums text-stone-500 dark:text-stone-400">
          {rowsCount} × {tablets}
        </span>
        <button
          type="button"
          className="btn-ghost"
          title={t('editor', 'zoomOut')}
          aria-label={t('editor', 'zoomOut')}
          disabled={cell <= 12}
          onClick={() => zoom(-2)}
        >
          <ZoomOut size={16} />
        </button>
        <span className="w-7 text-center text-xs tabular-nums text-stone-500 dark:text-stone-400">
          {cell}
        </span>
        <button
          type="button"
          className="btn-ghost"
          title={t('editor', 'zoomIn')}
          aria-label={t('editor', 'zoomIn')}
          disabled={cell >= 32}
          onClick={() => zoom(2)}
        >
          <ZoomIn size={16} />
        </button>
        <span className="ml-auto" />
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={() => setShowFabric((v) => !v)}
        >
          {showFabric ? <EyeOff size={14} /> : <Eye size={14} />}
          {showFabric ? t('editor', 'hideFabric') : t('editor', 'showFabric')}
        </button>
      </div>

      <div className="flex items-start gap-4">
        <aside className="panel w-64 shrink-0 space-y-4 p-3">
          <label className="block">
            <span className="field-label">{t('editor', 'draftName')}</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) =>
                editDraft((d) => {
                  d.name = e.target.value
                })
              }
              className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-800"
            />
          </label>

          <div className="space-y-1.5">
            <span className="field-label">{t('editor', 'tools')}</span>
            {toolDefs.map(([value, key]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTool(value)}
                className={tool === value ? 'btn-primary w-full' : 'btn-secondary w-full'}
              >
                {t('editor', key)}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <span className="field-label">{t('editor', 'ops')}</span>
            <button type="button" className="btn-secondary w-full" onClick={fillColumns}>
              <Columns3 size={14} /> {t('editor', 'fillColumn')}
            </button>
            <button type="button" className="btn-secondary w-full" onClick={fillRows}>
              <Rows3 size={14} /> {t('editor', 'fillRow')}
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => shiftHoles(3)}>
              <ArrowDown size={14} /> {t('editor', 'shiftDown')}
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => shiftHoles(1)}>
              <ArrowUp size={14} /> {t('editor', 'shiftUp')}
            </button>
            <button type="button" className="btn-secondary w-full" onClick={clearTurning}>
              <Eraser size={14} /> {t('editor', 'clearTurning')}
            </button>
            <p className="pt-0.5 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
              {t('editor', 'hintShift')}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="field-label">{t('editor', 'palette')}</span>
            <Palette
              palette={draft.palette}
              selectedId={lastColorId}
              onSelect={setLastColor}
              size="sm"
            />
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => openPicker({ kind: 'add' }, '#14b8a6')}
            >
              <Plus size={14} /> {t('editor', 'addColor')}
            </button>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {draft.palette.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={`${t('editor', 'editColor')} · ${c.name || c.hex}`}
                  onClick={() => openPicker({ kind: 'edit', id: c.id }, c.hex)}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-stone-300 transition-transform hover:scale-110 dark:border-stone-600"
                  style={{ backgroundColor: c.hex, color: readableTextOn(c.hex) }}
                >
                  <Pencil size={12} aria-hidden />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="field-label">{t('editor', 'templates')}</span>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => loadTemplate('stripes')}
            >
              {t('editor', 'tplStripes')}
            </button>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => loadTemplate('diagonals')}
            >
              {t('editor', 'tplDiagonals')}
            </button>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => loadTemplate('chevron')}
            >
              {t('editor', 'tplChevron')}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="panel min-w-0 flex-1 p-4">
            <div className="max-h-[calc(100vh-13rem)] overflow-auto">
              <div className="field-label">{t('result', 'turning')}</div>
              <div
                className="grid w-fit"
                style={{ gridTemplateColumns: `2.5rem repeat(${tablets}, ${cell}px)` }}
              >
                <div />
                {Array.from({ length: tablets }, (_, x) => (
                  <div
                    key={x}
                    className="text-center text-[10px] tabular-nums text-stone-500 dark:text-stone-400"
                  >
                    {x + 1}
                  </div>
                ))}
                {draft.rows.map((row, y) => (
                  <TurnRow
                    key={y}
                    row={y}
                    turns={row.turns}
                    prevTurns={y > 0 ? draft.rows[y - 1].turns : null}
                    weftHex={hexById.get(row.weft) ?? '#000000'}
                    cell={cell}
                    paintTool={tool === 'turn'}
                    weftTool={tool === 'weft'}
                    onCellDown={onCellDown}
                    onCellEnter={onCellEnter}
                    onHeaderDown={onHeaderDown}
                  />
                ))}
              </div>

              <div className="field-label mt-6">{t('result', 'threading')}</div>
              <div
                className="grid w-fit"
                style={{ gridTemplateColumns: `1.5rem repeat(${tablets}, ${cell}px)` }}
              >
                <div />
                {draft.tablets.map((_, x) => (
                  <div
                    key={x}
                    className="text-center text-[10px] tabular-nums text-stone-500 dark:text-stone-400"
                  >
                    {x + 1}
                  </div>
                ))}
                {HOLE_LETTERS.map((letter, h) => (
                  <Fragment key={letter}>
                    <div className="flex items-center justify-end pr-1 text-[10px] text-stone-500 dark:text-stone-400">
                      {letter}
                    </div>
                    {draft.tablets.map((tb, x) => (
                      <div
                        key={x}
                        onMouseDown={(e) => {
                          if (e.button === 0) onHoleDown(x, h)
                        }}
                        className={`flex items-center justify-center ${tool === 'hole' ? 'cursor-pointer' : ''}`}
                        style={{ width: cell, height: cell }}
                      >
                        <div
                          className="rounded-full border border-stone-400 dark:border-stone-500"
                          style={{
                            width: cell * 0.7,
                            height: cell * 0.7,
                            backgroundColor: hexById.get(tb.holes[h]) ?? '#000000',
                          }}
                        />
                      </div>
                    ))}
                  </Fragment>
                ))}
                <div />
                {draft.tablets.map((tb, x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => onTwistClick(x)}
                    title={t('result', 'hintTwist')}
                    className="cursor-pointer text-center text-[11px] font-bold text-stone-700 hover:underline dark:text-stone-200"
                  >
                    {tb.twist === 'S' ? 'S /' : 'Z \\'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {showFabric && (
            <div className="panel w-72 shrink-0 p-3">
              <div className="field-label">{t('result', 'fabric')}</div>
              <div className="max-h-[calc(100vh-16rem)] overflow-auto">
                <FabricCanvas draft={draft} cell={8} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
