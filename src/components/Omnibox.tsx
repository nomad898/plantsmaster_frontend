import { useState, useEffect, useRef } from 'react'
import { searchPlants } from '../api'
import type { PlantBrief } from '../types'

interface Props {
  onSelect: (plant: PlantBrief) => void
  onSearch: (query: string) => void
}

export default function Omnibox({ onSelect, onSearch }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlantBrief[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!query.trim()) { setResults([]); setOpen(false); onSearch(''); return }
    timer.current = setTimeout(async () => {
      const hits = await searchPlants(query, 8).catch(() => [])
      setResults(hits)
      setOpen(hits.length > 0)
      onSearch(query)
    }, 300)
  }, [query, onSearch])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (plant: PlantBrief) => {
    setQuery('')
    setOpen(false)
    onSearch('')
    onSelect(plant)
  }

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Поиск растения (лат., рус., каз., состав…)"
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg">
          {results.map(p => (
            <li
              key={p.id}
              onMouseDown={() => pick(p)}
              className="cursor-pointer px-4 py-2.5 hover:bg-forest-50"
            >
              <span className="font-medium italic text-forest-700">{p.name_la}</span>
              {p.name_ru && <span className="ml-2 text-sm text-gray-500">{p.name_ru}</span>}
              {p.family && <span className="ml-2 text-xs text-gray-400">{p.family}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
