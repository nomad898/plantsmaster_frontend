export interface NamedItem { id?: number; name: string }
export interface ApplicationItem { id?: number; code: string; name_full?: string }
export interface TaxonomyItem { id: number; name_la: string; path?: string; plant_count: number }

export interface PlantBrief {
  id: number
  name_la: string
  name_la_author?: string
  name_ru?: string
  name_kz?: string
  life_form?: string
  family?: string
}

export interface PlantDetail extends PlantBrief {
  distribution_text?: string
  notes?: string
  raw_materials: NamedItem[]
  compounds: NamedItem[]
  properties: NamedItem[]
  applications: ApplicationItem[]
}

export interface PagedPlants {
  items: PlantBrief[]
  total: number
  page: number
  limit: number
}

export interface PlantFilters {
  family?: string
  application?: string
  life_form?: string
  q?: string
  page: number
  limit: number
}
