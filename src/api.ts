/**
 * Static data layer — replaces backend API calls with in-memory JSON.
 * plants.json is loaded once at startup (~1.3 MB, ~1371 plants).
 */
import Fuse from 'fuse.js'
import type { PlantDetail, PlantBrief, PagedPlants, TaxonomyItem, PlantFilters, OccurrenceDataset, OccurrenceFeature, OccurrenceSource, TaxonomyWikipediaInfo, LocalPlantImage, RejectedDataset, RejectedOccurrence, RejectedReason, DemoPrediction, DemoPredictionModel } from './types'

interface RawPlant {
  id: number
  name_la: string
  name_la_author: string
  name_kz: string
  name_ru: string
  family: string
  life_form: string
  distribution_text: string
  raw_materials: string[]
  compounds: string[]
  properties: string[]
  applications: string[]
  notes: string
}

interface FilterOptions {
  raw_materials: string[]
  compounds: string[]
  properties: string[]
  applications: string[]
  locations: string[]
}

// ── Singleton loaders ─────────────────────────────────────────────────────────

let _plants: RawPlant[] | null = null
let _plantsPromise: Promise<RawPlant[]> | null = null
let _taxonomyPromise: Promise<TaxonomyItem[]> | null = null
let _fuse: Fuse<RawPlant> | null = null
let _localImageManifest: Record<string, LocalPlantImage> | null = null
let _localImageManifestPromise: Promise<Record<string, LocalPlantImage>> | null = null
const wikipediaCacheName = 'plantsmaster-wikipedia-v1'
const wikipediaImageUrls = new Map<string, Promise<string | undefined>>()

export function loadPlants(): Promise<RawPlant[]> {
  if (_plants) return Promise.resolve(_plants)
  if (!_plantsPromise) {
    _plantsPromise = fetch('./plants.json')
      .then(r => r.json())
      .then((data: RawPlant[]) => {
        _plants = data
        _fuse = new Fuse(data, {
          keys: [
            'name_la',
            'name_ru',
            'name_kz',
            'compounds',
            'properties',
            'applications',
            'distribution_text',
          ],
          threshold: 0.35,
          minMatchCharLength: 2,
        })
        return data
      })
  }
  return _plantsPromise
}

function loadTaxonomy(): Promise<TaxonomyItem[]> {
  if (!_taxonomyPromise) {
    _taxonomyPromise = fetch('./taxonomy.json').then(r => r.json())
  }
  return _taxonomyPromise
}

export async function loadWikipediaTaxonomyInfo(title: string): Promise<TaxonomyWikipediaInfo> {
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`
  const reference: TaxonomyWikipediaInfo = {
    title,
    url,
    notice: 'Внешние метаданные Википедии. Не являются утверждённой таксономической ревизией проекта.',
  }
  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`)
    if (!response.ok) return reference
    const data = await response.json() as { title?: string; extract?: string }
    return { ...reference, title: data.title ?? title, extract: data.extract }
  } catch {
    return reference
  }
}

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeTags(values: string[]): string[] {
  return [...new Set(values.map(normalizeTag).filter(Boolean))]
}

// ── Filter options extraction ──────────────────────────────────────────────────

export async function getFilterOptions(): Promise<FilterOptions> {
  const plants = await loadPlants()

  const compounds = new Set<string>()
  const properties = new Set<string>()
  const applications = new Set<string>()
  const locations = new Set<string>()
  const raw_materials = new Set<string>()

  plants.forEach(p => {
    normalizeTags(p.raw_materials).forEach(c => raw_materials.add(c))
    normalizeTags(p.compounds).forEach(c => compounds.add(c))
    normalizeTags(p.properties).forEach(pr => properties.add(pr))
    normalizeTags(p.applications).forEach(a => applications.add(a))

    // Extract locations from distribution_text (split by comma)
    if (p.distribution_text) {
      const parts = p.distribution_text.split(',').map(s => s.trim())
      parts.forEach(part => {
        if (part.length > 2) locations.add(part)
      })
    }
  })

  return {
    raw_materials: Array.from(raw_materials).sort(),
    compounds: Array.from(compounds).sort(),
    properties: Array.from(properties).sort(),
    applications: Array.from(applications).sort(),
    locations: Array.from(locations).sort(),
  }
}

// ── Converters ────────────────────────────────────────────────────────────────

function toDetail(p: RawPlant, catalog: RawPlant[]): PlantDetail {
  const flags: string[] = []
  if (!p.raw_materials.length) flags.push('сырьё не указано')
  if (!p.compounds.length) flags.push('состав не указан')
  if (!p.properties.length) flags.push('свойства не указаны')
  if (!p.applications.length) flags.push('применение не указано')
  if (catalog.filter(candidate => normalizeTag(candidate.name_la).toLowerCase() === normalizeTag(p.name_la).toLowerCase()).length > 1) {
    flags.push('повторяющееся латинское имя в локальном каталоге')
  }
  return {
    id: p.id,
    name_la: p.name_la,
    name_la_author: p.name_la_author,
    name_kz: p.name_kz,
    name_ru: p.name_ru,
    family: p.family,
    life_form: p.life_form,
    distribution_text: p.distribution_text,
    notes: p.notes,
    raw_materials: normalizeTags(p.raw_materials).map(name => ({ name })),
    compounds: normalizeTags(p.compounds).map(name => ({ name })),
    properties: normalizeTags(p.properties).map(name => ({ name })),
    applications: normalizeTags(p.applications).map(code => ({ code })),
    validation: { status: flags.length ? 'needs_review' : 'complete', flags },
    externalReference: {
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.name_la.replace(/\s+/g, '_'))}`,
      wikimediaSearchUrl: `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(p.name_la)}&title=Special:MediaSearch&type=image`,
      notice: 'Внешняя справочная ссылка. Содержимое не прошло научную верификацию проекта.',
    },
  }
}

function toBrief(p: RawPlant): PlantBrief {
  return {
    id: p.id,
    name_la: p.name_la,
    name_kz: p.name_kz,
    name_ru: p.name_ru,
    family: p.family,
    life_form: p.life_form,
  }
}

// ── Public API (matches original api.ts signatures exactly) ───────────────────

export async function fetchPlants(filters: PlantFilters): Promise<PagedPlants> {
  const plants = await loadPlants()
  const { page = 1, limit = 20, q, family, life_form, raw_materials = [], compounds = [], properties = [], applications = [], locations = [] } = filters

  let results = plants

  // Full-text search (Fuse.js)
  if (q && q.trim().length >= 2) {
    results = _fuse!.search(q.trim()).map(r => r.item)
  }

  // Family filter
  if (family) {
    results = results.filter(p => p.family === family)
  }

  // Life form filter
  if (life_form) {
    results = results.filter(p => p.life_form === life_form)
  }

  // Multi-compound filter (OR within compounds, but AND across filter groups)
  if (compounds.length > 0) {
    results = results.filter(p => compounds.some(c => normalizeTags(p.compounds).includes(c)))
  }

  if (properties.length > 0) {
    results = results.filter(p => properties.some(property => normalizeTags(p.properties).includes(property)))
  }

  // Multi-application filter (OR within applications)
  if (applications.length > 0) {
    results = results.filter(p => applications.some(a => normalizeTags(p.applications).includes(a)))
  }

  if (raw_materials.length > 0) {
    results = results.filter(p => raw_materials.some(material => normalizeTags(p.raw_materials).includes(material)))
  }

  // Multi-location filter (OR within locations)
  if (locations.length > 0) {
    results = results.filter(p => locations.some(loc => p.distribution_text?.includes(loc)))
  }

  const total = results.length
  const start = (page - 1) * limit
  const items = results.slice(start, start + limit).map(toBrief)

  return { items, total, page, limit }
}

export async function fetchPlant(id: number): Promise<PlantDetail> {
  const plants = await loadPlants()
  const plant = plants.find(p => p.id === id)
  if (!plant) throw new Error(`Plant ${id} not found`)
  return toDetail(plant, plants)
}

export async function searchPlants(q: string, limit = 8): Promise<PlantBrief[]> {
  if (!q.trim()) return []
  await loadPlants()
  if (!_fuse) return []
  return _fuse.search(q.trim(), { limit }).map(r => toBrief(r.item))
}

export async function findPlantForOccurrence(species: string): Promise<PlantBrief | null> {
  const canonical = species.trim().replace(/\s+/g, ' ').replace(/\s+(?:subsp\.|var\.|f\.).*$/i, '')
  const plants = await loadPlants()
  const matches = plants.filter(plant => {
    const name = plant.name_la.trim().replace(/\s+/g, ' ')
    return name.toLowerCase() === canonical.toLowerCase() || `${name} ${plant.name_la_author}`.trim().toLowerCase() === species.trim().toLowerCase()
  })
  return matches.length === 1 ? toBrief(matches[0]) : null
}

export async function loadExternalPlantInfo(plant: PlantBrief): Promise<PlantDetail['externalReference']> {
  const reference = {
    wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(plant.name_la.replace(/\s+/g, '_'))}`,
    wikimediaSearchUrl: `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(plant.name_la)}&title=Special:MediaSearch&type=image`,
    notice: 'Внешняя справочная ссылка. Содержимое не прошло научную верификацию проекта.',
  }
  const localImage = await loadLocalPlantImage(plant.id)
  if (localImage) return { ...reference, thumbnailUrl: localImage.localUrl }
  try {
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(plant.name_la.replace(/\s+/g, '_'))}`
    const response = await fetchCached(summaryUrl)
    if (!response.ok) return reference
    const data = await response.json() as { title?: string; extract?: string; thumbnail?: { source?: string } }
    const thumbnailUrl = data.thumbnail?.source ? await cacheWikipediaImage(data.thumbnail.source, plant.id) : undefined
    return { ...reference, title: data.title, extract: data.extract, thumbnailUrl }
  } catch {
    return reference
  }
}

async function fetchCached(url: string): Promise<Response> {
  if (!('caches' in window)) return fetch(url)
  const cache = await caches.open(wikipediaCacheName)
  const cached = await cache.match(url)
  if (cached) return cached
  const response = await fetch(url)
  if (response.ok) await cache.put(url, response.clone())
  return response
}

async function cacheWikipediaImage(url: string, _plantId: number): Promise<string | undefined> {
  const existing = wikipediaImageUrls.get(url)
  if (existing) return existing

  const pending = (async () => {
    if (!('caches' in window)) return url
    const cache = await caches.open(wikipediaCacheName)
    let response = await cache.match(url)
    if (!response) {
      response = await fetch(url)
      if (!response.ok) return undefined
      await cache.put(url, response.clone())
    }
    const blob = await response.blob()
    return blob.size > 0 ? URL.createObjectURL(blob) : url
  })().catch(() => undefined)

  wikipediaImageUrls.set(url, pending)
  return pending
}

async function loadLocalPlantImage(plantId: number): Promise<LocalPlantImage | null> {
  if (!_localImageManifestPromise) {
    _localImageManifestPromise = fetch('./images/plants/manifest.json')
      .then(response => response.ok ? response.json() as Promise<Record<string, LocalPlantImage>> : {})
      .catch(() => ({}))
  }
  _localImageManifest = await _localImageManifestPromise
  return _localImageManifest[String(plantId)] ?? null
}

export async function fetchTaxonomy(): Promise<TaxonomyItem[]> {
  return loadTaxonomy()
}

export async function fetchGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  const response = await fetch('./occurrences.json')
  if (!response.ok) throw new Error(`Occurrence dataset unavailable (${response.status})`)
  return response.json() as Promise<OccurrenceDataset>
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const next = text[index + 1]
    if (character === '"' && quoted && next === '"') {
      field += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1
      row.push(field)
      if (row.some(value => value !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  const headers = rows.shift() ?? []
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

function numberOrNull(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function occurrenceYear(row: Record<string, string>): number | null {
  const normalizedYear = row.normalized_date?.match(/^(\d{4})-/)?.[1]
  if (normalizedYear) return Number(normalizedYear)
  const sourceYear = row.year?.match(/^(\d{4})(?:\.0+)?$/)?.[1]
  return sourceYear ? Number(sourceYear) : null
}

function rejectedReason(row: Record<string, string>, year: number | null): { reason: RejectedReason; detail: string } {
  if (row.spatial_rejection_reason) {
    const detail = row.spatial_rejection_reason
    return { reason: detail === 'outside_candidate_almaty_region' ? 'outside_candidate_almaty_region' : 'other_source_rejection', detail }
  }
  if (!row.latitude?.trim() || !row.longitude?.trim() || numberOrNull(row.latitude) === null || numberOrNull(row.longitude) === null) {
    return { reason: 'missing_coordinates', detail: 'latitude или longitude отсутствует либо не является числом' }
  }
  if (year === null) return { reason: 'missing_or_invalid_date', detail: 'Дата отсутствует или не распознана' }
  return { reason: 'before_1980', detail: `Год наблюдения ${year} меньше 1980` }
}

function sensitivityReason(): { reason: RejectedReason; detail: string } {
  return { reason: 'sensitivity_only', detail: 'Отдельный 10 km sensitivity output; не смешивается с primary dataset' }
}

function toRejectedOccurrence(row: Record<string, string>, source: OccurrenceSource, sourceFile: string, forcedReason?: { reason: RejectedReason; detail: string }): RejectedOccurrence {
  const year = occurrenceYear(row)
  const rejection = forcedReason ?? rejectedReason(row, year)
  return {
    id: source === 'GBIF' ? row.gbif_key || row.occurrence_id || 'unknown' : row.inat_id || row.uri || 'unknown',
    source,
    species: row.species_accepted || row.species_name || row.query_species || 'Неизвестный вид',
    observedDate: row.normalized_date || row.event_date || row.observed_on || null,
    year,
    locality: row.locality || row.place_guess || null,
    reason: rejection.reason,
    reasonDetail: rejection.detail,
    sourceFile,
    raw: row,
  }
}

async function loadOccurrenceCsv(path: string, source: OccurrenceSource): Promise<OccurrenceFeature[]> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Occurrence CSV unavailable (${response.status}): ${path}`)
  const rows = parseCsv(await response.text())
  return rows.flatMap(row => {
    const latitude = numberOrNull(row.latitude)
    const longitude = numberOrNull(row.longitude)
    if (latitude === null || longitude === null) return []
    const id = source === 'GBIF' ? row.gbif_key : row.inat_id
    const observedDate = row.normalized_date || row.event_date || row.observed_on || null
    return [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
      properties: {
        id,
        source,
        species: row.species_accepted || row.species_name || row.query_species,
        observedDate,
        datePrecision: row.date_precision || null,
        year: occurrenceYear(row),
        locality: row.locality || row.place_guess || null,
        latitude,
        longitude,
        coordinateUncertaintyMeters: numberOrNull(row.coordinate_uncertainty_m || row.positional_accuracy_m),
        datum: row.geodetic_datum || null,
        quality: row.quality_grade || row.basis_of_record || null,
        license: row.license || row.license_code || null,
        eligibility: row.species_level_eligibility || null,
        sourceFile: row.source_file,
        status: 'primary provisional',
        observationUrl: row.occurrence_id || row.uri || null,
      },
    }]
  })
}

/** Loads only primary provisional occurrence points from the bundled CSV inputs. */
export async function loadOccurrences(): Promise<OccurrenceDataset> {
  const [gbif, iNaturalist] = await Promise.all([
    loadOccurrenceCsv('./data/interim/gbif_occurrences_candidate_almaty_2026-09-14_primary_dates_normalized.csv', 'GBIF'),
    loadOccurrenceCsv('./data/interim/inat_occurrences_candidate_almaty_2026-09-14_primary_dates_normalized.csv', 'iNaturalist'),
  ])
  const filteredFeatures = [...gbif, ...iNaturalist].filter(feature => {
    const year = feature.properties.year
    return year !== null && year !== undefined && year >= 1980
  })
  return {
    type: 'FeatureCollection',
    metadata: {
      datasetStatus: 'primary provisional; CSV-backed; not model-ready',
      region: 'Candidate Almaty pilot boundary',
      generatedAt: '2026-09-14',
      provenance: [
        { sourceFile: 'data/interim/gbif_occurrences_candidate_almaty_2026-09-14_primary_dates_normalized.csv', sourceDate: '2026-09-14', status: 'primary provisional', source: 'GBIF' },
        { sourceFile: 'data/interim/inat_occurrences_candidate_almaty_2026-09-14_primary_dates_normalized.csv', sourceDate: '2026-09-14', status: 'primary provisional', source: 'iNaturalist' },
      ],
      notes: 'Observed records only. Rejected and sensitivity outputs are excluded. Frontend display excludes undated records and records before 1980; source CSVs remain unchanged. No periods, modeled surfaces, or migration metrics are computed in the frontend.',
    },
    features: filteredFeatures,
  }
}

/** Loads technical-only model probabilities for the candidate sample points. */
export async function loadDemoPredictions(model: DemoPredictionModel): Promise<DemoPrediction[]> {
  const response = await fetch('./data/interim/demo_model_predictions_candidate_2026-09-29.csv')
  if (!response.ok) throw new Error(`Prediction CSV unavailable (${response.status})`)
  const predictionRows = parseCsv(await response.text()).filter(row => row.model === model)
  const trainingResponse = await fetch('./data/interim/demo_training_dataset_candidate_2026-09-29.csv')
  if (!trainingResponse.ok) throw new Error(`Training sample CSV unavailable (${trainingResponse.status})`)
  const trainingRows = new Map(parseCsv(await trainingResponse.text()).map(row => [row.sample_id, row]))
  return predictionRows.flatMap(row => {
    const training = trainingRows.get(row.sample_id)
    const longitude = numberOrNull(training?.longitude)
    const latitude = numberOrNull(training?.latitude)
    const probability = Number(row.prediction_probability)
    if (longitude === null || latitude === null || !Number.isFinite(probability)) return []
    return [{
      sampleId: row.sample_id,
      foldId: row.fold_id,
      target: row.target === '1' ? 1 : 0,
      model,
      probability,
      label: row.prediction_label_at_0_5 === '1' ? 1 : 0,
      longitude,
      latitude,
      species: training?.species || null,
      sampleRole: training?.sample_role === 'presence_candidate' ? 'presence_candidate' : 'background_candidate',
      status: 'technical_demo_only',
    }]
  })
}

/** Loads every source-rejected row plus rows excluded by the frontend date/coordinate filter. */
export async function loadRejectedOccurrences(): Promise<RejectedDataset> {
  const sources: Array<{ source: OccurrenceSource; primary: string; rejected: string; sensitivity: string }> = [
    { source: 'GBIF', primary: './data/interim/gbif_occurrences_candidate_almaty_2026-09-14_primary_dates_normalized.csv', rejected: './data/interim/gbif_occurrences_candidate_almaty_2026-09-14_rejected.csv', sensitivity: './data/interim/gbif_occurrences_candidate_almaty_2026-09-14_sensitivity_10km.csv' },
    { source: 'iNaturalist', primary: './data/interim/inat_occurrences_candidate_almaty_2026-09-14_primary_dates_normalized.csv', rejected: './data/interim/inat_occurrences_candidate_almaty_2026-09-14_rejected.csv', sensitivity: './data/interim/inat_occurrences_candidate_almaty_2026-09-14_sensitivity_10km.csv' },
  ]
  const records: RejectedOccurrence[] = []
  for (const item of sources) {
    const rejectedResponse = await fetch(item.rejected)
    if (rejectedResponse.ok) {
      const rows = parseCsv(await rejectedResponse.text())
      rows.forEach(row => records.push(toRejectedOccurrence(row, item.source, item.rejected, rejectedReason(row, occurrenceYear(row)))))
    }
    const sensitivityResponse = await fetch(item.sensitivity)
    if (sensitivityResponse.ok) {
      const rows = parseCsv(await sensitivityResponse.text())
      rows.forEach(row => records.push(toRejectedOccurrence(row, item.source, item.sensitivity, sensitivityReason())))
    }
    const primaryResponse = await fetch(item.primary)
    if (!primaryResponse.ok) continue
    const rows = parseCsv(await primaryResponse.text())
    rows.forEach(row => {
      const year = occurrenceYear(row)
      const hasCoordinates = numberOrNull(row.latitude) !== null && numberOrNull(row.longitude) !== null
      if (!hasCoordinates || year === null || year < 1980) {
        records.push(toRejectedOccurrence(row, item.source, item.primary))
      }
    })
  }
  return {
    records,
    sourceFiles: sources.flatMap(item => [item.primary, item.rejected, item.sensitivity]),
    generatedAt: '2026-09-14',
    notes: 'Rejected rows are preserved for audit. They are not silently deleted and must not enter the primary map without a documented review decision.',
  }
}
