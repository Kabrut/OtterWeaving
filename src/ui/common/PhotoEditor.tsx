import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { RotateCcw, RotateCw, Scissors, X } from 'lucide-react'
import { t } from '../../i18n/pl'

export interface EditedImage {
  url: string
  fileName: string
  width: number
  height: number
  el: HTMLImageElement
}

interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

interface PhotoEditorProps {
  image: EditedImage
  onChange: (next: EditedImage) => void
  aspectHint?: { w: number; h: number }
}

const MIN_CROP = 10

export function PhotoEditor({ image, onChange, aspectHint }: PhotoEditorProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const draftRef = useRef<CropRect | null>(null)
  const [draft, setDraft] = useState<CropRect | null>(null)
  const [selection, setSelection] = useState<CropRect | null>(null)
  const [, setFrameTick] = useState(0)

  useEffect(() => {
    dragStart.current = null
    draftRef.current = null
    setDraft(null)
    setSelection(null)
  }, [image])

  useEffect(() => {
    const onResize = () => setFrameTick((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const contentRect = () => {
    const img = imgRef.current
    if (!img) return null
    const rect = img.getBoundingClientRect()
    const nw = img.naturalWidth || 1
    const nh = img.naturalHeight || 1
    const scale = Math.min(rect.width / nw, rect.height / nh)
    const width = nw * scale
    const height = nh * scale
    return {
      left: rect.left + (rect.width - width) / 2,
      top: rect.top + (rect.height - height) / 2,
      width,
      height,
      naturalWidth: nw,
      naturalHeight: nh,
    }
  }

  const toNatural = (clientX: number, clientY: number) => {
    const c = contentRect()
    if (!c) return { x: 0, y: 0 }
    return {
      x: Math.max(0, Math.min(c.naturalWidth, ((clientX - c.left) / c.width) * c.naturalWidth)),
      y: Math.max(0, Math.min(c.naturalHeight, ((clientY - c.top) / c.height) * c.naturalHeight)),
    }
  }

  const rectStyle = (r: CropRect): CSSProperties => {
    const c = contentRect()
    const frame = frameRef.current
    if (!c || !frame) return { display: 'none' }
    const frameRect = frame.getBoundingClientRect()
    return {
      left: c.left - frameRect.left + (r.x / c.naturalWidth) * c.width,
      top: c.top - frameRect.top + (r.y / c.naturalHeight) * c.height,
      width: (r.w / c.naturalWidth) * c.width,
      height: (r.h / c.naturalHeight) * c.height,
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toNatural(e.clientX, e.clientY)
    dragStart.current = p
    setSelection(null)
    const next = { x: p.x, y: p.y, w: 0, h: 0 }
    draftRef.current = next
    setDraft(next)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current
    if (!start) return
    const p = toNatural(e.clientX, e.clientY)
    const next = {
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    }
    draftRef.current = next
    setDraft(next)
  }

  const endDrag = (commit: boolean) => {
    if (!dragStart.current) return
    dragStart.current = null
    const next = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (commit && next && next.w >= MIN_CROP && next.h >= MIN_CROP) setSelection(next)
  }

  const emit = (canvas: HTMLCanvasElement) => {
    const url = canvas.toDataURL('image/png')
    const img = new Image()
    img.onload = () => {
      onChange({
        url,
        fileName: image.fileName,
        width: img.naturalWidth,
        height: img.naturalHeight,
        el: img,
      })
    }
    img.src = url
  }

  const rotate = (radians: number) => {
    const src = image.el
    const canvas = document.createElement('canvas')
    canvas.width = src.naturalHeight
    canvas.height = src.naturalWidth
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(radians)
    ctx.drawImage(src, -src.naturalWidth / 2, -src.naturalHeight / 2)
    emit(canvas)
  }

  const applyCrop = () => {
    if (!selection) return
    const sx = Math.round(selection.x)
    const sy = Math.round(selection.y)
    const sw = Math.max(1, Math.round(selection.x + selection.w) - sx)
    const sh = Math.max(1, Math.round(selection.y + selection.h) - sy)
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(image.el, sx, sy, sw, sh, 0, 0, sw, sh)
    emit(canvas)
  }

  const active = draft ?? selection
  const aspectText = aspectHint
    ? t('wizard', 'aspectHint')
        .replace('{w}', String(aspectHint.w))
        .replace('{h}', String(aspectHint.h))
    : null

  return (
    <div>
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        className="relative flex touch-none cursor-crosshair select-none justify-center"
      >
        <img
          ref={imgRef}
          src={image.url}
          alt={image.fileName}
          draggable={false}
          className="max-h-56 max-w-full object-contain"
        />
        {active && active.w > 0 && active.h > 0 && (
          <div
            className="pointer-events-none absolute border-2 border-otter-500 bg-otter-500/10"
            style={rectStyle(active)}
          />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => rotate(-Math.PI / 2)}
          title={t('wizard', 'rotateLeft')}
          aria-label={t('wizard', 'rotateLeft')}
        >
          <RotateCcw size={15} aria-hidden />
          {t('wizard', 'rotateLeft')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => rotate(Math.PI / 2)}
          title={t('wizard', 'rotateRight')}
          aria-label={t('wizard', 'rotateRight')}
        >
          <RotateCw size={15} aria-hidden />
          {t('wizard', 'rotateRight')}
        </button>
        {selection && (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={applyCrop}
              title={t('wizard', 'cropApply')}
              aria-label={t('wizard', 'cropApply')}
            >
              <Scissors size={15} aria-hidden />
              {t('wizard', 'cropApply')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setSelection(null)}
              title={t('wizard', 'cropCancel')}
              aria-label={t('wizard', 'cropCancel')}
            >
              <X size={15} aria-hidden />
              {t('wizard', 'cropCancel')}
            </button>
          </>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-snug text-stone-500 dark:text-stone-400">
        {t('wizard', 'cropHint')}
      </p>
      {aspectText && (
        <p className="mt-0.5 text-xs leading-snug text-stone-500 dark:text-stone-400">
          {aspectText}
        </p>
      )}
    </div>
  )
}
