import { useState, useEffect } from 'react'
import { fetchPlants } from '../api'
import type { PlantBrief, PlantFilters } from '../types'

const APP_CODES = ['НМ', 'ВМ', 'ОМ', 'ЗМ', 'ЕМ', 'ЭксП.М']
const LIFE_FORMS = ['Многолетник', 'Однолетник', 'Двулетник', 'Дерево', 'Кустарник', 'Полукустарник']

interface Props {
  onSelect: (plant: PlantBrief) => void
  familyFilter?: string
}

export default function PlantList({ onSelect, familyFilter }: Props) {
  const [filters, setFilters] = useState<PlantFilters>({ page: 1, limit: 20 })
  const [items, setItems] = useState<PlantBrief[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setFilters(f => ({ ...f, family: familyFilter, page: 1 }))
  }, [familyFilter])

  useEffect(() => {
    setLoading(true)
    fetchPlants(filters)
      .then(d => { setItems(d.items); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filters])

  const set = (key: keyof PlantFilters, val: string | number | undefined) =>
    setFilters(f => ({ ...f, [key]: val, page: 1 }))

  const totalPages = Math.ceil(total / filters.limit)

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar filters */}
      <aside className="w-52 shrink-0 space-y-5">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Семейство</label>
          <input
            type="text"
            value={filters.family ?? ''}
            onChange={e => set('family', e.target.value || undefined)}
            placeholder="Apiaceae…"
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-forest-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Применение</label>
          <div className="flex flex-wrap gap-1">
            {APP_CODES.map(code => (
              <button
                key={code}
                onClick={() => set('application', filters.application === code ? undefined : code)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                  filters.application === code
                    ? 'bg-forest-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-forest-100'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Жизненная форма</label>
          <select
            value={filters.life_form ?? ''}
            onChange={e => set('life_form', e.target.value || undefined)}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-forest-500"
          >
            <option value="">Все</option>
            {LIFE_FORMS.map(lf => <option key={lf} value={lf}>{lf}</option>)}
          </select>
        </div>

        <div className="pt-1 text-xs text-gray-400">
          Найдено: <span className="font-semibold text-gray-600">{total}</span>
        </div>
      </aside>

      {/* Plant cards */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {loading && <p className="py-8 text-center text-sm text-gray-400">Загрузка…</p>}
        {!loading && items.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">Ничего не найдено</p>
        )}
        {items.map(p => (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            className="cursor-pointer rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-forest-300 hover:shadow-md"
          >
            <p className="font-semibold italic text-forest-700">{p.name_la}</p>
            {p.name_ru && <p className="mt-0.5 text-sm text-gray-700">{p.name_ru}</p>}
            {p.name_kz && <p className="text-xs text-gray-400">{p.name_kz}</p>}
            <div className="mt-2 flex flex-wrap gap-1">
              {p.family && (
                <span className="rounded-full bg-forest-50 px-2 py-0.5 text-xs text-forest-700">{p.family}</span>
              )}
              {p.life_form && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{p.life_form}</span>
              )}
            </div>
          </div>
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              ←
            </button>
            <span className="text-sm text-gray-500">{filters.page} / {totalPages}</span>
            <button
              disabled={filters.page >= totalPages}
              onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
