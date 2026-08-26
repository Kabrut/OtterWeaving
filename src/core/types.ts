export type Twist = 'S' | 'Z'
export type Turn = 'F' | 'B'
export type ColorId = string

export interface ThreadColor {
  id: ColorId
  hex: string
  name: string
}

export interface Tablet {
  holes: [ColorId, ColorId, ColorId, ColorId]
  twist: Twist
}

export interface Row {
  turns: Turn[]
  weft: ColorId
}

export interface Draft {
  version: 1
  name: string
  tablets: Tablet[]
  rows: Row[]
  palette: ThreadColor[]
}

export type HexMatrix = string[][]

export type GenerateMode = 'threadedin' | 'faithful'

export interface WizardSettings {
  tablets: number
  rows: number
  colorCount: number
  mode: GenerateMode
  reverseEvery: number
  weftIndex: number
}

export interface GeneratorMeta {
  settings: WizardSettings
  sourceMatrix: HexMatrix | null
}

export const HOLES = 4

export const HOLE_LETTERS = ['A', 'B', 'C', 'D'] as const
