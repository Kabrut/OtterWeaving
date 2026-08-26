import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Eye, EyeOff, Minus, Plus, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import type { InklePass, InkleWarpThread } from '../core/inkle'
import { computeInkleMetrics, validateInkleDraft } from '../core/inkle'
import type { HexMatrix } from '../core/types'
import { useAppStore } from '../state/store'
import { t } from '../i18n/pl'
import { InkleFabricCanvas } from './common/InkleFabricCanvas'

function MatrixCanvas({
  matrix,
  cell = 6,
  label,
  style,
}: {
  matrix: HexMatrix
  cell?: number
  label?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const h = matrix.length
    const w = matrix[0]?.length ?? 0
    if (w === 0 || h === 0) return
    canvas.width = w * cell
    canvas.height = h * cell
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = matrix[y][x]
        ctx.fillRect(x * cell, y * cell, cell, cell)
      }
    }
  }, [matrix, cell])
  return (
    <canvas
      ref={ref}
      className="max-w-full"
      style={{ imageRendering: 'pixelated', ...style }}
      aria-label={label ?? t('inkle', 'quantizedPreview')}
    />
  )
}

function PickupBackdrop({
  matrix,
  cell,
  patternPairs,
}: {
  matrix: HexMatrix
  cell: number
  patternPairs: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const h = matrix.length
    const w = matrix[0]?.length ?? 0
    if (w === 0 || h === 0 || patternPairs <= 0) return
    const block = cell * 2
    canvas.width = w * block
    canvas.height = h * block
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = matrix[y][x]
        ctx.fillRect(x * block, y * block, block, block)
      }
    }
  }, [matrix, cell, patternPairs])
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute opacity-40"
      style={{
        imageRendering: 'pixelated',
        left: `calc(2.5rem + ${cell * 2}px)`,
        top: '1rem',
      }}
    />
  )
}

interface InklePassRowProps {
  row: number
  up: boolean
  picks: boolean[]
  warp: InkleWarpThread[]
  hexById: Map<string, string>
  cell: number
  translucent: boolean
  onCellDown: (row: number, col: number) => void
  onCellEnter: (row: number, col: number) => void
  onHeaderDown: (row: number) => void
}

const InklePassRow = memo(function InklePassRow({
  row,
  up,
  picks,
  warp,
  hexById,
  cell,
  translucent,
  onCellDown,
  onCellEnter,
  onHeaderDown,
}: InklePassRowProps) {
  return (
    <>
      <div
        onMouseDown={(e) => {
          if (e.button === 0) onHeaderDown(row)
        }}
        title={t('inkle', 'clearPass')}
        className="flex cursor-pointer items-center justify-end gap-1 pr-1.5 text-xs tabular-nums text-stone-500 dark:text-stone-400"
      >
        <span>{row + 1}</span>
        <span aria-hidden title={up ? t('inkle', 'up') : t('inkle', 'down')}>
          {up ? '▲' : '▼'}
        </span>
      </div>
      {picks.map((picked, col) => {
        const thread = warp[col]
        const visible = up ? thread.heddled : !thread.heddled
        const bg = picked
          ? translucent
            ? 'bg-otter-100/70 dark:bg-otter-900/40'
            : 'bg-otter-100 dark:bg-otter-900/50'
          : visible
            ? translucent
              ? 'bg-stone-200/60 dark:bg-stone-700/60'
              : 'bg-stone-200 dark:bg-stone-700'
            : translucent
              ? 'bg-white/60 dark:bg-stone-900/60'
              : 'bg-white dark:bg-stone-900'
        return (
          <div
            key={col}
            onMouseDown={(e) => {
              if (e.button === 0) onCellDown(row, col)
            }}
            onMouseEnter={() => onCellEnter(row, col)}
            className={`flex cursor-pointer items-center justify-center border border-stone-200 dark:border-stone-700 ${bg}`}
            style={{ width: cell, height: cell }}
          >
            {picked && (
              <span
                className="rounded-full border border-black/20"
                style={{
                  width: cell * 0.5,
                  height: cell * 0.5,
                  backgroundColor: hexById.get(thread.colorId) ?? '#000000',
                }}
              />
            )}
          </div>
        )
      })}
    </>
  )
})

export default function InkleEditorView() {
  const draft = useAppStore((s) => s.inkleDraft)
  const canUndo = useAppStore((s) => s.inklePast.length > 0)
  const canRedo = useAppStore((s) => s.inkleFuture.length > 0)
  const editInkle = useAppStore((s) => s.editInkle)
  const undoInkle = useAppStore((s) => s.undoInkle)
  const redoInkle = useAppStore((s) => s.redoInkle)
  const inkleSource = useAppStore((s) => s.inkleSource)
  const [cell, setCell] = useState(18)
  const [showPhoto, setShowPhoto] = useState(true)
  const paintRef = useRef<boolean | null>(null)

  const hexById = useMemo(
    () => (draft ? new Map(draft.palette.map((c) => [c.id, c.hex])) : new Map<string, string>()),
    [draft],
  )
  const metrics = useMemo(() => (draft ? computeInkleMetrics(draft) : null), [draft])
  const errors = useMemo(() => (draft ? validateInkleDraft(draft) : []), [draft])

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
        useAppStore.getState().undoInkle()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        useAppStore.getState().redoInkle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const applyPick = useCallback((row: number, col: number, value: boolean) => {
    useAppStore.getState().editInkle((d) => {
      d.passes[row].picks[col] = value
    })
  }, [])

  const onCellDown = useCallback(
    (row: number, col: number) => {
      const { inkleDraft } = useAppStore.getState()
      if (!inkleDraft) return
      const value = !inkleDraft.passes[row].picks[col]
      paintRef.current = value
      applyPick(row, col, value)
    },
    [applyPick],
  )

  const onCellEnter = useCallback(
    (row: number, col: number) => {
      const value = paintRef.current
      if (value === null) return
      const { inkleDraft } = useAppStore.getState()
      if (!inkleDraft || inkleDraft.passes[row].picks[col] === value) return
      applyPick(row, col, value)
    },
    [applyPick],
  )

  const onHeaderDown = useCallback((row: number) => {
    useAppStore.getState().editInkle((d) => {
      d.passes[row].picks = d.passes[row].picks.map(() => false)
    })
  }, [])

  const cycleWarpColor = (i: number) => {
    editInkle((d) => {
      if (d.palette.length === 0) return
      const idx = d.palette.findIndex((c) => c.id === d.warp[i].colorId)
      d.warp[i].colorId = d.palette[(idx + 1) % d.palette.length].id
    })
  }

  const toggleHeddled = (i: number) =>
    editInkle((d) => {
      d.warp[i].heddled = !d.warp[i].heddled
    })

  const addPass = () =>
    editInkle((d) => {
      const last = d.passes[d.passes.length - 1]
      d.passes.push({ up: last.up, picks: [...last.picks] })
    })

  const removePass = () =>
    editInkle((d) => {
      if (d.passes.length > 2) d.passes.pop()
    })

  const addPair = () =>
    editInkle((d) => {
      if (d.warp.length < 6) return
      const at = d.warp.length - 2
      d.warp.splice(
        at,
        0,
        { colorId: d.warp[at - 2].colorId, heddled: true, pattern: false },
        { colorId: d.warp[at - 1].colorId, heddled: false, pattern: true },
      )
      for (const pass of d.passes) {
        pass.picks.splice(at, 0, false, false)
      }
    })

  const removePair = () =>
    editInkle((d) => {
      if (d.warp.length <= 6) return
      const at = d.warp.length - 4
      d.warp.splice(at, 2)
      for (const pass of d.passes) {
        pass.picks.splice(at, 2)
      }
    })

  const zoom = (delta: number) => setCell((c) => Math.min(32, Math.max(12, c + delta)))

  const warpCount = draft?.warp.length ?? 0
  const passesCount = draft?.passes.length ?? 0
  const patternPairs = Math.max(0, Math.floor((warpCount - 4) / 2))
  const backdropMatrix = useMemo(() => {
    const m = inkleSource?.matrix
    if (!draft || !m || m.length === 0 || patternPairs <= 0) return null
    const cols = Math.min(m[0]?.length ?? 0, patternPairs)
    const rows = Math.min(m.length, Math.floor(draft.passes.length / 2))
    if (cols <= 0 || rows <= 0) return null
    return m.slice(0, rows).map((row) => row.slice(0, cols))
  }, [draft, inkleSource, patternPairs])
  const backdropOn = showPhoto && backdropMatrix !== null

  return (
    <div className="no-print flex flex-col gap-4">
      <div className="panel flex flex-wrap items-center gap-1.5 p-2">
        <input
          type="text"
          value={draft?.name ?? ''}
          disabled={!draft}
          onChange={(e) =>
            editInkle((d) => {
              d.name = e.target.value
            })
          }
          aria-label={t('inkle', 'draftName')}
          placeholder={t('inkle', 'draftName')}
          className="w-44 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-800"
        />
        <span className="mx-1 h-5 w-px bg-stone-200 dark:bg-stone-700" />
        <button
          type="button"
          className="btn-ghost"
          title={t('inkle', 'undo')}
          aria-label={t('inkle', 'undo')}
          disabled={!canUndo}
          onClick={undoInkle}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className="btn-ghost"
          title={t('inkle', 'redo')}
          aria-label={t('inkle', 'redo')}
          disabled={!canRedo}
          onClick={redoInkle}
        >
          <Redo2 size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-stone-200 dark:bg-stone-700" />
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={addPass}
          disabled={!draft}
          title={t('inkle', 'addPass')}
        >
          <Plus size={14} /> {t('inkle', 'addPass')}
        </button>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={removePass}
          disabled={!draft || passesCount <= 2}
          title={t('inkle', 'removePass')}
        >
          <Minus size={14} /> {t('inkle', 'removePass')}
        </button>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={addPair}
          disabled={!draft || warpCount < 6}
          title={t('inkle', 'addPair')}
        >
          <Plus size={14} /> {t('inkle', 'addPair')}
        </button>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={removePair}
          disabled={!draft || warpCount <= 6}
          title={t('inkle', 'removePair')}
        >
          <Minus size={14} /> {t('inkle', 'removePair')}
        </button>
        <span className="mx-1 h-5 w-px bg-stone-200 dark:bg-stone-700" />
        <span className="px-1 text-xs tabular-nums text-stone-500 dark:text-stone-400">
          {passesCount} × {warpCount}
        </span>
        <button
          type="button"
          className="btn-ghost"
          title={t('inkle', 'zoomOut')}
          aria-label={t('inkle', 'zoomOut')}
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
          title={t('inkle', 'zoomIn')}
          aria-label={t('inkle', 'zoomIn')}
          disabled={cell >= 32}
          onClick={() => zoom(2)}
        >
          <ZoomIn size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-stone-200 dark:bg-stone-700" />
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          disabled={!backdropMatrix}
          onClick={() => setShowPhoto((v) => !v)}
        >
          {backdropOn ? <EyeOff size={14} /> : <Eye size={14} />}
          {backdropOn ? t('inkle', 'hidePhoto') : t('inkle', 'showPhoto')}
        </button>
      </div>

      <div className="flex items-start gap-4">
        <div className="panel min-w-0 flex-1 p-4">
          {draft ? (
            <div className="max-h-[calc(100vh-13rem)] overflow-auto">
              <div className="field-label">{t('inkle', 'threading')}</div>
              <div
                className="grid w-fit"
                style={{ gridTemplateColumns: `repeat(${warpCount}, ${cell}px)` }}
              >
                {draft.warp.map((_, i) => (
                  <div
                    key={i}
                    className="text-center text-[10px] tabular-nums text-stone-500 dark:text-stone-400"
                  >
                    {i + 1}
                  </div>
                ))}
                {draft.warp.map((thread, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => cycleWarpColor(i)}
                      title={`${thread.pattern ? t('inkle', 'nitkaWzorcowa') : t('inkle', 'color')} · ${hexById.get(thread.colorId) ?? ''}`}
                      aria-label={`${t('inkle', 'color')} ${i + 1}`}
                      className={`cursor-pointer rounded-full border border-stone-400 dark:border-stone-500 ${
                        thread.pattern
                          ? 'ring-2 ring-amber-500 ring-offset-1 dark:ring-offset-stone-900'
                          : ''
                      }`}
                      style={{
                        width: cell * 0.7,
                        height: cell * 0.7,
                        backgroundColor: hexById.get(thread.colorId) ?? '#000000',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => toggleHeddled(i)}
                      title={thread.heddled ? t('inkle', 'oczko') : t('inkle', 'prześwit')}
                      className={`w-full cursor-pointer rounded text-center text-[10px] font-bold leading-4 ${
                        thread.heddled
                          ? 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200'
                          : 'bg-white text-stone-500 dark:bg-stone-900 dark:text-stone-400'
                      }`}
                    >
                      {thread.heddled ? 'O' : 'P'}
                    </button>
                  </div>
                ))}
              </div>

              <div className="field-label mt-6">{t('inkle', 'pickup')}</div>
              <div className="relative w-fit">
                {backdropOn && backdropMatrix && (
                  <PickupBackdrop matrix={backdropMatrix} cell={cell} patternPairs={patternPairs} />
                )}
                <div
                  className="relative z-10 grid w-fit"
                  style={{ gridTemplateColumns: `2.5rem repeat(${warpCount}, ${cell}px)` }}
                >
                  <div className="h-4" />
                  {draft.warp.map((_, x) => (
                    <div
                      key={x}
                      className="h-4 text-center text-[10px] leading-none tabular-nums text-stone-500 dark:text-stone-400"
                    >
                      {x + 1}
                    </div>
                  ))}
                  {draft.passes.map((pass: InklePass, y) => (
                    <InklePassRow
                      key={y}
                      row={y}
                      up={pass.up}
                      picks={pass.picks}
                      warp={draft.warp}
                      hexById={hexById}
                      cell={cell}
                      translucent={backdropOn}
                      onCellDown={onCellDown}
                      onCellEnter={onCellEnter}
                      onHeaderDown={onHeaderDown}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
                {t('inkle', 'hintPaint')}
              </p>

              <div className="mt-5">
                <span className="field-label">{t('inkle', 'weft')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {draft.palette.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        editInkle((d) => {
                          d.weft = c.id
                        })
                      }
                      aria-label={`${t('inkle', 'weft')}: ${c.name || c.hex}`}
                      title={c.hex}
                      aria-pressed={draft.weft === c.id}
                      className={`h-7 w-7 cursor-pointer rounded-md border transition-transform hover:scale-110 ${
                        draft.weft === c.id
                          ? 'ring-2 ring-otter-500 ring-offset-1 dark:ring-offset-stone-900'
                          : 'border-stone-300 dark:border-stone-600'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">
              {t('inkle', 'emptyHint')}
            </div>
          )}
        </div>

        {draft && (
          <div className="panel w-72 shrink-0 p-3">
            <div className="field-label">{t('inkle', 'fabric')}</div>
            <div className="max-h-[calc(100vh-16rem)] overflow-auto">
              <InkleFabricCanvas draft={draft} cell={8} />
            </div>
            {metrics && (
              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500 dark:text-stone-400">
                    {t('inkle', 'metricsWidth')}
                  </dt>
                  <dd className="tabular-nums font-medium">{metrics.bandWidthCm} cm</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500 dark:text-stone-400">
                    {t('inkle', 'metricsWovenLength')}
                  </dt>
                  <dd className="tabular-nums font-medium">{metrics.wovenLengthCm} cm</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500 dark:text-stone-400">
                    {t('inkle', 'metricsThreads')}
                  </dt>
                  <dd className="tabular-nums font-medium">{metrics.warpCount}</dd>
                </div>
              </dl>
            )}
            {errors.length > 0 && (
              <div className="mt-3 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <p className="font-semibold">{t('inkle', 'validation')}</p>
                <ul className="mt-1 list-disc pl-4">
                  {errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {inkleSource && (
        <div className="panel space-y-2.5 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="field-label">{t('inkle', 'sourceImage')}</span>
            <span className="min-w-0 truncate text-xs text-stone-500 dark:text-stone-400">
              {inkleSource.fileName}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <figure className="min-w-0">
              <figcaption className="mb-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
                {t('inkle', 'originalPreview')}
              </figcaption>
              <img
                src={inkleSource.url}
                alt={inkleSource.fileName}
                className="mx-auto max-h-44 w-auto max-w-full rounded-lg border border-stone-200 object-contain dark:border-stone-700"
              />
            </figure>
            {inkleSource.matrix && (
              <figure className="min-w-0">
                <figcaption className="mb-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
                  {t('inkle', 'quantizedPreview')}
                </figcaption>
                <MatrixCanvas
                  matrix={inkleSource.matrix}
                  cell={8}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 176,
                    width: 'auto',
                    height: 'auto',
                  }}
                />
              </figure>
            )}
          </div>
          <p className="text-[11px] leading-snug text-stone-500 dark:text-stone-400">
            {t('inkle', 'sourceHint')}
          </p>
        </div>
      )}
    </div>
  )
}
