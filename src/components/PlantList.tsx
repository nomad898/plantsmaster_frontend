import { useState, useEffect } from 'react'
import { fetchPlants, getFilterOptions } from '../api'
import FilterSelect from './FilterSelect'
import type { PlantBrief } from '../types'

const LIFE_FORMS = ['Многолетник', 'Однолетник', 'Двулетник', 'Дерево', 'Кустарник', 'Полукустарник']

interface Props {
  onSelect: (plant: PlantBrief) => void
  familyFilter?: string
}

interface FilterState {
  family?: string
  life_form?: string
  compounds: string[]
  applications: string[]
  locations: string[]
}

export default function PlantList({ onSelect, familyFilter }: Props) {
  const [filters, setFilters] = useState<FilterState>({ compounds: [], applications: [], locations: [] })
  const [items, setItems] = useState<PlantBrief[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filterOptions, setFilterOptions] = useState({ compounds: [] as string[], properties: [] as string[], applications: [] as string[], locations: [] as string[] })

  const limit = 20

  // Load filter options on mount
  useEffect(() => {
    getFilterOptions().then(setFilterOptions)
  }, [])

  // Update family filter when prop changes
  useEffect(() => {
    setFilters(f => ({ ...f, family: familyFilter, compounds: [], applications: [], locations: [] }))
    setPage(1)
  }, [familyFilter])

  // Fetch plants when filters change
  useEffect(() => {
    setLoading(true)
    fetchPlants({ ...filters, page, limit, compounds: filters.compounds, applications: filters.applications, locations: filters.locations })
      .then(d => { setItems(d.items); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filters, page])

  const handleFilterChange = (key: keyof FilterState, value: string | string[] | undefined) => {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar filters */}
      <aside className="w-52 shrink-0 space-y-5 overflow-y-auto">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Семейство</label>
          <input
            type="text"
            value={filters.family ?? ''}
            onChange={e => handleFilterChange('family', e.target.value || undefined)}
            placeholder="Apiaceae…"
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-forest-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Жизненная форма</label>
          <select
            value={filters.life_form ?? ''}
            onChange={e => handleFilterChange('life_form', e.target.value || undefined)}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-forest-500"
          >
            <option value="">Все</option>
            {LIFE_FORMS.map(lf => <option key={lf} value={lf}>{lf}</option>)}
          </select>
        </div>

        <FilterSelect
          label="Состав"
          options={filterOptions.compounds}
          selected={filters.compounds}
          onChange={(v) => handleFilterChange('compounds', v)}
        />

        <FilterSelect
          label="Применение"
          options={filterOptions.applications}
          selected={filters.applications}
          onChange={(v) => handleFilterChange('applications', v)}
        />

        <FilterSelect
          label="Местоположение"
          options={filterOptions.locations}
          selected={filters.locations}
          onChange={(v) => handleFilterChange('locations', v)}
        />

        <div className="pt-1 text-xs text-gray-400">
          Найдено: <span className="font-semibold text-gray-600">{total}</span>
        </div>
      </aside>

      {/* Plant cards - single row list */}
      <div className="flex flex-1 flex-col gap-3">
        {loading && <p className="py-8 text-center text-sm text-gray-400">Загрузка…</p>}
        {!loading && items.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">Ничего не найдено</p>
        )}
        {!loading && items.length > 0 && (
          <>
            <div className="space-y-2 overflow-y-auto flex-1">
              {items.map(p => (
                <div
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="cursor-pointer rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-forest-300 transition flex items-center gap-4 p-4"
                >
                  {/* Image placeholder */}
                  <div className="bg-gradient-to-br from-forest-100 to-forest-50 rounded-lg h-24 w-24 flex items-center justify-center text-forest-300 flex-shrink-0">
                    <span className="text-3xl">🌿</span>
                  </div>

                  {/* Plant info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <p className="font-bold italic text-forest-800 text-base">{p.name_la}</p>
                      {p.family && <span className="text-xs text-gray-500">({p.family})</span>}
                    </div>
                    {p.name_ru && <p className="text-sm text-gray-700 mb-0.5">{p.name_ru}</p>}
                    {p.name_kz && <p className="text-xs text-gray-500 mb-2">{p.name_kz}</p>}
                    <div className="flex flex-wrap gap-2">
                      {p.life_form && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 border border-blue-200">
                          {p.life_form}
                        </span>
                      )}
                      {p.family && (
                        <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs text-forest-700 border border-forest-200">
                          {p.family}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right arrow indicator */}
                  <div className="text-gray-400 text-xl flex-shrink-0">→</div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-3">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  ←
                </button>
                <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
