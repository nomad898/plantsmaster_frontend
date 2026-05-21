import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchGeoJSON } from '../api'

export default function MapView() {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null)
  const [year, setYear] = useState(2024)

  useEffect(() => {
    fetchGeoJSON().then(setGeoData).catch(() => {})
  }, [])

  return (
    <div className="relative flex h-full flex-col gap-3">
      <div className="flex-1 overflow-hidden rounded-xl border border-gray-100 shadow-sm">
        <MapContainer
          center={[48.0, 68.0]}
          zoom={5}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoData && geoData.features.length > 0 && (
            <GeoJSON
              key={JSON.stringify(geoData)}
              data={geoData}
              style={{ color: '#166534', weight: 2, fillOpacity: 0.15 }}
              onEachFeature={(feature, layer) => {
                if (feature.properties?.name) {
                  layer.bindPopup(feature.properties.name)
                }
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Timeline slider */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
          <span>Год: <strong className="text-forest-700">{year}</strong></span>
          <span className="text-gray-400">Timeline — ареал распространения</span>
        </div>
        <input
          type="range"
          min={1950}
          max={2024}
          step={1}
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="w-full accent-forest-600"
        />
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>1950</span>
          <span>2024</span>
        </div>
      </div>
    </div>
  )
}
