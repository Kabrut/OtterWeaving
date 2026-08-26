import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { ImagePlus, Plus, Replace, Trash2, TriangleAlert, Wand2 } from 'lucide-react'
import type { InkleDraft, InkleWarpThread } from '../core/inkle'
import { plainPasses, validateInkleDraft } from '../core/inkle'
import type { InklePattern } from '../core/inkle-patterns'
import { INKLE_PATTERNS, inkleDraftFromChart } from '../core/inkle-patterns'
import { paletteFromHexes } from '../core/draft'
import { dominantGround, generateInkleFromMatrix } from '../core/generate-inkle'
import { quantizeMatrix, rgbaToHexMatrix, suggestedRows, type QuantizeResult } from '../core/image'
import type { HexMatrix } from '../core/types'
import { useAppStore } from '../state/store'
import { t } from '../i18n/pl'
import { InkleFabricCanvas } from './common/InkleFabricCanvas'
import { PhotoEditor } from './common/PhotoEditor'

function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

interface LoadedImage {
  url: string
  fileName: string
  width: number
  height: number
  el: HTMLImageElement
}

const PHOTO_THREAD_PRESETS = [7, 9, 11, 13, 15, 19, 23]
const PHOTO_COLOR_COUNTS = [2, 3, 4, 5, 6]
const PHOTO_PATTERN_COLOR_COUNTS = [1, 2, 3]

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

function InkleGallery({
  repeats,
  onOpen,
}: {
  repeats: number
  onOpen: (pattern: InklePattern) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {INKLE_PATTERNS.map((pattern) => {
        const preview = inkleDraftFromChart(pattern, 2)
        const target = inkleDraftFromChart(pattern, repeats)
        const previewCell = Math.max(2, Math.min(4, Math.floor(96 / preview.warp.length)))
        return (
          <button
            key={pattern.id}
            type="button"
            onClick={() => onOpen(pattern)}
            aria-label={`${t('inkle', 'open')}: ${pattern.name}`}
            title={pattern.description}
            className="cursor-pointer rounded-xl border border-stone-200 bg-white p-2 text-left transition-colors hover:border-otter-400 hover:bg-otter-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-otter-500 dark:hover:bg-otter-900/30"
          >
            <span className="flex items-center justify-center rounded-lg border border-stone-200 bg-stone-50 p-1.5 dark:border-stone-700 dark:bg-stone-800/50">
              <InkleFabricCanvas
                draft={preview}
                cell={previewCell}
                className="max-w-full [image-rendering:pixelated]"
              />
            </span>
            <span className="mt-1.5 block truncate text-xs font-medium">{pattern.name}</span>
            <span className="mt-0.5 block text-[11px] tabular-nums text-stone-500 dark:text-stone-400">
              {fmt(t('inkle', 'meta'), {
                warpCount: target.warp.length,
                passes: target.passes.length,
              })}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function InkleWizardView() {
  const setInkle = useAppStore((s) => s.setInkle)
  const hasInkle = useAppStore((s) => s.inkleDraft !== null)
  const [repeats, setRepeats] = useState(3)
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [threads, setThreads] = useState(9)
  const [rows, setRows] = useState(24)
  const [colorCount, setColorCount] = useState(3)
  const [patternColorCount, setPatternColorCount] = useState(1)
  const [groundMode, setGroundMode] = useState<'auto' | 'custom'>('auto')
  const [groundCustom, setGroundCustom] = useState('#ffffff')
  const [borderHex, setBorderHex] = useState('#1c1917')
  const [photoWeftHex, setPhotoWeftHex] = useState('#1c1917')
  const [quantized, setQuantized] = useState<QuantizeResult | null>(null)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const effThreads = clampNumber(Math.round(threads) || 9, 3, 39)
  const effRows = clampNumber(Math.round(rows) || 24, 8, 120)

  const applyThreads = (value: number) => {
    const clamped = clampNumber(Math.round(value) || 9, 3, 39)
    setThreads(clamped)
    if (image) setRows(clampNumber(suggestedRows(image.width, image.height, clamped), 8, 120))
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
        setRows(clampNumber(suggestedRows(img.naturalWidth, img.naturalHeight, effThreads), 8, 120))
      }
      img.onerror = () => setLoadError(true)
      img.src = String(reader.result)
    }
    reader.onerror = () => setLoadError(true)
    reader.readAsDataURL(file)
  }

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    loadFile(e.dataTransfer.files[0])
  }

  const removeImage = () => {
    setImage(null)
    useAppStore.getState().setInkleSource(null)
  }

  useEffect(() => {
    if (!image) {
      setQuantized(null)
      return
    }
    const timer = setTimeout(() => {
      const canvas = document.createElement('canvas')
      canvas.width = effThreads
      canvas.height = effRows
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(image.el, 0, 0, effThreads, effRows)
      const data = ctx.getImageData(0, 0, effThreads, effRows)
      const result = quantizeMatrix(rgbaToHexMatrix(data.data, effThreads, effRows), colorCount)
      setQuantized(result)
      useAppStore.getState().setInkleSource({
        url: image.url,
        fileName: image.fileName,
        matrix: result.matrix,
      })
    }, 150)
    return () => clearTimeout(timer)
  }, [image, effThreads, effRows, colorCount])

  const autoGround = useMemo(() => (quantized ? dominantGround(quantized.matrix) : ''), [quantized])

  useEffect(() => {
    setConfirmOverwrite(false)
  }, [
    image,
    effThreads,
    effRows,
    colorCount,
    patternColorCount,
    groundMode,
    groundCustom,
    borderHex,
    photoWeftHex,
  ])

  const generatePhoto = () => {
    if (!image || !quantized || quantized.paletteHex.length === 0) return
    if (hasInkle && !confirmOverwrite) {
      setConfirmOverwrite(true)
      return
    }
    setConfirmOverwrite(false)
    const ground = groundMode === 'auto' ? dominantGround(quantized.matrix) : groundCustom
    if (!ground) return
    const name = image.fileName.replace(/\.[^.]+$/, '').trim() || t('inkle', 'fromPhotoName')
    const generated = generateInkleFromMatrix(quantized.matrix, {
      name,
      groundHex: ground,
      borderHex,
      weftHex: photoWeftHex,
      patternColorCount,
    })
    if (validateInkleDraft(generated).length === 0) setInkle(generated)
  }

  const newPlainWarp = () => {
    const palette = paletteFromHexes(['#1c1917', '#f5f0e6'])
    const border = palette[0].id
    const ground = palette[1].id
    const warp: InkleWarpThread[] = [
      { colorId: border, heddled: true, pattern: false },
      { colorId: border, heddled: false, pattern: false },
    ]
    for (let i = 0; i < 8; i++) {
      warp.push({ colorId: ground, heddled: true, pattern: false })
      warp.push({ colorId: ground, heddled: false, pattern: false })
    }
    warp.push({ colorId: border, heddled: false, pattern: false })
    warp.push({ colorId: border, heddled: true, pattern: false })
    const fresh: InkleDraft = {
      version: 1,
      name: t('inkle', 'newWarpName'),
      warp,
      weft: border,
      passes: plainPasses(32, warp.length),
      palette,
    }
    setInkle(fresh)
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
      <div className="flex flex-col gap-4">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold">{t('inkle', 'photoTitle')}</h2>
          <p className="mt-1 text-xs leading-snug text-stone-500 dark:text-stone-400">
            {t('inkle', 'photoHint')}
          </p>
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
              <span className="text-sm">{t('inkle', 'dropHint')}</span>
            </button>
          ) : (
            <>
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
                      {t('inkle', 'replaceImage')}
                    </button>
                    <button type="button" className="btn-ghost" onClick={removeImage}>
                      <Trash2 size={15} aria-hidden />
                      {t('inkle', 'removeImage')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-2 dark:border-stone-700 dark:bg-stone-800/50">
                <PhotoEditor
                  image={image}
                  onChange={setImage}
                  aspectHint={{ w: effThreads, h: effRows }}
                />
              </div>
            </>
          )}
          {loadError && (
            <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {t('inkle', 'invalidImage')}
            </p>
          )}
          {image && (
            <div className="mt-4 space-y-3">
              <div>
                <span className="field-label">{t('inkle', 'patternThreads')}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PHOTO_THREAD_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyThreads(preset)}
                      aria-pressed={effThreads === preset}
                      className={`cursor-pointer rounded-lg border px-2 py-0.5 text-xs tabular-nums transition-colors ${
                        effThreads === preset
                          ? 'border-otter-500 bg-otter-50 text-otter-700 dark:border-otter-400 dark:bg-otter-900/40 dark:text-otter-300'
                          : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <input
                    type="number"
                    className="input-number ml-auto w-16"
                    min={3}
                    max={39}
                    value={threads}
                    onChange={(e) => setThreads(Number(e.target.value))}
                    onBlur={() => applyThreads(threads)}
                    aria-label={t('inkle', 'patternThreads')}
                  />
                </div>
              </div>

              <label className="block">
                <span className="field-label">{t('inkle', 'rows')}</span>
                <input
                  type="number"
                  className="input-number w-full"
                  min={8}
                  max={120}
                  value={rows}
                  onChange={(e) => setRows(Number(e.target.value))}
                  onBlur={() => setRows(clampNumber(Math.round(rows) || 24, 8, 120))}
                />
              </label>

              <label className="block">
                <span className="field-label">{t('inkle', 'colorCount')}</span>
                <select
                  className="w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  value={colorCount}
                  onChange={(e) => setColorCount(Number(e.target.value))}
                >
                  {PHOTO_COLOR_COUNTS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="field-label">{t('inkle', 'patternColors')}</span>
                <select
                  className="w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  value={patternColorCount}
                  onChange={(e) => setPatternColorCount(Number(e.target.value))}
                >
                  {PHOTO_PATTERN_COLOR_COUNTS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend className="field-label">{t('inkle', 'ground')}</legend>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="inkle-photo-ground"
                    className="accent-otter-600"
                    checked={groundMode === 'auto'}
                    onChange={() => setGroundMode('auto')}
                  />
                  <span>{t('inkle', 'groundAuto')}</span>
                  {autoGround && (
                    <>
                      <span
                        className="inline-block h-3.5 w-3.5 border border-stone-400"
                        style={{ backgroundColor: autoGround }}
                      />
                      <span className="tabular-nums text-stone-500 dark:text-stone-400">
                        {autoGround}
                      </span>
                    </>
                  )}
                </label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="inkle-photo-ground"
                    className="accent-otter-600"
                    checked={groundMode === 'custom'}
                    onChange={() => setGroundMode('custom')}
                  />
                  <span>{t('inkle', 'groundCustom')}</span>
                  <input
                    type="color"
                    value={groundCustom}
                    onChange={(e) => {
                      setGroundCustom(e.target.value)
                      setGroundMode('custom')
                    }}
                    aria-label={t('inkle', 'groundCustom')}
                    className="h-6 w-8 cursor-pointer rounded border border-stone-300 bg-transparent p-0 dark:border-stone-600"
                  />
                </label>
              </fieldset>

              <div className="flex items-center justify-between gap-2">
                <span className="field-label">{t('inkle', 'border')}</span>
                <input
                  type="color"
                  value={borderHex}
                  onChange={(e) => setBorderHex(e.target.value)}
                  aria-label={t('inkle', 'border')}
                  className="h-6 w-8 cursor-pointer rounded border border-stone-300 bg-transparent p-0 dark:border-stone-600"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="field-label">{t('inkle', 'weft')}</span>
                <input
                  type="color"
                  value={photoWeftHex}
                  onChange={(e) => setPhotoWeftHex(e.target.value)}
                  aria-label={t('inkle', 'weft')}
                  className="h-6 w-8 cursor-pointer rounded border border-stone-300 bg-transparent p-0 dark:border-stone-600"
                />
              </div>

              {quantized && (
                <div className="grid grid-cols-2 gap-2">
                  <figure className="min-w-0">
                    <figcaption className="mb-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
                      {t('inkle', 'originalPreview')}
                    </figcaption>
                    <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50 p-1 dark:border-stone-700 dark:bg-stone-800/50">
                      <img
                        src={image.url}
                        alt={image.fileName}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </figure>
                  <figure className="min-w-0">
                    <figcaption className="mb-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
                      {t('inkle', 'quantizedPreview')}
                    </figcaption>
                    <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50 p-1 dark:border-stone-700 dark:bg-stone-800/50">
                      <MatrixCanvas
                        matrix={quantized.matrix}
                        cell={6}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          width: 'auto',
                          height: 'auto',
                        }}
                      />
                    </div>
                  </figure>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold">{t('inkle', 'galleryTitle')}</h2>
          <p className="mt-1 text-xs leading-snug text-stone-500 dark:text-stone-400">
            {t('inkle', 'galleryHint')}
          </p>
          <div className="mt-3">
            <InkleGallery
              repeats={repeats}
              onOpen={(pattern) => setInkle(inkleDraftFromChart(pattern, repeats))}
            />
          </div>
          <label className="mt-3 block">
            <span className="field-label">{t('inkle', 'repeats')}</span>
            <input
              type="number"
              className="input-number w-full"
              min={1}
              max={8}
              value={repeats}
              onChange={(e) =>
                setRepeats(clampNumber(Math.round(Number(e.target.value)) || 3, 1, 8))
              }
            />
          </label>
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="text-sm font-semibold">{t('inkle', 'title')}</h2>
        {image && quantized ? (
          <>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <figure className="min-w-0">
                <figcaption className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                  {t('inkle', 'originalPreview')}
                </figcaption>
                <div className="flex h-56 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50 p-2 dark:border-stone-700 dark:bg-stone-800/50">
                  <img
                    src={image.url}
                    alt={image.fileName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </figure>
              <figure className="min-w-0">
                <figcaption className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                  {t('inkle', 'quantizedPreview')}
                </figcaption>
                <div className="flex h-56 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50 p-2 dark:border-stone-700 dark:bg-stone-800/50">
                  <MatrixCanvas
                    matrix={quantized.matrix}
                    cell={6}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                    }}
                  />
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
            {t('inkle', 'photoHint')}
          </div>
        )}
        <button
          type="button"
          onClick={generatePhoto}
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
          {confirmOverwrite ? t('inkle', 'overwriteWarning') : t('inkle', 'generate')}
        </button>
        <button type="button" className="btn-secondary mt-2 w-full" onClick={newPlainWarp}>
          <Plus size={14} /> {t('inkle', 'newWarp')}
        </button>
      </section>
    </div>
  )
}
