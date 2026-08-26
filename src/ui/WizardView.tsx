import { useEffect, useRef, useState, type DragEvent } from 'react'
import { FilePlus2, ImagePlus, Replace, Trash2, TriangleAlert, Wand2 } from 'lucide-react'
import type { GenerateMode, HexMatrix } from '../core/types'
import { colorHexMap, createEmptyDraft, makeColor, paletteFromHexes } from '../core/draft'
import { gridToHex, simulate } from '../core/simulator'
import { TABLET_PATTERNS, type TabletPattern } from '../core/patterns'
import { quantizeMatrix, rgbaToHexMatrix, suggestedRows, type QuantizeResult } from '../core/image'
import { generateThreadedin } from '../core/generate-threadedin'
import { generateFaithful } from '../core/generate-faithful'
import { useAppStore } from '../state/store'
import { t } from '../i18n/pl'

interface LoadedImage {
  url: string
  fileName: string
  width: number
  height: number
  el: HTMLImageElement
}

const TABLET_PRESETS = [8, 12, 16, 20, 24, 32]
const COLOR_COUNTS = [2, 3, 4, 5, 6, 7, 8]

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function MatrixCanvas({
  matrix,
  cell = 6,
  label,
}: {
  matrix: HexMatrix
  cell?: number
  label?: string
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
      style={{ imageRendering: 'pixelated' }}
      aria-label={label ?? t('wizard', 'quantizedPreview')}
    />
  )
}

function formatMeta(template: string, tablets: number, rows: number): string {
  return template.replace('{tablets}', String(tablets)).replace('{rows}', String(rows))
}

function PatternGallery({ onOpen }: { onOpen: (pattern: TabletPattern) => void }) {
  return (
    <section className="panel p-4 lg:col-span-2">
      <h2 className="text-sm font-semibold">{t('gallery', 'title')}</h2>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t('gallery', 'hint')}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TABLET_PATTERNS.map((pattern) => {
          const draft = pattern.build()
          const matrix = gridToHex(simulate(draft).grid, colorHexMap(draft))
          return (
            <button
              key={pattern.id}
              type="button"
              onClick={() => onOpen(pattern)}
              aria-label={`${t('gallery', 'open')}: ${pattern.name}`}
              title={pattern.description}
              className="cursor-pointer rounded-xl border border-stone-200 bg-white p-2.5 text-left transition-colors hover:border-otter-400 hover:bg-otter-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-otter-500 dark:hover:bg-otter-900/30"
            >
              <span className="flex items-center justify-center rounded-lg border border-stone-200 bg-stone-50 p-1.5 dark:border-stone-700 dark:bg-stone-800/50">
                <MatrixCanvas matrix={matrix} cell={4} label={pattern.name} />
              </span>
              <span className="mt-2 block truncate text-sm font-medium">{pattern.name}</span>
              <span className="mt-0.5 block text-xs tabular-nums text-stone-500 dark:text-stone-400">
                {formatMeta(t('gallery', 'meta'), draft.tablets.length, draft.rows.length)}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default function WizardView() {
  const setGenerated = useAppStore((s) => s.setGenerated)
  const newProject = useAppStore((s) => s.newProject)
  const hasGenerator = useAppStore((s) => s.generator !== null)
  const manualEdits = useAppStore((s) => s.manualEdits)

  const saved = useAppStore.getState().generator?.settings

  const [image, setImage] = useState<LoadedImage | null>(null)
  const [tablets, setTablets] = useState(saved?.tablets ?? 16)
  const [rows, setRows] = useState(saved?.rows ?? 32)
  const [colorCount, setColorCount] = useState(saved?.colorCount ?? 3)
  const [mode, setMode] = useState<GenerateMode>(saved?.mode ?? 'threadedin')
  const [reverseEvery, setReverseEvery] = useState(saved?.reverseEvery ?? 16)
  const [weftIndex, setWeftIndex] = useState<number | null>(saved?.weftIndex ?? null)
  const [quantized, setQuantized] = useState<QuantizeResult | null>(null)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const effTablets = clampNumber(Math.round(tablets) || 16, 4, 64)
  const effRows = clampNumber(Math.round(rows) || 32, 8, 240)
  const effReverseEvery = clampNumber(Math.round(reverseEvery) || 16, 4, 64)

  const applyTablets = (value: number) => {
    const clamped = clampNumber(Math.round(value) || 16, 4, 64)
    setTablets(clamped)
    if (image) setRows(suggestedRows(image.width, image.height, clamped))
  }

  const loadFile = (file: File | undefined | null) => {
    if (!file) return
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setLoadError(true)
      return
    }
    setLoadError(false)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        setImage({
          url: String(reader.result),
          fileName: file.name,
          width: img.naturalWidth,
          height: img.naturalHeight,
          el: img,
        })
        setRows(suggestedRows(img.naturalWidth, img.naturalHeight, effTablets))
      }
      img.onerror = () => setLoadError(true)
      img.src = String(reader.result)
    }
    reader.onerror = () => setLoadError(true)
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!image) {
      setQuantized(null)
      return
    }
    const timer = setTimeout(() => {
      const canvas = document.createElement('canvas')
      canvas.width = effTablets
      canvas.height = effRows
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(image.el, 0, 0, effTablets, effRows)
      const data = ctx.getImageData(0, 0, effTablets, effRows)
      setQuantized(quantizeMatrix(rgbaToHexMatrix(data.data, effTablets, effRows), colorCount))
    }, 150)
    return () => clearTimeout(timer)
  }, [image, effTablets, effRows, colorCount])

  useEffect(() => {
    if (!quantized) return
    setWeftIndex((idx) =>
      idx === null || idx >= quantized.paletteHex.length
        ? Math.min(1, quantized.paletteHex.length - 1)
        : idx,
    )
  }, [quantized])

  useEffect(() => {
    setConfirmOverwrite(false)
  }, [image, effTablets, effRows, colorCount, mode, effReverseEvery, weftIndex])

  const startFromScratch = () => {
    newProject(createEmptyDraft(t('wizard', 'scratchName'), 16, 32, makeColor('c0', '#b45309')))
  }

  const generate = () => {
    if (!image || !quantized || quantized.paletteHex.length === 0) return
    if (hasGenerator && manualEdits && !confirmOverwrite) {
      setConfirmOverwrite(true)
      return
    }
    setConfirmOverwrite(false)
    const palette = paletteFromHexes(quantized.paletteHex)
    const wIdx = weftIndex !== null && weftIndex < palette.length ? weftIndex : 0
    const weft = palette[wIdx]?.id ?? palette[0].id
    const name = image.fileName.replace(/\.[^.]+$/, '').trim() || t('wizard', 'defaultName')
    const draft =
      mode === 'threadedin'
        ? generateThreadedin(quantized.matrix, palette, name, {
            reverseEvery: effReverseEvery,
            weft,
          })
        : generateFaithful(quantized.matrix, palette, name, { weft }).draft
    setGenerated(draft, {
      settings: {
        tablets: effTablets,
        rows: effRows,
        colorCount,
        mode,
        reverseEvery: effReverseEvery,
        weftIndex: wIdx,
      },
      sourceMatrix: quantized.matrix,
    })
  }

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    loadFile(e.dataTransfer.files[0])
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
      <div className="flex flex-col gap-4">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold">{t('wizard', 'step1')}</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              loadFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {!image ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="mt-3 flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 px-4 py-8 text-center text-stone-500 transition-colors hover:border-otter-400 hover:text-otter-600 dark:border-stone-700 dark:text-stone-400 dark:hover:border-otter-500"
            >
              <ImagePlus size={28} aria-hidden />
              <span className="text-sm">{t('wizard', 'dropHint')}</span>
            </button>
          ) : (
            <div className="mt-3 flex gap-3">
              <img
                src={image.url}
                alt={image.fileName}
                className="h-20 w-20 shrink-0 rounded-lg border border-stone-200 object-cover dark:border-stone-700"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{image.fileName}</p>
                <p className="text-xs tabular-nums text-stone-500 dark:text-stone-400">
                  {image.width} × {image.height} px
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Replace size={15} aria-hidden />
                    {t('wizard', 'replaceImage')}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setImage(null)}>
                    <Trash2 size={15} aria-hidden />
                    {t('wizard', 'removeImage')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {loadError && (
            <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {t('wizard', 'invalidImage')}
            </p>
          )}
          <button type="button" className="btn-ghost mt-3 w-full" onClick={startFromScratch}>
            <FilePlus2 size={15} aria-hidden />
            {t('wizard', 'startFromScratch')}
          </button>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold">{t('wizard', 'step2')}</h2>

          <div className="mt-3">
            <span className="field-label">{t('wizard', 'tablets')}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {TABLET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyTablets(preset)}
                  aria-pressed={effTablets === preset}
                  className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs tabular-nums transition-colors ${
                    effTablets === preset
                      ? 'border-otter-500 bg-otter-50 text-otter-700 dark:border-otter-400 dark:bg-otter-900/40 dark:text-otter-300'
                      : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <input
                type="number"
                className="input-number ml-auto w-20"
                min={4}
                max={64}
                value={tablets}
                onChange={(e) => setTablets(Number(e.target.value))}
                onBlur={() => applyTablets(tablets)}
                aria-label={t('wizard', 'tablets')}
              />
            </div>
            {effTablets > 40 && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
                {t('wizard', 'tabletsWarning')}
              </p>
            )}
          </div>

          <label className="mt-4 block">
            <span className="field-label">{t('wizard', 'rows')}</span>
            <input
              type="number"
              className="input-number w-full"
              min={8}
              max={240}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              onBlur={() => setRows(clampNumber(Math.round(rows) || 32, 8, 240))}
            />
          </label>

          <label className="mt-4 block">
            <span className="field-label">{t('wizard', 'colorCount')}</span>
            <select
              className="w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              value={colorCount}
              onChange={(e) => setColorCount(Number(e.target.value))}
            >
              {COLOR_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="mt-4">
            <legend className="field-label">{t('wizard', 'mode')}</legend>
            <div className="grid gap-2">
              {(['threadedin', 'faithful'] as const).map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition-colors ${
                    mode === m
                      ? 'border-otter-500 bg-otter-50 dark:border-otter-400 dark:bg-otter-900/30'
                      : 'border-stone-200 bg-white hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="generate-mode"
                    className="mt-0.5 accent-otter-600"
                    checked={mode === m}
                    onChange={() => setMode(m)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {t('wizard', m === 'threadedin' ? 'modeThreadedin' : 'modeFaithful')}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">
                      {t('wizard', m === 'threadedin' ? 'modeThreadedinDesc' : 'modeFaithfulDesc')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {mode === 'faithful' && colorCount > 3 && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
              {t('wizard', 'manyColorsWarning')}
            </p>
          )}

          <label className="mt-4 block">
            <span className="field-label">{t('wizard', 'reverseEvery')}</span>
            <input
              type="number"
              className="input-number w-full disabled:cursor-not-allowed disabled:opacity-40"
              min={4}
              max={64}
              value={reverseEvery}
              disabled={mode !== 'threadedin'}
              onChange={(e) => setReverseEvery(Number(e.target.value))}
              onBlur={() => setReverseEvery(clampNumber(Math.round(reverseEvery) || 16, 4, 64))}
            />
          </label>

          <div className="mt-4">
            <span className="field-label">{t('wizard', 'weft')}</span>
            <div className="flex flex-wrap gap-1.5">
              {quantized ? (
                quantized.paletteHex.map((hex, i) => (
                  <button
                    key={`${hex}-${i}`}
                    type="button"
                    onClick={() => setWeftIndex(i)}
                    aria-label={`${t('wizard', 'weft')}: ${hex}`}
                    title={hex}
                    aria-pressed={weftIndex === i}
                    className={`h-7 w-7 cursor-pointer rounded-md border transition-transform hover:scale-110 ${
                      weftIndex === i
                        ? 'ring-2 ring-otter-500 ring-offset-1 dark:ring-offset-stone-900'
                        : 'border-stone-300 dark:border-stone-600'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))
              ) : (
                <span className="text-xs text-stone-400">—</span>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="text-sm font-semibold">{t('wizard', 'step3')}</h2>
        {image && quantized ? (
          <>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <figure className="min-w-0">
                <figcaption className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                  {t('wizard', 'originalPreview')}
                </figcaption>
                <div className="flex items-center justify-center rounded-lg border border-stone-200 bg-stone-50 p-2 dark:border-stone-700 dark:bg-stone-800/50">
                  <img
                    src={image.url}
                    alt={image.fileName}
                    className="max-h-[220px] w-auto max-w-full object-contain"
                  />
                </div>
              </figure>
              <figure className="min-w-0">
                <figcaption className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                  {t('wizard', 'quantizedPreview')}
                </figcaption>
                <div className="flex items-center justify-center rounded-lg border border-stone-200 bg-stone-50 p-2 dark:border-stone-700 dark:bg-stone-800/50">
                  <MatrixCanvas matrix={quantized.matrix} cell={6} />
                </div>
              </figure>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {quantized.paletteHex.map((hex, i) => (
                <span
                  key={`${hex}-sw-${i}`}
                  className="h-5 w-5 rounded-md border border-stone-300 dark:border-stone-600"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-3 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">
            {t('wizard', 'noImageHint')}
          </div>
        )}
        <button
          type="button"
          onClick={generate}
          disabled={!image || !quantized}
          className={`btn mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40 ${
            confirmOverwrite
              ? 'bg-amber-600 px-3 text-xs leading-snug text-white hover:bg-amber-700'
              : 'bg-otter-600 text-white hover:bg-otter-700'
          }`}
        >
          {confirmOverwrite ? (
            <TriangleAlert size={16} aria-hidden />
          ) : (
            <Wand2 size={16} aria-hidden />
          )}
          {confirmOverwrite ? t('result', 'overwriteWarning') : t('wizard', 'generate')}
        </button>
      </section>

      <PatternGallery onOpen={(pattern) => newProject(pattern.build())} />
    </div>
  )
}
