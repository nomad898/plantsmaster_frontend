import { useEffect, useState } from 'react'
import { fetchPlant, loadExternalPlantInfo } from '../api'
import type { PlantBrief, PlantDetail as PlantDetailType } from '../types'

interface Props {
  plant: PlantBrief
  onClose: () => void
}

export default function PlantDetail({ plant, onClose }: Props) {
  const [detail, setDetail] = useState<PlantDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [external, setExternal] = useState<PlantDetailType['externalReference']>()

  useEffect(() => {
    setLoading(true)
    setDetail(null)
    setExternal(undefined)
    fetchPlant(plant.id)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false))
    loadExternalPlantInfo(plant).then(setExternal)
  }, [plant.id])

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-100 bg-forest-50 p-5">
        <div>
          <h2 className="text-lg font-bold italic text-forest-800">{plant.name_la}</h2>
          {plant.name_ru && <p className="text-sm text-gray-700">{plant.name_ru}</p>}
          {plant.name_kz && <p className="text-xs text-gray-400">{plant.name_kz}</p>}
        </div>
        <button onClick={onClose} className="ml-4 rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-gray-600">
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && <p className="py-8 text-center text-sm text-gray-400">Загрузка…</p>}
        {detail && (
          <div className="space-y-5">
            {external?.thumbnailUrl && <img src={external.thumbnailUrl} alt={`Иллюстрация: ${plant.name_la}`} className="h-48 w-full rounded-lg object-cover" />}
            <Row label="Семейство" value={detail.family} />
            <Row label="Жизненная форма" value={detail.life_form} />
            {detail.distribution_text && <Row label="Ареал" value={detail.distribution_text} />}

            <div className={`rounded-lg border px-3 py-2 text-xs ${detail.validation.status === 'complete' ? 'border-forest-200 bg-forest-50 text-forest-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <strong>{detail.validation.status === 'complete' ? 'Локальная проверка полноты' : 'Требует проверки'}</strong>
              <p className="mt-1">Это контроль заполненности и повторов в локальном каталоге, не подтверждение медицинской эффективности.</p>
              {detail.validation.flags.length > 0 && <ul className="mt-1 list-disc pl-4">{detail.validation.flags.map(flag => <li key={flag}>{flag}</li>)}</ul>}
            </div>

            <TagSection label="Сырьё" items={detail.raw_materials.map(r => r.name)} color="bg-amber-50 text-amber-700" />
            <TagSection label="Применение" items={detail.applications.map(a => a.code)} color="bg-blue-50 text-blue-700" />
            <TagSection label="Свойства" items={detail.properties.map(p => p.name)} color="bg-forest-50 text-forest-700" />
            <TagSection label="Состав" items={detail.compounds.map(c => c.name)} color="bg-purple-50 text-purple-700" />

            {detail.notes && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Примечания</p>
                <p className="text-sm text-gray-600">{detail.notes}</p>
              </div>
            )}
            {external && <div className="border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Внешние материалы</p>
              {external.extract && <p className="mb-3 text-sm leading-6 text-gray-600">{external.extract}</p>}
              <div className="flex flex-wrap gap-2 text-xs">
                <a className="rounded bg-gray-100 px-2.5 py-1.5 text-gray-700 hover:bg-gray-200" href={external.wikipediaUrl} target="_blank" rel="noreferrer">Wikipedia</a>
                <a className="rounded bg-gray-100 px-2.5 py-1.5 text-gray-700 hover:bg-gray-200" href={external.wikimediaSearchUrl} target="_blank" rel="noreferrer">Изображения Wikimedia</a>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">{external.notice}</p>
            </div>}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-700">{value}</p>
    </div>
  )
}

function TagSection({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items.length) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{item}</span>
        ))}
      </div>
    </div>
  )
}
