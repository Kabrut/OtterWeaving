import { describe, expect, it } from 'vitest'
import {
  colorDistance,
  hexToRgb,
  luminance,
  nearestHex,
  normalizeHex,
  readableTextOn,
  rgbToHex,
} from './color'

describe('normalizeHex', () => {
  it('lowercases and adds the hash prefix', () => {
    expect(normalizeHex('FF00AA')).toBe('#ff00aa')
    expect(normalizeHex('#FF00AA')).toBe('#ff00aa')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeHex('  #ffffff ')).toBe('#ffffff')
  })

  it('falls back to black on invalid input', () => {
    expect(normalizeHex('#f0a')).toBe('#000000')
    expect(normalizeHex('#ff00zz')).toBe('#000000')
    expect(normalizeHex('nope')).toBe('#000000')
    expect(normalizeHex('')).toBe('#000000')
  })
})

describe('hexToRgb / rgbToHex', () => {
  it('parses hex triplets', () => {
    expect(hexToRgb('#ff8040')).toEqual({ r: 255, g: 128, b: 64 })
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('formats lowercase #rrggbb', () => {
    expect(rgbToHex(255, 128, 64)).toBe('#ff8040')
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
  })

  it('clamps out-of-range channels', () => {
    expect(rgbToHex(-10, 300, 0)).toBe('#00ff00')
    expect(rgbToHex(0, 0, 999)).toBe('#0000ff')
  })

  it('rounds fractional channels', () => {
    expect(rgbToHex(127.5, 0, 0)).toBe('#800000')
  })
})

describe('colorDistance', () => {
  it('is the squared euclidean distance', () => {
    expect(colorDistance('#000000', '#000000')).toBe(0)
    expect(colorDistance('#000000', '#ffffff')).toBe(3 * 255 * 255)
    expect(colorDistance('#ff0000', '#00ff00')).toBe(2 * 255 * 255)
    expect(colorDistance('#000000', '#ff0000')).toBe(255 * 255)
  })

  it('is symmetric', () => {
    expect(colorDistance('#123456', '#654321')).toBe(colorDistance('#654321', '#123456'))
  })
})

describe('nearestHex', () => {
  it('picks the closest candidate', () => {
    expect(nearestHex('#ff0000', ['#00ff00', '#ff1010', '#0000ff'])).toBe('#ff1010')
    expect(nearestHex('#000000', ['#202020', '#c0c0c0'])).toBe('#202020')
  })

  it('keeps the first candidate on a tie', () => {
    expect(nearestHex('#020202', ['#010203', '#030201'])).toBe('#010203')
  })
})

describe('luminance / readableTextOn', () => {
  it('bounds luminance between 0 and 1', () => {
    expect(luminance('#ffffff')).toBe(1)
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#808080')).toBeGreaterThan(0.4)
    expect(luminance('#808080')).toBeLessThan(0.6)
  })

  it('weights green above red and blue', () => {
    expect(luminance('#00ff00')).toBeGreaterThan(luminance('#ff0000'))
    expect(luminance('#00ff00')).toBeGreaterThan(luminance('#0000ff'))
  })

  it('chooses dark text on light backgrounds and white on dark', () => {
    expect(readableTextOn('#ffffff')).toBe('#1f1b16')
    expect(readableTextOn('#ffffcc')).toBe('#1f1b16')
    expect(readableTextOn('#000000')).toBe('#ffffff')
    expect(readableTextOn('#ff0000')).toBe('#ffffff')
  })
})
