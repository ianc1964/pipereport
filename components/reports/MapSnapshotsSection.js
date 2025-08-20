// components/reports/MapSnapshotsSection.js
'use client'

import { MapPin, Calendar, Map, Compass } from 'lucide-react'

export default function MapSnapshotsSection({ mapSnapshots = [] }) {
  // Filter out snapshots that shouldn't be included in the report
  const includedSnapshots = mapSnapshots.filter(snapshot => snapshot.includeInReport)
  
  if (!includedSnapshots || includedSnapshots.length === 0) {
    return null
  }

  const getContextIcon = (context) => {
    return context === 'canvas' ? <Compass className="w-4 h-4" /> : <Map className="w-4 h-4" />
  }

  const getContextLabel = (context) => {
    return context === 'canvas' ? 'Drawing Canvas' : 'Map View'
  }

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Maps & Site Diagrams</h2>
      
      <div className="space-y-6">
        {includedSnapshots.map((snapshot, index) => (
          <div key={snapshot.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
            {/* Snapshot Header */}
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center">
                    {getContextIcon(snapshot.context)}
                    <span className="ml-2">
                      {snapshot.name || `Map View ${index + 1}`}
                    </span>
                  </h3>
                  {snapshot.description && (
                    <p className="text-sm text-gray-600 mt-1">{snapshot.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
                  {getContextLabel(snapshot.context)}
                </span>
              </div>
            </div>
            
            {/* Snapshot Image */}
            <div className="p-4 bg-gray-50">
              {snapshot.imageUrl ? (
                <div className="relative group">
                  <img
                    src={snapshot.imageUrl}
                    alt={snapshot.name || `Map View ${index + 1}`}
                    className="w-full h-auto rounded border border-gray-300 shadow-sm"
                    style={{ maxHeight: '600px', objectFit: 'contain' }}
                    loading="lazy"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity rounded" />
                </div>
              ) : (
                <div className="w-full h-64 bg-gray-200 rounded flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Map image not available</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Snapshot Footer */}
            <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {snapshot.viewState && (
                    <>
                      {snapshot.viewState.zoom && (
                        <span className="flex items-center">
                          <span className="font-medium">Zoom:</span>
                          <span className="ml-1">{snapshot.viewState.zoom}</span>
                        </span>
                      )}
                      {snapshot.viewState.center && (
                        <span className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1" />
                          <span className="font-medium">Center:</span>
                          <span className="ml-1">
                            {snapshot.viewState.center[0].toFixed(4)}, {snapshot.viewState.center[1].toFixed(4)}
                          </span>
                        </span>
                      )}
                    </>
                  )}
                </div>
                <span className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  Captured: {new Date(snapshot.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {includedSnapshots.length > 1 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{includedSnapshots.length}</span> map snapshots included in this report
            {includedSnapshots.some(s => s.context === 'canvas') && includedSnapshots.some(s => s.context === 'map') && (
              <span className="ml-2">
                ({includedSnapshots.filter(s => s.context === 'map').length} map views, 
                {' '}{includedSnapshots.filter(s => s.context === 'canvas').length} drawings)
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}