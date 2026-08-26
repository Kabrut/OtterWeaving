import type { ThreadColor } from '../../core/types'
import { readableTextOn } from '../../core/color'

interface PaletteProps {
  palette: ThreadColor[]
  selectedId: string | null
  onSelect: (colorId: string) => void
  size?: 'sm' | 'md'
  allowNone?: boolean
}

export function Palette({ palette, selectedId, onSelect, size = 'md', allowNone = false }: PaletteProps) {
  const dim = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  return (
    <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Paleta kolorów">
      {allowNone && (
        <button
          type="button"
          onClick={() => onSelect('')}
          className={`${dim} rounded-md border-2 border-dashed border-stone-300 dark:border-stone-600 ${selectedId === null || selectedId === '' ? 'ring-2 ring-otter-500' : ''}`}
          title="Brak / odznacz"
          aria-label="Brak koloru"
        />
      )}
      {palette.map((color) => {
        const selected = selectedId === color.id
        return (
          <button
            key={color.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(color.id)}
            className={`${dim} cursor-pointer rounded-md border transition-transform hover:scale-110 ${selected ? 'ring-2 ring-otter-500 ring-offset-1' : 'border-stone-300 dark:border-stone-600'}`}
            style={{ backgroundColor: color.hex, color: readableTextOn(color.hex) }}
            title={color.name || color.hex}
          >
            {selected && (
              <span className="text-xs leading-none font-bold" aria-hidden>
                ✓
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
