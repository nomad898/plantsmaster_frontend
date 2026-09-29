import { useEffect, useMemo, useState } from 'react'
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { fetchTaxonomy, loadPlants, loadWikipediaTaxonomyInfo } from '../api'
import type { PlantBrief, TaxonomyGroupId, TaxonomyItem, TaxonomyWikipediaInfo } from '../types'

interface Props { onPlantSelect: (plant: PlantBrief) => void }
interface CatalogPlant extends PlantBrief { name_la: string; family: string }
type ViewMode = 'tree' | 'catalog' | 'graph'

const GROUPS: Record<TaxonomyGroupId, { label: string; wikiTitle: string }> = {
  ferns: { label: 'Папоротниковидные', wikiTitle: 'Fern' },
  horsetails: { label: 'Хвощевидные', wikiTitle: 'Equisetopsida' },
  gymnosperms: { label: 'Голосеменные', wikiTitle: 'Gymnosperm' },
  monocots: { label: 'Однодольные', wikiTitle: 'Monocot' },
  eudicots: { label: 'Эвдикоты / двудольные', wikiTitle: 'Eudicots' },
  'other-angiosperms': { label: 'Прочие покрытосеменные', wikiTitle: 'Angiosperm' },
  unknown: { label: 'Группа не определена', wikiTitle: 'Plant' },
}

const MONOCOT_FAMILIES = new Set(['Alismataceae', 'Alliaceae', 'Amaryllidaceae', 'Araceae', 'Asparagaceae', 'Convallariaceae', 'Cyperaceae', 'Dioscoreaceae', 'Iridaceae', 'Juncaceae', 'Liliaceae', 'Orchidaceae', 'Poaceae', 'Ruscaceae', 'Smilacaceae', 'Typhaceae'])
const FERN_FAMILIES = new Set(['Athyriaceae', 'Blechnaceae', 'Dryopteridaceae', 'Ophioglossaceae', 'Polypodiaceae', 'Pteridaceae', 'Salviniaceae', 'Thelypteridaceae'])
const HORSETAIL_FAMILIES = new Set(['Equisetaceae'])
const GYMNOSPERM_FAMILIES = new Set(['Cupressaceae', 'Ephedraceae', 'Ginkgoaceae', 'Pinaceae', 'Taxaceae'])

function groupForFamily(family: string): TaxonomyGroupId {
  if (MONOCOT_FAMILIES.has(family)) return 'monocots'
  if (FERN_FAMILIES.has(family)) return 'ferns'
  if (HORSETAIL_FAMILIES.has(family)) return 'horsetails'
  if (GYMNOSPERM_FAMILIES.has(family)) return 'gymnosperms'
  if (!family || family === 'Unknown') return 'unknown'
  return 'eudicots'
}

export default function TaxonomyTree({ onPlantSelect }: Props) {
  const [taxa, setTaxa] = useState<TaxonomyItem[]>([])
  const [plants, setPlants] = useState<CatalogPlant[]>([])
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set())
  const [expandedGenera, setExpandedGenera] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [selectedGroup, setSelectedGroup] = useState<TaxonomyGroupId>('monocots')
  const [wikiInfo, setWikiInfo] = useState<TaxonomyWikipediaInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchTaxonomy(), loadPlants()]).then(([familyData, catalog]) => {
      setTaxa(familyData)
      setPlants(catalog as CatalogPlant[])
    }).finally(() => setLoading(false))
  }, [])

  const families = useMemo(() => {
    const grouped = new Map<string, CatalogPlant[]>()
    plants.forEach(plant => {
      const family = plant.family || 'Unknown'
      grouped.set(family, [...(grouped.get(family) ?? []), plant])
    })
    return [...grouped.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [plants])

  const groupedFamilies = useMemo(() => {
    const grouped = new Map<TaxonomyGroupId, Array<[string, CatalogPlant[]]>>()
    families.forEach(entry => {
      const group = groupForFamily(entry[0])
      grouped.set(group, [...(grouped.get(group) ?? []), entry])
    })
    return grouped
  }, [families])

  useEffect(() => {
    setWikiInfo(null)
    void loadWikipediaTaxonomyInfo(GROUPS[selectedGroup].wikiTitle).then(setWikiInfo)
  }, [selectedGroup])

  const graph = useMemo(() => {
    const groupEntries = [...groupedFamilies.entries()]
    const nodes: Node[] = [{ id: 'plantae', position: { x: 600, y: 0 }, data: { label: 'Plantae' }, style: { background: '#14532d', color: 'white', borderRadius: 10, padding: 12, fontWeight: 700 } }]
    const edges: Edge[] = []
    groupEntries.forEach(([group, groupFamilies], groupIndex) => {
      const x = groupIndex * 230
      nodes.push({ id: `group-${group}`, position: { x, y: 100 }, data: { label: `${GROUPS[group].label} (${groupFamilies.reduce((sum, [, values]) => sum + values.length, 0)})` }, style: { background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, width: 190, padding: 8, fontSize: 11 } })
      edges.push({ id: `edge-plantae-${group}`, source: 'plantae', target: `group-${group}` })
      groupFamilies.forEach(([family, familyPlants], familyIndex) => {
        const familyId = `family-${group}-${family}`
        nodes.push({ id: familyId, position: { x: x + (familyIndex % 2) * 100, y: 190 + Math.floor(familyIndex / 2) * 72 }, data: { label: `${family} (${familyPlants.length})` }, style: { background: 'white', border: '1px solid #d1d5db', borderRadius: 6, width: 92, padding: 6, fontSize: 10 } })
        edges.push({ id: `edge-${group}-${family}`, source: `group-${group}`, target: familyId })
      })
    })
    return { nodes, edges }
  }, [groupedFamilies])

  const toggle = (setter: (update: (current: Set<string>) => Set<string>) => void, key: string) => setter(current => {
    const next = new Set(current)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  if (loading) return <p className="py-12 text-center text-sm text-gray-400">Загрузка таксономии…</p>

  return <section className="h-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-5">
    <div className="mb-5 border-b border-gray-100 pb-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Иерархия каталога</p>
      <h2 className="mt-1 text-2xl font-bold text-forest-900">Plantae</h2>
      <p className="mt-1 text-sm text-gray-500">Крупная группа → семейство → род → вид. Классификация групп предварительная.</p>
      <p className="mt-2 text-xs text-amber-700">Википедия используется только для внешних справочных метаданных. Группы и accepted names требуют проверки по авторитетному backbone.</p>
    </div>
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Вид таксономии">
      <button role="tab" aria-selected={viewMode === 'tree'} onClick={() => setViewMode('tree')} className={`rounded-md px-3 py-1.5 text-sm ${viewMode === 'tree' ? 'bg-white font-semibold text-forest-800 shadow-sm' : 'text-gray-500'}`}>Дерево</button>
      <button role="tab" aria-selected={viewMode === 'catalog'} onClick={() => setViewMode('catalog')} className={`rounded-md px-3 py-1.5 text-sm ${viewMode === 'catalog' ? 'bg-white font-semibold text-forest-800 shadow-sm' : 'text-gray-500'}`}>Список семейств</button>
      <button role="tab" aria-selected={viewMode === 'graph'} onClick={() => setViewMode('graph')} className={`rounded-md px-3 py-1.5 text-sm ${viewMode === 'graph' ? 'bg-white font-semibold text-forest-800 shadow-sm' : 'text-gray-500'}`}>Граф</button>
    </div>
    {viewMode === 'graph' && <div className="space-y-3">
      <div className="h-[560px] overflow-hidden rounded-lg border border-gray-200">
        <ReactFlow nodes={graph.nodes} edges={graph.edges} fitView onNodeClick={(_, node) => {
          if (node.id.startsWith('group-')) setSelectedGroup(node.id.replace('group-', '') as TaxonomyGroupId)
        }}>
          <MiniMap />
          <Controls />
          <Background gap={18} size={1} />
        </ReactFlow>
      </div>
      {wikiInfo && <WikipediaPanel info={wikiInfo} group={GROUPS[selectedGroup].label} />}
    </div>}
    {viewMode === 'catalog' && <div className="grid gap-3 md:grid-cols-2">
      {families.map(([family, familyPlants]) => <div key={family} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <div className="flex items-center justify-between"><strong className="text-forest-800">{family}</strong><span className="text-xs text-gray-500">{familyPlants.length} видов</span></div>
        <div className="mt-2 flex flex-wrap gap-1.5">{[...new Set(familyPlants.map(plant => plant.name_la.split(' ')[0]))].sort().map(genus => <span key={genus} className="rounded-full bg-white px-2 py-1 text-xs text-gray-600">{genus}</span>)}</div>
      </div>)}
    </div>}
    {viewMode === 'tree' && <div className="space-y-2">
      {families.map(([family, familyPlants]) => {
        const familyTaxon = taxa.find(item => item.name_la === family)
        const genera = [...new Set(familyPlants.map(plant => plant.name_la.split(' ')[0]))].sort()
        return <div key={family} className="border-l-2 border-forest-200 pl-3">
          <button className="flex w-full items-center justify-between rounded-lg bg-forest-50 px-3 py-2 text-left hover:bg-forest-100" onClick={() => toggle(setExpandedFamilies, family)}><span><span className="mr-2 text-forest-700">{expandedFamilies.has(family) ? '▾' : '▸'}</span><strong>{family}</strong></span><span className="text-xs text-gray-500">{familyTaxon?.plant_count ?? familyPlants.length} видов</span></button>
          {expandedFamilies.has(family) && <div className="mt-1 space-y-1 pl-4">{genera.map(genus => {
            const genusPlants = familyPlants.filter(plant => plant.name_la.split(' ')[0] === genus)
            const genusKey = `${family}:${genus}`
            return <div key={genusKey}><button className="flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50" onClick={() => toggle(setExpandedGenera, genusKey)}><span><span className="mr-2 text-gray-400">{expandedGenera.has(genusKey) ? '▾' : '▸'}</span><em>{genus}</em></span><span className="text-xs text-gray-400">{genusPlants.length}</span></button>{expandedGenera.has(genusKey) && <div className="ml-5 space-y-1 border-l border-gray-200 pl-3">{[...genusPlants].sort((a, b) => a.name_la.localeCompare(b.name_la)).map(plant => <button key={plant.id} className="block w-full rounded px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-800" onClick={() => onPlantSelect(plant)}>{plant.name_la}</button>)}</div>}</div>
          })}</div>}
  </div>
  })}
  </div>}
  </section>
}

function WikipediaPanel({ info, group }: { info: TaxonomyWikipediaInfo; group: string }) {
  return <aside className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><div className="flex items-center justify-between gap-3"><strong>{group}</strong><a className="text-xs text-blue-700 underline" href={info.url} target="_blank" rel="noreferrer">Wikipedia</a></div>{info.extract && <p className="mt-2 leading-6">{info.extract}</p>}<p className="mt-2 text-[11px] text-amber-800">{info.notice}</p></aside>
}
