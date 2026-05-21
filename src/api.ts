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

// ── Singleton loaders ─────────────────────────────────────────────────────────

let _plantsPromise: Promise<RawPlant[]> | null = null
let _taxonomyPromise: Promise<TaxonomyItem[]> | null = null
let _fuse: Fuse<RawPlant> | null = null

function loadPlants(): Promise<RawPlant[]> {
  if (!_plantsPromise) {
    _plantsPromise = fetch('./plants.json')
      .then(r => r.json())
      .then((data: RawPlant[]) => {
        _fuse = new Fuse(data, {
          keys: ['name_la', 'name_ru', 'name_kz'],
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
  const all = await loadPlants()
  const { page = 1, limit = 20, q, family, application, life_form } = filters

  let results = all

  if (q && q.trim().length >= 2) {
    results = _fuse!.search(q.trim()).map(r => r.item)
  }

  if (family) {
    results = results.filter(p => p.family === family)
  }
  if (application) {
    results = results.filter(p => p.applications.includes(application))
  }
  if (life_form) {
    results = results.filter(p => p.life_form === life_form)
  }

  const total = results.length
  const start = (page - 1) * limit
  const items = results.slice(start, start + limit).map(toBrief)

  return { items, total, page, limit }
}

export async function fetchPlant(id: number): Promise<PlantDetail> {
  const all = await loadPlants()
  const plant = all.find(p => p.id === id)
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
