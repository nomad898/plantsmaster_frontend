import { useState, useRef, useEffect } from 'react'

interface Props {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function FilterSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm outline-none focus:border-forest-500 flex items-center justify-between"
      >
        <span className="text-gray-700">
          {selected.length === 0 ? 'Все' : `${selected.length} выбрано`}
        </span>
        <span className="text-gray-400">▼</span>
      </button>

      {open && (
        <div ref={ref} className="absolute left-0 right-0 top-full z-40 mt-1 rounded-lg border border-gray-100 bg-white shadow-lg">
          <div className="max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">Нет опций</p>
            ) : (
              options.map(option => (
                <label
                  key={option}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-forest-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => toggle(option)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-2">
              <button
                onClick={() => onChange([])}
                className="text-xs text-forest-600 hover:text-forest-700 font-medium"
              >
                Очистить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
