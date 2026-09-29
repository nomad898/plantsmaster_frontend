import { useEffect, useMemo, useState } from 'react'
import { loadRejectedOccurrences } from '../api'
import type { RejectedDataset, RejectedReason, RejectedOccurrence, OccurrenceSource } from '../types'

const reasonLabels: Record<RejectedReason, string> = {
  outside_candidate_almaty_region: 'Вне candidate Almaty Region',
  missing_coordinates: 'Нет корректных координат',
  missing_or_invalid_date: 'Нет корректной даты',
  before_1980: 'Дата до 1980 года',
  sensitivity_only: 'Sensitivity 10 km output',
  other_source_rejection: 'Другая причина источника',
}

function RecordRow({ record }: { record: RejectedOccurrence }) {
  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="px-3 py-3 text-xs font-medium text-gray-700">{record.source}</td>
      <td className="px-3 py-3 text-sm text-gray-800">{record.species}</td>
      <td className="px-3 py-3 text-xs text-gray-600">{record.observedDate ?? 'не указана'}</td>
      <td className="px-3 py-3 text-xs text-gray-600">{record.locality ?? 'не указано'}</td>
      <td className="px-3 py-3">
        <span className="inline-flex rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{reasonLabels[record.reason]}</span>
        <div className="mt-1 text-xs text-gray-500">{record.reasonDetail}</div>
      </td>
      <td className="px-3 py-3 text-xs text-gray-500">
        <details>
          <summary className="cursor-pointer text-forest-700 hover:text-forest-900">Исходная строка</summary>
          <pre className="mt-2 max-w-[28rem] overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-[10px] leading-4">{JSON.stringify(record.raw, null, 2)}</pre>
        </details>
      </td>
    </tr>
  )
}

export default function RejectedRecords() {
  const [dataset, setDataset] = useState<RejectedDataset | null>(null)
  const [source, setSource] = useState<'all' | OccurrenceSource>('all')
  const [reason, setReason] = useState<'all' | RejectedReason>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRejectedOccurrences().then(setDataset).catch(value => setError(value instanceof Error ? value.message : 'Не удалось загрузить rejected records'))
  }, [])

  const visible = useMemo(() => (dataset?.records ?? []).filter(record =>
    (source === 'all' || record.source === source) && (reason === 'all' || record.reason === reason)
  ), [dataset, reason, source])

  const reasonOptions = useMemo(() => [...new Set(dataset?.records.map(record => record.reason) ?? [])], [dataset])

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">Ошибка загрузки rejected records: {error}</div>

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong>Аудит отброшенных данных.</strong> Записи не удаляются: здесь сохранены source-rejected rows и строки primary, исключённые frontend-фильтрами. Причина не означает, что запись навсегда непригодна: после review она может быть переоценена.
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <label className="text-sm text-gray-600">Источник
          <select value={source} onChange={event => setSource(event.target.value as 'all' | OccurrenceSource)} className="ml-2 rounded border px-2 py-1">
            <option value="all">Все</option><option value="GBIF">GBIF</option><option value="iNaturalist">iNaturalist</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">Причина
          <select value={reason} onChange={event => setReason(event.target.value as 'all' | RejectedReason)} className="ml-2 max-w-72 rounded border px-2 py-1">
            <option value="all">Все причины</option>
            {reasonOptions.map(option => <option key={option} value={option}>{reasonLabels[option]}</option>)}
          </select>
        </label>
        <span className="ml-auto text-xs text-gray-500">{dataset ? `${visible.length.toLocaleString('ru-RU')} из ${dataset.records.length.toLocaleString('ru-RU')} записей` : 'Загрузка…'}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        {!dataset && <div className="p-6 text-sm text-gray-500">Загрузка rejected records…</div>}
        {dataset && <table className="min-w-[980px] w-full text-left">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="px-3 py-3">Источник</th><th className="px-3 py-3">Вид</th><th className="px-3 py-3">Дата</th><th className="px-3 py-3">Место</th><th className="px-3 py-3">Причина</th><th className="px-3 py-3">Детали</th></tr>
          </thead>
          <tbody>{visible.map((record, index) => <RecordRow key={`${record.source}-${record.id}-${index}`} record={record} />)}</tbody>
        </table>}
      </div>
      {dataset && <div className="text-[11px] text-gray-500">Источники: {dataset.sourceFiles.join(' · ')} · {dataset.notes}</div>}
    </div>
  )
}