/**
 * Static data layer — replaces backend API calls with in-memory JSON.
 * plants.json is loaded once at startup (~1.3 MB, ~1371 plants).
 */
import Fuse from 'fuse.js'
import type { PlantDetail, PlantBrief, PagedPlants, TaxonomyItem, PlantFilters } from './types'

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

// ── Filter options extraction ──────────────────────────────────────────────────

export async function getFilterOptions(): Promise<FilterOptions> {
  const plants = await loadPlants()

  const compounds = new Set<string>()
  const properties = new Set<string>()
  const applications = new Set<string>()
  const locations = new Set<string>()

  plants.forEach(p => {
    p.compounds.forEach(c => compounds.add(c))
    p.properties.forEach(pr => properties.add(pr))
    p.applications.forEach(a => applications.add(a))

    // Extract locations from distribution_text (split by comma)
    if (p.distribution_text) {
      const parts = p.distribution_text.split(',').map(s => s.trim())
      parts.forEach(part => {
        if (part.length > 2) locations.add(part)
      })
    }
  })

  return {
    compounds: Array.from(compounds).sort(),
    properties: Array.from(properties).sort(),
    applications: Array.from(applications).sort(),
    locations: Array.from(locations).sort(),
  }
}

// ── Converters ────────────────────────────────────────────────────────────────

function toDetail(p: RawPlant): PlantDetail {
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
    raw_materials: p.raw_materials.map(name => ({ name })),
    compounds: p.compounds.map(name => ({ name })),
    properties: p.properties.map(name => ({ name })),
    applications: p.applications.map(code => ({ code })),
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
  const { page = 1, limit = 20, q, family, life_form, compounds = [], applications = [], locations = [] } = filters

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
    results = results.filter(p => compounds.some(c => p.compounds.includes(c)))
  }

  // Multi-application filter (OR within applications)
  if (applications.length > 0) {
    results = results.filter(p => applications.some(a => p.applications.includes(a)))
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
  return toDetail(plant)
}

export async function searchPlants(q: string, limit = 8): Promise<PlantBrief[]> {
  if (!q.trim()) return []
  await loadPlants()
  if (!_fuse) return []
  return _fuse.search(q.trim(), { limit }).map(r => toBrief(r.item))
}

export async function fetchTaxonomy(): Promise<TaxonomyItem[]> {
  return loadTaxonomy()
}

export async function fetchGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  return { type: 'FeatureCollection', features: [] }
}
