export interface NamedItem { id?: number; name: string }
export interface ApplicationItem { id?: number; code: string; name_full?: string }
export interface TaxonomyItem { id: number; name_la: string; path?: string; plant_count: number }

export type TaxonomyGroupId = 'ferns' | 'horsetails' | 'gymnosperms' | 'monocots' | 'eudicots' | 'other-angiosperms' | 'unknown'

export interface TaxonomyWikipediaInfo {
  title: string
  extract?: string
  url: string
  notice: string
}

export interface LocalPlantImage {
  plantId: number
  scientificName: string
  localUrl: string
  sourceUrl: string
  source: 'Wikipedia'
  retrievedAt: string
  license?: string
}

export interface PlantBrief {
  id: number
  name_la: string
  name_la_author?: string
  name_ru?: string
  name_kz?: string
  life_form?: string
  family?: string
}

export interface CatalogExternalReference {
  wikipediaUrl: string
  wikimediaSearchUrl: string
  notice: string
  title?: string
  extract?: string
  thumbnailUrl?: string
}

export interface PlantDetail extends PlantBrief {
  distribution_text?: string
  notes?: string
  raw_materials: NamedItem[]
  compounds: NamedItem[]
  properties: NamedItem[]
  applications: ApplicationItem[]
  validation: {
    status: 'complete' | 'needs_review'
    flags: string[]
  }
  externalReference?: CatalogExternalReference
}

export interface PagedPlants {
  items: PlantBrief[]
  total: number
  page: number
  limit: number
}

export interface PlantFilters {
  family?: string
  life_form?: string
  raw_materials: string[]
  compounds: string[]
  properties: string[]
  applications: string[]
  locations: string[]
  q?: string
  page: number
  limit: number
}

export type OccurrenceSource = 'GBIF' | 'iNaturalist'

export interface OccurrenceProperties {
  id: string
  source: OccurrenceSource
  species: string
  observedDate?: string | null
  datePrecision?: string | null
  year?: number | null
  locality?: string | null
  latitude?: number | null
  longitude?: number | null
  coordinateUncertaintyMeters?: number | null
  datum?: string | null
  quality?: string | null
  license?: string | null
  eligibility?: string | null
  sourceFile: string
  status: 'primary provisional'
  observationUrl?: string | null
}

export interface OccurrenceFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: OccurrenceProperties
}

export interface OccurrenceDataset {
  type: 'FeatureCollection'
  metadata: {
    datasetStatus: string
    region: string
    generatedAt: string
    provenance: Array<{ sourceFile: string; sourceDate: string; status: string; source: string }>
    notes: string
  }
  features: OccurrenceFeature[]
}

export type DemoPredictionModel = 'logistic_regression' | 'random_forest'

export interface DemoPrediction {
  sampleId: string
  foldId: string
  target: 0 | 1
  model: DemoPredictionModel
  probability: number
  label: 0 | 1
  longitude: number
  latitude: number
  species: string | null
  sampleRole: 'presence_candidate' | 'background_candidate'
  status: 'technical_demo_only'
}

export type RejectedReason = 'outside_candidate_almaty_region' | 'missing_coordinates' | 'missing_or_invalid_date' | 'before_1980' | 'sensitivity_only' | 'other_source_rejection'

export interface RejectedOccurrence {
  id: string
  source: OccurrenceSource
  species: string
  observedDate: string | null
  year: number | null
  locality: string | null
  reason: RejectedReason
  reasonDetail: string
  sourceFile: string
  raw: Record<string, string>
}

export interface RejectedDataset {
  records: RejectedOccurrence[]
  sourceFiles: string[]
  generatedAt: string
  notes: string
}
