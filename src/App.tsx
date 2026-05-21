import { useState } from 'react'
import Omnibox from './components/Omnibox'
import PlantList from './components/PlantList'
import PlantDetail from './components/PlantDetail'
import TaxonomyTree from './components/TaxonomyTree'
import MapView from './components/MapView'
import type { PlantBrief } from './types'

type Tab = 'search' | 'taxonomy' | 'map'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'search',   label: 'Поиск',      icon: '🔍' },
  { id: 'taxonomy', label: 'Таксономия', icon: '🌳' },
  { id: 'map',      label: 'Карта',      icon: '🗺️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('search')
  const [selectedPlant, setSelectedPlant] = useState<PlantBrief | null>(null)
  const [familyFilter, setFamilyFilter] = useState<string | undefined>()

  const handleFamilySelect = (family: string) => {
    setFamilyFilter(family)
    setTab('search')
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🌿</span>
          <div>
            <h1 className="text-base font-bold text-forest-800 leading-tight">PlantsMaster</h1>
            <p className="text-xs text-gray-400">Лекарственные растения Казахстана</p>
          </div>
        </div>
        <div className="flex-1">
          <Omnibox onSelect={p => { setSelectedPlant(p); setTab('search') }} />
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-gray-200 bg-white px-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 ${
              tab === t.id
                ? 'border-forest-600 text-forest-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
        {familyFilter && tab === 'search' && (
          <div className="ml-auto flex items-center gap-2 py-2">
            <span className="rounded-full bg-forest-100 px-3 py-0.5 text-xs text-forest-700">
              Семейство: {familyFilter}
            </span>
            <button
              onClick={() => setFamilyFilter(undefined)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}
      </nav>

      {/* Main */}
      <main className="flex-1 overflow-hidden p-6">
        {tab === 'search' && (
          <PlantList
            onSelect={setSelectedPlant}
            familyFilter={familyFilter}
          />
        )}
        {tab === 'taxonomy' && (
          <div className="relative h-full">
            <TaxonomyTree onFamilySelect={handleFamilySelect} />
          </div>
        )}
        {tab === 'map' && <MapView />}
      </main>

      {/* Plant detail drawer */}
      {selectedPlant && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setSelectedPlant(null)}
          />
          <PlantDetail
            plant={selectedPlant}
            onClose={() => setSelectedPlant(null)}
          />
        </>
      )}
    </div>
  )
}
