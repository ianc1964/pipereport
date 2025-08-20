// components/reports/MapSnapshotsTab.js
import { useState, useEffect } from 'react'
import { 
  Camera,
  Map,
  Palette,
  Eye,
  Trash2,
  ExternalLink,
  Plus,
  AlertCircle,
  Check,
  ChevronUp,
  ChevronDown,
  Download,
  Maximize2
} from 'lucide-react'

export default function MapSnapshotsTab({ report, updateReport, isReadOnly, projectId }) {
  // State for map snapshots (stored in report)
  const [mapSnapshots, setMapSnapshots] = useState(
    report.map_snapshots || []
  )
  
  // Sync with report data when it changes
  useEffect(() => {
    if (report.map_snapshots) {
      setMapSnapshots(report.map_snapshots)
    }
  }, [report.map_snapshots])
  
  // Local state
  const [capturing, setCapturing] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [hasUnsavedSnapshots, setHasUnsavedSnapshots] = useState(false)
  
  // Handle adding a new snapshot
  const handleCaptureSnapshot = () => {
    if (isReadOnly) return
    
    // Updated URL to match your project structure
    const captureUrl = `/projects/${projectId}?mode=capture&reportId=${report.id}`
    window.open(captureUrl, '_blank', 'width=1200,height=800')
    
    // Listen for message from map page
    const handleMessage = (event) => {
      if (event.data.type === 'map-snapshot-captured') {
        console.log('📸 Map snapshot captured:', event.data)
        
        const newSnapshot = {
          id: Date.now().toString(), // Temporary ID
          name: event.data.name || `Map View ${mapSnapshots.length + 1}`,
          description: event.data.description || '',
          context: event.data.context || 'map', // map or canvas
          imageUrl: event.data.imageUrl, // Base64 or URL
          viewState: event.data.viewState, // Current map view state
          backgroundType: event.data.backgroundType,
          timestamp: new Date().toISOString(),
          includeInReport: true
        }
        
        const updatedSnapshots = [...mapSnapshots, newSnapshot]
        setMapSnapshots(updatedSnapshots)
        updateReport('map_snapshots', updatedSnapshots)
        
        // Show save feedback
        setSaveStatus('New snapshot added - changes will auto-save in 30 seconds or click Save above')
        setTimeout(() => setSaveStatus(''), 5000)
        
        console.log('✅ Map snapshots updated:', updatedSnapshots.length, 'snapshots')
        
        window.removeEventListener('message', handleMessage)
      }
    }
    
    window.addEventListener('message', handleMessage)
  }
  
  // Handle toggling snapshot inclusion
  const handleToggleSnapshot = (snapshotId) => {
    if (isReadOnly) return
    
    const updatedSnapshots = mapSnapshots.map(snap => 
      snap.id === snapshotId 
        ? { ...snap, includeInReport: !snap.includeInReport }
        : snap
    )
    
    setMapSnapshots(updatedSnapshots)
    updateReport('map_snapshots', updatedSnapshots)
  }
  
  // Handle deleting snapshot
  const handleDeleteSnapshot = (snapshotId) => {
    if (isReadOnly) return
    
    if (!window.confirm('Are you sure you want to delete this map snapshot?')) {
      return
    }
    
    const updatedSnapshots = mapSnapshots.filter(snap => snap.id !== snapshotId)
    setMapSnapshots(updatedSnapshots)
    updateReport('map_snapshots', updatedSnapshots)
  }
  
  // Handle reordering
  const handleMoveSnapshot = (index, direction) => {
    if (isReadOnly) return
    
    const newSnapshots = [...mapSnapshots]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    
    if (newIndex < 0 || newIndex >= mapSnapshots.length) return
    
    // Swap positions
    [newSnapshots[index], newSnapshots[newIndex]] = [newSnapshots[newIndex], newSnapshots[index]]
    
    setMapSnapshots(newSnapshots)
    updateReport('map_snapshots', newSnapshots)
  }
  
  // Calculate stats
  const stats = {
    total: mapSnapshots.length,
    included: mapSnapshots.filter(s => s.includeInReport).length,
    map: mapSnapshots.filter(s => s.context === 'map').length,
    canvas: mapSnapshots.filter(s => s.context === 'canvas').length
  }
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Map Snapshots</h3>
        <p className="text-sm text-gray-600">
          Capture visual snapshots of your project maps to include in the report. 
          These show the current state of all map elements including nodes, lines, drawings, and observations.
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Snapshots</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">{stats.included}</div>
          <div className="text-sm text-green-600">Included in Report</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{stats.map}</div>
          <div className="text-sm text-blue-600">Map Mode</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-900">{stats.canvas}</div>
          <div className="text-sm text-purple-600">Canvas Mode</div>
        </div>
      </div>
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
          Debug: {mapSnapshots.length} snapshots in local state | Report has {report.map_snapshots?.length || 0} snapshots saved
        </div>
      )}
      
      {/* Capture Button */}
      {!isReadOnly && (
        <div className="py-4">
          <div className="flex justify-center">
            <button
              onClick={handleCaptureSnapshot}
              disabled={capturing}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <Camera className="mr-2 h-4 w-4" />
              Capture New Map Snapshot
            </button>
          </div>
          
          {/* Save Status Feedback */}
          {saveStatus && (
            <div className="mt-3 text-center">
              <p className="text-sm text-green-600 bg-green-50 rounded-md py-2 px-4 inline-flex items-center">
                <Check className="w-4 h-4 mr-2" />
                {saveStatus}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Snapshots List */}
      <div className="space-y-4">
        {mapSnapshots.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Camera className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 mb-4">No map snapshots captured yet.</p>
            {!isReadOnly && (
              <p className="text-sm text-gray-500">
                Click "Capture New Map Snapshot" to create a visual record of your current map.
              </p>
            )}
          </div>
        ) : (
          mapSnapshots.map((snapshot, index) => (
            <div
              key={snapshot.id}
              className={`border rounded-lg overflow-hidden transition-all ${
                snapshot.includeInReport
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  {!isReadOnly && (
                    <button
                      onClick={() => handleToggleSnapshot(snapshot.id)}
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 transition-colors mt-1 ${
                        snapshot.includeInReport
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {snapshot.includeInReport && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </button>
                  )}
                  
                  {/* Snapshot Preview */}
                  <div className="flex-shrink-0">
                    {snapshot.imageUrl ? (
                      <img
                        src={snapshot.imageUrl}
                        alt={snapshot.name}
                        className="w-32 h-24 object-cover rounded border border-gray-300"
                      />
                    ) : (
                      <div className="w-32 h-24 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                        <Map className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Snapshot Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">
                        {snapshot.name}
                      </h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        snapshot.context === 'canvas'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {snapshot.context === 'canvas' ? 'Drawing Canvas' : 'Map View'}
                      </span>
                    </div>
                    
                    {snapshot.description && (
                      <p className="text-sm text-gray-600 mb-2">{snapshot.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Captured: {new Date(snapshot.timestamp).toLocaleString()}</span>
                      {snapshot.viewState && (
                        <span>Zoom: {snapshot.viewState.zoom}</span>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => setSelectedSnapshot(snapshot)}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        <Maximize2 className="w-3 h-3 mr-1" />
                        Enlarge
                      </button>
                      <a
                        href={snapshot.imageUrl}
                        download={`${snapshot.name}.png`}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </a>
                    </div>
                  </div>
                  
                  {/* Reorder/Delete Actions */}
                  {!isReadOnly && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveSnapshot(index, 'up')}
                        disabled={index === 0}
                        className={`p-1 rounded transition-colors ${
                          index === 0
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveSnapshot(index, 'down')}
                        disabled={index === mapSnapshots.length - 1}
                        className={`p-1 rounded transition-colors ${
                          index === mapSnapshots.length - 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snapshot.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Help Text */}
      <div className="mt-6 p-4 bg-amber-50 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">About Map Snapshots</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Snapshots capture the current visual state of your map including all elements</li>
              <li>These images will be included in your report as static visuals</li>
              <li>Changes made to the project after capturing won't affect existing snapshots</li>
              <li>You can capture multiple views (zoomed in/out, different areas) of the same map</li>
              <li className="font-medium">Remember to save your report after capturing snapshots (auto-saves every 30 seconds)</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Enlarged View Modal */}
      {selectedSnapshot && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSnapshot(null)}
        >
          <div className="max-w-6xl max-h-full">
            <img
              src={selectedSnapshot.imageUrl}
              alt={selectedSnapshot.name}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}