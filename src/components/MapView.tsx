import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { findPlantForOccurrence, loadDemoPredictions, loadOccurrences } from '../api'
import type { DemoPrediction, DemoPredictionModel, OccurrenceDataset, OccurrenceSource, PlantBrief } from '../types'

const sourceColors: Record<OccurrenceSource, string> = { GBIF: '#2563eb', iNaturalist: '#d97706' }

interface Props { onPlantSelect: (plant: PlantBrief) => void }

export default function MapView({ onPlantSelect }: Props) {
  const [dataset, setDataset] = useState<OccurrenceDataset | null>(null)
  const [source, setSource] = useState<'all' | OccurrenceSource>('all')
  const [species, setSpecies] = useState('all')
  const [yearRange, setYearRange] = useState<[number, number] | null>(null)
  const [showPredictions, setShowPredictions] = useState(false)
  const [predictionModel, setPredictionModel] = useState<DemoPredictionModel>('random_forest')
  const [predictions, setPredictions] = useState<DemoPrediction[] | null>(null)
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOccurrences().then(setDataset).catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить точки'))
  }, [])

  useEffect(() => {
    if (!showPredictions) return
    setPredictionError(null)
    loadDemoPredictions(predictionModel).then(setPredictions).catch(e => setPredictionError(e instanceof Error ? e.message : 'Не удалось загрузить predictions'))
  }, [showPredictions, predictionModel])

  const datedYears = useMemo(() => (dataset?.features.map(f => f.properties.year).filter((value): value is number => value !== null && value !== undefined) ?? []), [dataset])
  const minYear = datedYears.length ? Math.min(...datedYears) : 0
  const maxYear = datedYears.length ? Math.max(...datedYears) : 0

  useEffect(() => {
    if (datedYears.length && !yearRange) setYearRange([minYear, maxYear])
  }, [datedYears.length, minYear, maxYear, yearRange])

  const speciesOptions = useMemo(() => [...new Set(dataset?.features.map(f => f.properties.species) ?? [])].sort(), [dataset])
  const visible = useMemo(() => (dataset?.features ?? []).filter(f =>
    (source === 'all' || f.properties.source === source) &&
    (species === 'all' || f.properties.species === species) &&
    (!yearRange || (f.properties.year !== null && f.properties.year !== undefined && f.properties.year >= yearRange[0] && f.properties.year <= yearRange[1]))
  ), [dataset, source, species, yearRange])

  const visiblePredictions = useMemo(() => (predictions ?? []).filter(point =>
    species === 'all' || point.species === species || point.sampleRole === 'background_candidate'
  ), [predictions, species])

  const handleCatalogOpen = async (speciesName: string) => {
    const plant = await findPlantForOccurrence(speciesName)
    if (plant) onPlantSelect(plant)
  }

  return (
    <div className="relative flex h-full flex-col gap-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <strong>Предварительные данные.</strong> Показаны реальные occurrence points из validated interim primary Almaty outputs
        (GBIF/iNaturalist) с датой наблюдения от 1980 года. {showPredictions
          ? 'Включён отдельный technical demo prediction layer; он не является научной картой распространения.'
          : 'Без prediction layer отображаются только наблюдения, не модельные прогнозы.'} Rejected, sensitivity, недатированные записи и записи до 1980 года исключены из отображения.
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <label className="text-sm text-gray-600">Источник
          <select value={source} onChange={e => setSource(e.target.value as 'all' | OccurrenceSource)} className="ml-2 rounded border px-2 py-1">
            <option value="all">Все источники</option><option value="GBIF">GBIF</option><option value="iNaturalist">iNaturalist</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">Вид
          <select value={species} onChange={e => setSpecies(e.target.value)} className="ml-2 max-w-64 rounded border px-2 py-1">
            <option value="all">Все виды</option>{speciesOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={showPredictions} onChange={event => setShowPredictions(event.target.checked)} className="h-4 w-4 accent-forest-700" />
          Показывать predicted results
        </label>
        {showPredictions && <label className="text-sm text-gray-600">Модель
          <select value={predictionModel} onChange={event => setPredictionModel(event.target.value as DemoPredictionModel)} className="ml-2 rounded border px-2 py-1">
            <option value="random_forest">Random Forest</option>
            <option value="logistic_regression">Logistic Regression</option>
          </select>
        </label>}
        <span className="ml-auto text-xs text-gray-500">{dataset ? `${visible.length.toLocaleString('ru-RU')} из ${dataset.features.length.toLocaleString('ru-RU')} точек` : 'Загрузка…'}</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-100 shadow-sm">
        <MapContainer center={[43.35, 77.0]} zoom={7} className="h-full w-full" scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {visible.map((feature, index) => {
            const p = feature.properties
            return <CircleMarker key={`${p.source}-${p.id}-${index}`} center={[feature.geometry.coordinates[1], feature.geometry.coordinates[0]]}
              radius={6} pathOptions={{ color: sourceColors[p.source], fillColor: sourceColors[p.source], fillOpacity: 0.7, weight: 1 }}>
              <Popup>
                <div className="space-y-1 text-sm"><strong>{p.species}</strong>
                  <div><span className="font-medium">Источник:</span> {p.source}</div>
                  <div><span className="font-medium">Дата наблюдения:</span> {p.observedDate ?? 'не указана'} ({p.datePrecision ?? 'точность не указана'})</div>
                  {p.locality && <div><span className="font-medium">Место:</span> {p.locality}</div>}
                  <div><span className="font-medium">Неопределённость:</span> {p.coordinateUncertaintyMeters ?? 'не указана'} м</div>
                  <div><span className="font-medium">Datum:</span> {p.datum ?? 'не указан'}</div>
                  <div><span className="font-medium">Eligibility:</span> {p.eligibility ?? 'не указана'}</div>
                  {p.license && <div><span className="font-medium">Лицензия:</span> {p.license}</div>}
                  <div><span className="font-medium">Статус:</span> {p.status}</div>
                  <button className="mt-2 rounded bg-forest-700 px-2 py-1 text-xs font-medium text-white hover:bg-forest-800" onClick={() => void handleCatalogOpen(p.species)}>Открыть в справочнике</button>
                  {p.observationUrl && <a className="text-blue-700 underline" href={p.observationUrl} target="_blank" rel="noreferrer">Открыть запись</a>}
                </div>
              </Popup>
            </CircleMarker>
          })}
          {showPredictions && visiblePredictions.map((point, index) => {
            const color = `hsl(${Math.round(point.probability * 120)}, 75%, 42%)`
            return <CircleMarker key={`prediction-${point.model}-${point.sampleId}-${index}`} center={[point.latitude, point.longitude]}
              radius={4 + point.probability * 7} pathOptions={{ color, fillColor: color, fillOpacity: 0.48, weight: 1.5, opacity: 0.9 }}>
              <Popup>
                <div className="space-y-1 text-sm"><strong>Technical demo prediction</strong>
                  <div><span className="font-medium">Модель:</span> {point.model === 'random_forest' ? 'Random Forest' : 'Logistic Regression'}</div>
                  <div><span className="font-medium">Вероятность:</span> {(point.probability * 100).toFixed(1)}%</div>
                  <div><span className="font-medium">Роль:</span> {point.sampleRole === 'presence_candidate' ? 'candidate presence' : 'background candidate'}</div>
                  <div><span className="font-medium">Вид:</span> {point.species ?? 'не указан для background'}</div>
                  <div><span className="font-medium">Spatial fold:</span> {point.foldId}</div>
                  <div className="text-xs text-amber-800">Это технический demo-результат. Background candidate не означает подтверждённое отсутствие.</div>
                </div>
              </Popup>
            </CircleMarker>
          })}
        </MapContainer>
        {!dataset && !error && <div className="absolute inset-0 z-[1000] grid place-items-center bg-white/80 text-sm text-gray-600">Загрузка occurrence points…</div>}
        {error && <div className="absolute inset-0 z-[1000] grid place-items-center bg-white/90 p-6 text-center text-sm text-red-700">Ошибка загрузки: {error}</div>}
        <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/95 p-3 text-xs shadow">
          <div className="mb-1 font-semibold">Наблюдения (не prediction)</div>
          {(Object.keys(sourceColors) as OccurrenceSource[]).map(s => <div key={s}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sourceColors[s] }} />{s}</div>)}
          {showPredictions && <><div className="mt-2 border-t border-gray-200 pt-2 font-semibold">Predicted probability</div><div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-green-600" />низкая</div><div><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-600" />высокая</div></>}
        </div>
      </div>
      {showPredictions && !predictions && !predictionError && <div className="text-xs text-gray-500">Загрузка predicted results…</div>}
      {predictionError && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{predictionError}</div>}
      {showPredictions && predictions && <div className="text-[11px] text-amber-800">Predicted results: {visiblePredictions.length.toLocaleString('ru-RU')} candidate points · technical demo only · model readiness blocked</div>}
      {dataset && yearRange && <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-[260px] flex-1">
            <div className="mb-2 flex justify-between text-xs font-medium text-gray-600"><span>Период наблюдений</span><span>{yearRange[0]}–{yearRange[1]}</span></div>
            <div className="relative h-8">
              <div className="absolute top-3 h-2 w-full rounded-full bg-gray-200" />
              <div className="absolute top-3 h-2 rounded-full bg-gradient-to-r from-forest-500 to-amber-500" style={{ left: `${((yearRange[0] - minYear) / Math.max(maxYear - minYear, 1)) * 100}%`, right: `${100 - ((yearRange[1] - minYear) / Math.max(maxYear - minYear, 1)) * 100}%` }} />
              <input aria-label="Начальный год периода" type="range" min={minYear} max={maxYear} value={yearRange[0]} onChange={event => setYearRange(current => current ? [Math.min(Number(event.target.value), current[1]), current[1]] : current)} className="pointer-events-none absolute inset-0 z-20 h-8 w-full appearance-none bg-transparent accent-forest-700 [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto" />
              <input aria-label="Конечный год периода" type="range" min={minYear} max={maxYear} value={yearRange[1]} onChange={event => setYearRange(current => current ? [current[0], Math.max(Number(event.target.value), current[0])] : current)} className="pointer-events-none absolute inset-0 z-10 h-8 w-full appearance-none bg-transparent accent-amber-600 [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto" />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400"><span>{minYear}</span><span>{maxYear}</span></div>
          </div>
        </div>
      </div>}
      {dataset && <div className="text-[11px] text-gray-500">Provenance: {dataset.metadata.provenance.map(p => p.sourceFile).join(' · ')} · {dataset.metadata.generatedAt} · {dataset.metadata.datasetStatus}</div>}
    </div>
  )
}
