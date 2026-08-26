import { useEffect, useRef } from 'react'
import type { Draft } from '../../core/types'
import { colorHexMap } from '../../core/draft'
import { simulate } from '../../core/simulator'
import { luminance } from '../../core/color'
import { t } from '../../i18n/pl'

interface FabricCanvasProps {
  draft: Draft
  cell?: number
  className?: string
  showGrid?: boolean
  activeRow?: number | null
}

export function FabricCanvas({
  draft,
  cell = 8,
  className,
  showGrid = false,
  activeRow = null,
}: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rows = draft.rows.length
    const cols = draft.tablets.length
    if (rows === 0 || cols === 0) return
    const dpr = window.devicePixelRatio || 1
    const w = cols * cell
    const h = rows * cell
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const { grid } = simulate(draft)
    const hexById = colorHexMap(draft)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = hexById.get(grid[y][x]) ?? '#000000'
        ctx.fillRect(x * cell, y * cell, cell, cell)
      }
    }
    if (showGrid && cell >= 6) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.lineWidth = 0.5
      for (let x = 0; x <= cols; x++) {
        ctx.beginPath()
        ctx.moveTo(x * cell, 0)
        ctx.lineTo(x * cell, h)
        ctx.stroke()
      }
      for (let y = 0; y <= rows; y++) {
        ctx.beginPath()
        ctx.moveTo(0, y * cell)
        ctx.lineTo(w, y * cell)
        ctx.stroke()
      }
    }
    if (activeRow !== null && activeRow >= 0 && activeRow < rows) {
      ctx.fillStyle = 'rgba(20,184,166,0.35)'
      ctx.fillRect(0, activeRow * cell, w, cell)
    }
    ctx.strokeStyle = luminance('#888888') > 0.5 ? '#444' : '#888'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
  }, [draft, cell, showGrid, activeRow])

  return <canvas ref={canvasRef} className={className} aria-label={t('app', 'fabricPreview')} />
}
