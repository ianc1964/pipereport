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
  
  // Replace the entire localStorage listener useEffect in MapSnapshotsTab.js with this version
  // This includes image debugging and validation

  useEffect(() => {
    console.log('💾 Setting up ENHANCED localStorage bridge listener...')
    
    let pollInterval = null
    
    const checkForNewSnapshots = () => {
      try {
        const latestKey = localStorage.getItem('latest_map_snapshot_key')
        
        if (latestKey && !window.processedSnapshotKeys?.includes(latestKey)) {
          console.log('💾 Found new snapshot key:', latestKey)
          
          const snapshotDataStr = localStorage.getItem(latestKey)
          
          if (snapshotDataStr) {
            console.log('💾 Loading snapshot data from localStorage...')
            
            const snapshotData = JSON.parse(snapshotDataStr)
            
            console.log('📸 Snapshot data loaded:', {
              type: snapshotData.type,
              name: snapshotData.name,
              context: snapshotData.context,
              hasImageUrl: !!snapshotData.imageUrl,
              imageSize: snapshotData.imageUrl?.length,
              metadata: snapshotData.metadata
            })
            
            // DEBUG: Validate image data
            if (snapshotData.imageUrl) {
              console.log('🔍 DEBUGGING IMAGE DATA:', {
                imageLength: snapshotData.imageUrl.length,
                imageFormat: snapshotData.imageUrl.substring(0, 30),
                isValidDataUrl: snapshotData.imageUrl.startsWith('data:image/'),
                imageType: snapshotData.imageUrl.split(';')[0]?.split('/')[1]
              })
              
              // Test if browser can decode the image
              const testImg = new Image()
              testImg.onload = () => {
                console.log('✅ Image data is VALID - browser can decode it:', {
                  width: testImg.width,
                  height: testImg.height,
                  naturalWidth: testImg.naturalWidth,
                  naturalHeight: testImg.naturalHeight
                })
              }
              testImg.onerror = (e) => {
                console.error('❌ Image data is INVALID - browser cannot decode it:', e)
              }
              testImg.src = snapshotData.imageUrl
            } else {
              console.error('❌ No image URL in snapshot data!')
            }
            
            // Create new snapshot object
            const newSnapshot = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: snapshotData.name || `Map View ${mapSnapshots.length + 1}`,
              description: snapshotData.description || '',
              context: snapshotData.context || 'map',
              imageUrl: snapshotData.imageUrl,
              viewState: snapshotData.viewState,
              backgroundType: snapshotData.backgroundType,
              timestamp: new Date().toISOString(),
              includeInReport: true,
              metadata: snapshotData.metadata // Include capture metadata
            }
            
            console.log('📸 Creating snapshot from localStorage:', {
              id: newSnapshot.id,
              name: newSnapshot.name,
              context: newSnapshot.context,
              hasImage: !!newSnapshot.imageUrl,
              imageDataSize: newSnapshot.imageUrl?.length
            })
            
            // Update snapshots
            setMapSnapshots(currentSnapshots => {
              const updatedSnapshots = [...currentSnapshots, newSnapshot]
              console.log('📸 Updated snapshots via localStorage:', updatedSnapshots.length)
              
              // Update the report data
              updateReport('map_snapshots', updatedSnapshots)
              
              // Log the snapshot that was added for debugging
              console.log('📋 Added snapshot to report:', {
                snapshotId: newSnapshot.id,
                hasImageInSnapshot: !!newSnapshot.imageUrl,
                reportSnapshotsCount: updatedSnapshots.length
              })
              
              return updatedSnapshots
            })
            
            // Show save feedback with image info
            const imageSizeKB = Math.round((snapshotData.imageUrl?.length || 0) / 1024)
            setSaveStatus(`New snapshot added! (${imageSizeKB}KB image with ${snapshotData.metadata?.includesLegend ? 'legend' : 'no legend'})`)
            setTimeout(() => setSaveStatus(''), 7000)
            
            // Reset capturing state
            setCapturing(false)
            
            // Mark this key as processed
            if (!window.processedSnapshotKeys) {
              window.processedSnapshotKeys = []
            }
            window.processedSnapshotKeys.push(latestKey)
            
            // Clean up localStorage
            localStorage.removeItem(latestKey)
            localStorage.removeItem('latest_map_snapshot_key')
            
            console.log('✅ Enhanced snapshot successfully processed via localStorage!')
          }
        }
      } catch (error) {
        console.error('❌ Error checking localStorage for snapshots:', error)
      }
    }
    
    // Check immediately
    checkForNewSnapshots()
    
    // Set up polling every 1 second
    pollInterval = setInterval(checkForNewSnapshots, 1000)
    
    // Also check when window gets focus (when user comes back from capture window)
    const handleFocus = () => {
      console.log('👀 Window focused - checking for new snapshots...')
      checkForNewSnapshots()
    }
    
    window.addEventListener('focus', handleFocus)
    
    // Traditional message listener as backup
    const handleMessage = (event) => {
      if (event.data?.type === 'map-snapshot-via-localstorage') {
        console.log('📨 LocalStorage notification received via postMessage')
        checkForNewSnapshots()
      }
    }
    
    window.addEventListener('message', handleMessage)
    
    console.log('💾 Enhanced localStorage bridge active - polling every 1 second')
    
    // Cleanup
    return () => {
      console.log('🧹 Cleaning up enhanced localStorage bridge...')
      if (pollInterval) {
        clearInterval(pollInterval)
      }
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('message', handleMessage)
    }
  }, [updateReport, mapSnapshots.length])
  
  // Handle adding a new snapshot
  const handleCaptureSnapshot = () => {
    if (isReadOnly) return
    
    console.log('🎯 Opening map capture window for project:', projectId)
    setCapturing(true)
    
    // Updated URL to match your project structure
    const captureUrl = `/projects/${projectId}?mode=capture&reportId=${report.id}`
    const captureWindow = window.open(captureUrl, '_blank', 'width=1200,height=800')
    
    // Reset capturing state if window is closed without capturing
    const checkClosed = setInterval(() => {
      if (captureWindow.closed) {
        setCapturing(false)
        clearInterval(checkClosed)
        console.log('🔴 Capture window closed')
      }
    }, 1000)
    
    // Auto-reset after 2 minutes as fallback
    setTimeout(() => {
      setCapturing(false)
      clearInterval(checkClosed)
    }, 120000)
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
          {capturing && <span className="text-blue-600 ml-2">| 🎥 Waiting for capture...</span>}
        </div>
      )}
      
      {/* Capture Button */}
      {!isReadOnly && (
        <div className="py-4">
          <div className="flex justify-center">
            <button
              onClick={handleCaptureSnapshot}
              disabled={capturing}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 ${
                capturing 
                  ? 'bg-blue-400 cursor-wait' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Camera className="mr-2 h-4 w-4" />
              {capturing ? 'Waiting for Capture...' : 'Capture New Map Snapshot'}
            </button>
          </div>
          
          {capturing && (
            <div className="mt-3 text-center">
              <p className="text-sm text-blue-600 bg-blue-50 rounded-md py-2 px-4 inline-flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Position the map as desired, then click "Capture Snapshot" in the opened window
              </p>
            </div>
          )}
          
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