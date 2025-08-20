// components/reports/DrawingsTab.js
import { useState, useEffect } from 'react'
import { 
  FileImage, 
  MapPin, 
  Palette, 
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Layers,
  Square,
  Circle,
  Hexagon,
  Type,
  Minus,
  Building,
  MapPinned
} from 'lucide-react'

// Icon mapping for drawing types
const DRAWING_TYPE_ICONS = {
  rectangle: Square,
  circle: Circle,
  polygon: Hexagon,
  freehand: Palette,
  line: Minus,
  text: Type,
  building: Building,
  boundary: MapPinned
}

export default function DrawingsTab({ report, updateReport, isReadOnly }) {
  // State for selected drawings (stored in report)
  const [selectedDrawingIds, setSelectedDrawingIds] = useState(
    report.selected_drawing_ids || []
  )
  
  // State for drawing order
  const [drawingOrder, setDrawingOrder] = useState(
    report.drawing_order || []
  )
  
  // Filter to show/hide context
  const [showContext, setShowContext] = useState('all') // all, map, canvas
  
  // Local state for UI
  const [expandedDrawings, setExpandedDrawings] = useState({})
  
  // Get all drawings from snapshot
  const allDrawings = report.drawings_snapshot || []
  
  // Filter drawings by context
  const filteredDrawings = allDrawings.filter(drawing => {
    if (showContext === 'all') return true
    return (drawing.context || 'map') === showContext
  })
  
  // Sort drawings according to order (selected ones first)
  const sortedDrawings = [...filteredDrawings].sort((a, b) => {
    const aIndex = drawingOrder.indexOf(a.id)
    const bIndex = drawingOrder.indexOf(b.id)
    const aSelected = selectedDrawingIds.includes(a.id)
    const bSelected = selectedDrawingIds.includes(b.id)
    
    // Selected items come first
    if (aSelected && !bSelected) return -1
    if (!aSelected && bSelected) return 1
    
    // Then by order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex
    }
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    
    // Finally by name
    return a.name.localeCompare(b.name)
  })
  
  // Handle selection change
  const handleToggleDrawing = (drawingId) => {
    if (isReadOnly) return
    
    const newSelectedIds = selectedDrawingIds.includes(drawingId)
      ? selectedDrawingIds.filter(id => id !== drawingId)
      : [...selectedDrawingIds, drawingId]
    
    setSelectedDrawingIds(newSelectedIds)
    updateReport('selected_drawing_ids', newSelectedIds)
    
    // Update order if newly selected
    if (!selectedDrawingIds.includes(drawingId)) {
      const newOrder = [...drawingOrder, drawingId]
      setDrawingOrder(newOrder)
      updateReport('drawing_order', newOrder)
    }
  }
  
  // Handle reordering
  const handleMoveDrawing = (drawingId, direction) => {
    if (isReadOnly) return
    
    const currentIndex = drawingOrder.indexOf(drawingId)
    if (currentIndex === -1) return
    
    const newOrder = [...drawingOrder]
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    
    if (newIndex < 0 || newIndex >= drawingOrder.length) return
    
    // Swap positions
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]]
    
    setDrawingOrder(newOrder)
    updateReport('drawing_order', newOrder)
  }
  
  // Toggle expanded state
  const toggleExpanded = (drawingId) => {
    setExpandedDrawings(prev => ({
      ...prev,
      [drawingId]: !prev[drawingId]
    }))
  }
  
  // Get drawing preview based on type
  const getDrawingPreview = (drawing) => {
    const { geometry, style } = drawing
    
    switch (geometry.type) {
      case 'rectangle':
        return (
          <div className="text-xs text-gray-600">
            Bounds: {geometry.bounds.north.toFixed(6)}, {geometry.bounds.south.toFixed(6)}, 
            {geometry.bounds.east.toFixed(6)}, {geometry.bounds.west.toFixed(6)}
          </div>
        )
      
      case 'circle':
        return (
          <div className="text-xs text-gray-600">
            Center: {geometry.center.lat.toFixed(6)}, {geometry.center.lng.toFixed(6)} | 
            Radius: {geometry.radius}m
          </div>
        )
      
      case 'polygon':
      case 'freehand':
      case 'line':
      case 'building':
      case 'boundary':
        return (
          <div className="text-xs text-gray-600">
            {geometry.coordinates.length} points
          </div>
        )
      
      case 'text':
        return (
          <div className="text-xs text-gray-600">
            "{drawing.text_content || 'Text'}" at {geometry.position.lat.toFixed(6)}, 
            {geometry.position.lng.toFixed(6)}
          </div>
        )
      
      default:
        return null
    }
  }
  
  // Calculate stats
  const selectedCount = selectedDrawingIds.filter(id => 
    allDrawings.some(d => d.id === id)
  ).length
  
  const stats = {
    total: allDrawings.length,
    map: allDrawings.filter(d => (d.context || 'map') === 'map').length,
    canvas: allDrawings.filter(d => d.context === 'canvas').length,
    selected: selectedCount
  }
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Drawings & Diagrams</h3>
        <p className="text-sm text-gray-600">
          Select drawings from your project to include in the report. These can be site maps, 
          technical diagrams, or annotated drawings.
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Drawings</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{stats.map}</div>
          <div className="text-sm text-blue-600">Map Mode</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-900">{stats.canvas}</div>
          <div className="text-sm text-purple-600">Canvas Mode</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">{stats.selected}</div>
          <div className="text-sm text-green-600">Selected</div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4 pb-4 border-b">
        <span className="text-sm font-medium text-gray-700">Show:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowContext('all')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              showContext === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setShowContext('map')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              showContext === 'map'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <MapPin className="inline-block w-4 h-4 mr-1" />
            Map ({stats.map})
          </button>
          <button
            onClick={() => setShowContext('canvas')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              showContext === 'canvas'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Palette className="inline-block w-4 h-4 mr-1" />
            Canvas ({stats.canvas})
          </button>
        </div>
      </div>
      
      {/* Drawings List */}
      <div className="space-y-2">
        {sortedDrawings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileImage className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No drawings found in this mode.</p>
          </div>
        ) : (
          sortedDrawings.map((drawing, index) => {
            const isSelected = selectedDrawingIds.includes(drawing.id)
            const isExpanded = expandedDrawings[drawing.id]
            const canMoveUp = isSelected && drawingOrder.indexOf(drawing.id) > 0
            const canMoveDown = isSelected && 
              drawingOrder.indexOf(drawing.id) < drawingOrder.length - 1 &&
              drawingOrder.indexOf(drawing.id) !== -1
            
            const DrawingIcon = DRAWING_TYPE_ICONS[drawing.geometry?.type] || Square
            
            return (
              <div
                key={drawing.id}
                className={`border rounded-lg transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Selection Checkbox */}
                    {!isReadOnly && (
                      <button
                        onClick={() => handleToggleDrawing(drawing.id)}
                        className={`flex-shrink-0 w-5 h-5 rounded border-2 transition-colors ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-white border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </button>
                    )}
                    
                    {/* Drawing Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <DrawingIcon className="w-4 h-4 text-gray-600" />
                        <h4 className="font-medium text-gray-900">
                          {drawing.name}
                        </h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          drawing.context === 'canvas'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {drawing.context === 'canvas' ? 'Canvas' : 'Map'}
                        </span>
                      </div>
                      
                      {/* Preview */}
                      {getDrawingPreview(drawing)}
                      
                      {/* Style Preview */}
                      {drawing.style && (
                        <div className="flex items-center gap-2 mt-1">
                          <div 
                            className="w-4 h-4 rounded border"
                            style={{
                              backgroundColor: drawing.style.fillColor || 'transparent',
                              borderColor: drawing.style.color || '#000',
                              borderWidth: '2px',
                              opacity: drawing.style.fillOpacity || 1
                            }}
                          />
                          <span className="text-xs text-gray-500">
                            {drawing.style.color} • Weight: {drawing.style.weight || 2}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    {!isReadOnly && isSelected && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveDrawing(drawing.id, 'up')}
                          disabled={!canMoveUp}
                          className={`p-1 rounded transition-colors ${
                            canMoveUp
                              ? 'text-gray-600 hover:bg-gray-100'
                              : 'text-gray-300 cursor-not-allowed'
                          }`}
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveDrawing(drawing.id, 'down')}
                          disabled={!canMoveDown}
                          className={`p-1 rounded transition-colors ${
                            canMoveDown
                              ? 'text-gray-600 hover:bg-gray-100'
                              : 'text-gray-300 cursor-not-allowed'
                          }`}
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    {/* Expand/Collapse */}
                    <button
                      onClick={() => toggleExpanded(drawing.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {isExpanded ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Type:</span>
                          <span className="ml-2 font-medium capitalize">
                            {drawing.geometry?.type || 'Unknown'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Layer:</span>
                          <span className="ml-2 font-medium">
                            {drawing.layer_name || 'Default'}
                          </span>
                        </div>
                        {drawing.text_content && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Text:</span>
                            <span className="ml-2 font-medium">"{drawing.text_content}"</span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-gray-600">Created:</span>
                          <span className="ml-2 font-medium">
                            {new Date(drawing.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      
      {/* Help Text */}
      {!isReadOnly && selectedCount > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Layers className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">
                {selectedCount} drawing{selectedCount !== 1 ? 's' : ''} selected
              </p>
              <p>
                Selected drawings will appear in your report in the order shown above. 
                Use the arrow buttons to reorder them.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}