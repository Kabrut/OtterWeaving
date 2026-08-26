export interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex)
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return (
    '#' +
    [r, g, b]
      .map((v) => clamp(v).toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase()
  )
}

export function normalizeHex(hex: string): string {
  const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/)
  if (!m) return '#000000'
  return '#' + m[1].toLowerCase()
}

export function colorDistance(a: string, b: string): number {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const dr = ca.r - cb.r
  const dg = ca.g - cb.g
  const db = ca.b - cb.b
  return dr * dr + dg * dg + db * db
}

export function nearestHex(hex: string, candidates: string[]): string {
  let best = candidates[0]
  let bestDist = Infinity
  for (const c of candidates) {
    const d = colorDistance(hex, c)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function readableTextOn(hex: string): string {
  return luminance(hex) > 0.55 ? '#1f1b16' : '#ffffff'
}
