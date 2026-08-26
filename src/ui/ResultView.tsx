import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  SquarePen,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import type { Draft, Turn } from '../core/types'
import { HOLE_LETTERS } from '../core/types'
import { colorHexMap } from '../core/draft'
import { matrixMismatch } from '../core/image'
import { gridToHex, simulate } from '../core/simulator'
import { useAppStore } from '../state/store'
import { t } from '../i18n/pl'
import { FabricCanvas } from './common/FabricCanvas'
import { Palette } from './common/Palette'

interface TurnRowProps {
  row: Draft['rows'][number]
  rowIndex: number
  prevTurns: readonly Turn[] | null
  weftHex: string
  onToggleTurn: (rowIndex: number, x: number) => void
  onCycleWeft: (rowIndex: number) => void
}

const TurnRow = memo(function TurnRow({
  row,
  rowIndex,
  prevTurns,
  weftHex,
  onToggleTurn,
  onCycleWeft,
}: TurnRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-stone-100 dark:hover:bg-stone-800/70">
      <button
        type="button"
        onClick={() => onCycleWeft(rowIndex)}
        aria-label={`${t('result', 'weftColor')} ${rowIndex + 1}`}
        title={`${t('result', 'weftColor')} ${rowIndex + 1}`}
        className={`flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-xs tabular-nums ${
          rowIndex === 0
            ? 'font-bold text-stone-800 dark:text-stone-100'
            : 'text-stone-500 dark:text-stone-400'
        }`}
      >
        <span className="w-7 text-right">{rowIndex + 1}</span>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full border border-stone-300 dark:border-stone-600"
          style={{ backgroundColor: weftHex }}
        />
      </button>
      <div className="flex gap-px">
        {row.turns.map((turn, x) => {
          const reversal = prevTurns !== null && prevTurns[x] !== turn
          const label = `${t('result', turn === 'F' ? 'turnF' : 'turnB')} ${rowIndex + 1}-${x + 1}`
          return (
            <button
              key={x}
              type="button"
              onClick={() => onToggleTurn(rowIndex, x)}
              aria-label={label}
              title={label}
              className={`flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded border bg-white transition-colors hover:bg-otter-50 dark:bg-stone-800 dark:hover:bg-stone-700 ${
                reversal
                  ? 'border-red-500 border-b-[3px] dark:border-red-400'
                  : 'border-stone-200 dark:border-stone-700'
              }`}
            >
              {turn === 'F' ? (
                <RotateCw size={13} className="text-stone-600 dark:text-stone-300" aria-hidden />
              ) : (
                <RotateCcw size={13} className="text-stone-600 dark:text-stone-300" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
})

interface TabletColProps {
  tablet: Draft['tablets'][number]
  x: number
  hexById: Map<string, string>
  onSetHole: (x: number, hole: number) => void
  onToggleTwist: (x: number) => void
}

const TabletCol = memo(function TabletCol({
  tablet,
  x,
  hexById,
  onSetHole,
  onToggleTwist,
}: TabletColProps) {
  return (
    <div className="flex w-10 shrink-0 flex-col items-center gap-1">
      {tablet.holes.map((hole, h) => {
        const label = `${t('result', 'holeColor')} ${HOLE_LETTERS[h]}${x + 1}`
        return (
          <button
            key={h}
            type="button"
            onClick={() => onSetHole(x, h)}
            aria-label={label}
            title={label}
            className="h-6 w-6 cursor-pointer rounded-full border-2 border-stone-300 transition-transform hover:scale-110 dark:border-stone-600"
            style={{ backgroundColor: hexById.get(hole) ?? '#000000' }}
          />
        )
      })}
      <button
        type="button"
        onClick={() => onToggleTwist(x)}
        aria-label={`${t('result', 'toggleTwist')} ${x + 1}`}
        title={`${t('result', 'toggleTwist')} ${x + 1}`}
        className={`cursor-pointer rounded-md border px-2 py-0.5 text-xs font-bold ${
          tablet.twist === 'S'
            ? 'border-otter-500 bg-otter-50 text-otter-700 dark:border-otter-400 dark:bg-otter-900/40 dark:text-otter-300'
            : 'border-stone-300 bg-white text-stone-600 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300'
        }`}
      >
        {tablet.twist}
      </button>
      <span className="text-[10px] tabular-nums text-stone-400">{x + 1}</span>
    </div>
  )
})

export default function ResultView() {
  const draft = useAppStore((s) => s.draft)
  const generator = useAppStore((s) => s.generator)
  const manualEdits = useAppStore((s) => s.manualEdits)
  const lastColorId = useAppStore((s) => s.lastColorId)
  const setTab = useAppStore((s) => s.setTab)
  const setLastColor = useAppStore((s) => s.setLastColor)
  const editDraft = useAppStore((s) => s.editDraft)
  const undo = useAppStore((s) => s.undo)
  const redo = useAppStore((s) => s.redo)
  const canUndo = useAppStore((s) => s.past.length > 0)
  const canRedo = useAppStore((s) => s.future.length > 0)
  const [warned, setWarned] = useState(false)

  const simHex = useMemo(() => {
    if (!draft) return null
    return gridToHex(simulate(draft).grid, colorHexMap(draft))
  }, [draft])

  const hexById = useMemo(() => (draft ? colorHexMap(draft) : null), [draft])

  const diff = useMemo(() => {
    if (!simHex || !generator?.sourceMatrix) return null
    return matrixMismatch(simHex, generator.sourceMatrix)
  }, [simHex, generator])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const toggleTurn = useCallback(
    (r: number, x: number) => {
      editDraft((d) => {
        d.rows[r].turns[x] = d.rows[r].turns[x] === 'F' ? 'B' : 'F'
      })
    },
    [editDraft],
  )

  const cycleWeft = useCallback(
    (r: number) => {
      editDraft((d) => {
        const idx = d.palette.findIndex((c) => c.id === d.rows[r].weft)
        const next = d.palette[(idx + 1) % d.palette.length]
        if (next) d.rows[r].weft = next.id
      })
    },
    [editDraft],
  )

  const setHole = useCallback(
    (x: number, h: number) => {
      editDraft((d) => {
        const valid = lastColorId !== null && d.palette.some((c) => c.id === lastColorId)
        const target = valid ? lastColorId : (d.palette[0]?.id ?? null)
        if (target) d.tablets[x].holes[h] = target
      })
    },
    [editDraft, lastColorId],
  )

  const toggleTwist = useCallback(
    (x: number) => {
      editDraft((d) => {
        d.tablets[x].twist = d.tablets[x].twist === 'S' ? 'Z' : 'S'
        d.rows.forEach((row) => {
          row.turns[x] = row.turns[x] === 'F' ? 'B' : 'F'
        })
      })
    },
    [editDraft],
  )

  if (!draft || !hexById) return null

  const onRegenerate = () => {
    if (manualEdits && !warned) {
      setWarned(true)
      return
    }
    setWarned(false)
    setTab('wizard')
  }

  const cell = Math.max(6, Math.min(20, Math.floor(400 / draft.tablets.length)))
  const lastColor = draft.palette.find((c) => c.id === lastColorId) ?? null
  const showWarn = manualEdits && warned

  return (
    <div className="flex flex-col gap-6" onClick={() => setWarned(false)}>
      <header className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-lg font-bold">{draft.name}</h2>
        {diff !== null ? (
          <span
            className="rounded-full bg-otter-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-otter-700 dark:bg-otter-900/40 dark:text-otter-300"
            title={t('result', 'diff')}
          >
            {t('result', 'diff')}: {Math.round(diff * 100)}%
          </span>
        ) : (
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
            {t('result', 'diffDisabled')}
          </span>
        )}
        {manualEdits && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {t('result', 'manualEdits')}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="btn-secondary"
            onClick={undo}
            disabled={!canUndo}
            aria-label={t('result', 'undo')}
            title={t('result', 'undo')}
          >
            <Undo2 size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={redo}
            disabled={!canRedo}
            aria-label={t('result', 'redo')}
            title={t('result', 'redo')}
          >
            <Redo2 size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRegenerate()
            }}
            className={showWarn ? 'btn bg-amber-600 text-xs text-white hover:bg-amber-700' : 'btn-secondary'}
            title={showWarn ? t('result', 'overwriteWarning') : t('result', 'regenerate')}
          >
            {showWarn ? <TriangleAlert size={15} aria-hidden /> : <RefreshCw size={15} aria-hidden />}
            {showWarn ? t('result', 'overwriteWarning') : t('result', 'regenerate')}
          </button>
          <button type="button" className="btn-primary" onClick={() => setTab('editor')}>
            <SquarePen size={15} aria-hidden />
            {t('result', 'openInEditor')}
          </button>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="panel p-4">
          <h3 className="text-sm font-semibold">{t('result', 'fabric')}</h3>
          <div className="mt-3 flex max-h-[32rem] justify-center overflow-auto rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-800/50">
            <FabricCanvas draft={draft} cell={cell} />
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="panel p-4">
            <h3 className="text-sm font-semibold">{t('result', 'palette')}</h3>
            <div className="mt-3">
              <Palette
                palette={draft.palette}
                selectedId={lastColorId}
                onSelect={setLastColor}
                size="sm"
              />
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              {t('result', 'lastColor')}:
              {lastColor ? (
                <>
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-stone-300 dark:border-stone-600"
                    style={{ backgroundColor: lastColor.hex }}
                  />
                  <span className="font-medium text-stone-700 dark:text-stone-200">
                    {lastColor.name || lastColor.hex}
                  </span>
                </>
              ) : (
                <span>—</span>
              )}
            </p>
          </section>

          <div className="panel p-4">
            <ul className="grid gap-1.5 text-xs text-stone-500 sm:grid-cols-2 dark:text-stone-400">
              {[
                t('result', 'hintFb'),
                t('result', 'hintHole'),
                t('result', 'hintTwist'),
                t('result', 'hintWeft'),
              ].map((hint) => (
                <li key={hint} className="flex items-start gap-1.5">
                  <span
                    className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-stone-400"
                    aria-hidden
                  />
                  {hint}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <section className="panel p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold">{t('result', 'turning')}</h3>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            <span className="font-bold text-stone-700 dark:text-stone-200">1</span> —{' '}
            {t('result', 'start')}
          </span>
        </div>
        <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-stone-200 p-2 dark:border-stone-700">
          <div className="flex flex-col gap-1">
            {draft.rows.map((row, r) => (
              <TurnRow
                key={r}
                row={row}
                rowIndex={r}
                prevTurns={r > 0 ? draft.rows[r - 1].turns : null}
                weftHex={hexById.get(row.weft) ?? '#000000'}
                onToggleTurn={toggleTurn}
                onCycleWeft={cycleWeft}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <h3 className="text-sm font-semibold">{t('result', 'threading')}</h3>
        <div className="mt-3 overflow-x-auto pb-2">
          <div className="flex gap-3">
            <div className="flex w-10 shrink-0 flex-col items-center gap-1" aria-hidden>
              {HOLE_LETTERS.map((letter) => (
                <span
                  key={letter}
                  className="flex h-6 items-center text-[10px] font-semibold text-stone-400"
                >
                  {letter}
                </span>
              ))}
              <span className="h-10" />
            </div>
            <div className="flex gap-1.5">
              {draft.tablets.map((tablet, x) => (
                <TabletCol
                  key={x}
                  tablet={tablet}
                  x={x}
                  hexById={hexById}
                  onSetHole={setHole}
                  onToggleTwist={toggleTwist}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
