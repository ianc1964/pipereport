'use client'
import { useRef, useState, useEffect } from 'react'
import { 
  Map, MapPin, Upload, Plus, Navigation, MousePointer, 
  Eye, EyeOff, X, Settings, 
  Pencil, Palette, Layers, Image as ImageIcon, Trash2, Maximize2
} from 'lucide-react'
import PostcodeSearch from './PostcodeSearch'
import HelpIcon from '@/components/help/HelpIcon'

export default function MapControls({
  mode,
  setMode,
  showNodes,
  setShowNodes,
  showLines,
  setShowLines,
  showObservations,
  setShowObservations,
  showLabels,
  setShowLabels,
  uploadingBackground, // Keep for backward compatibility (if used elsewhere)
  uploadingReferenceImage, // New specific prop for reference image uploads
  onBackgroundUpload,
  nodeTypes,
  selectedNodeType,
  setSelectedNodeType,
  sections,  
  lines,
  selectedSectionId,
  setSelectedSectionId,
  drawingLine,
  setDrawingLine,
  backgroundType,              
  onBackgroundTypeChange,      
  onManageNodeTypes,
  showDrawings,
  setShowDrawings,
  drawingsCount = 0,
  map,  // Map instance for postcode search
  referenceImageUrl,           // New props for reference image
  onReferenceImageUpload,      
  onReferenceImageRemove,
  referenceImageOpacity = 0.5,
  onReferenceImageOpacityChange,
  mapOpacity = 1.0,           // New prop for map opacity
  onMapOpacityChange,         // New prop for map opacity change handler
  onFitToContent              // New prop for fit to content
}) {
  const fileInputRef = useRef(null)
  const [showOpacitySlider, setShowOpacitySlider] = useState(false)
  const [showMapOpacitySlider, setShowMapOpacitySlider] = useState(false)
  const mapOpacityRef = useRef(null)
  const referenceOpacityRef = useRef(null)
  
  // Click outside handler for map opacity slider
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mapOpacityRef.current && !mapOpacityRef.current.contains(event.target)) {
        setShowMapOpacitySlider(false)
      }
    }

    if (showMapOpacitySlider) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showMapOpacitySlider])


  // Click outside handler for reference image opacity slider
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (referenceOpacityRef.current && !referenceOpacityRef.current.contains(event.target)) {
        setShowOpacitySlider(false)
      }
    }

    if (showOpacitySlider) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showOpacitySlider])
  
  // Determine upload state with fallback for compatibility
  const isUploadingReference = uploadingReferenceImage || uploadingBackground

  // Handler for reference image upload
  const handleReferenceImageSelect = async (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }
      if (onReferenceImageUpload) {
        await onReferenceImageUpload(file)
      }
    }
    // Reset the input so the same file can be selected again
    e.target.value = ''
  }

  return (
    <div className="p-4 border-b border-gray-200 space-y-3">
      {/* Background Section */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Background:</span>
          <HelpIcon 
            title="Background Types"
            content="Choose between map view with satellite/street imagery or drawing canvas for technical drawings."
            bullets={[
              "Map: Use Google Maps or OpenStreetMap imagery",
              "Drawing Canvas: Clean background for technical drawings",
              "Switch anytime without losing your work"
            ]}
            size="sm"
            position="top"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Map Option */}
          <button
            onClick={() => onBackgroundTypeChange('map')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              backgroundType === 'map'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
            title="Use map background"
          >
            🗺️ Map
          </button>
          
          {/* Drawing Canvas Option */}
          <button
            onClick={() => onBackgroundTypeChange('blank')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              backgroundType === 'blank'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
            title="Use drawing canvas"
          >
            📄 Drawing Canvas
          </button>
        </div>
        
        {/* Map Opacity Control - Only visible in map mode */}
        {backgroundType === 'map' && (
          <div className="flex items-center space-x-2 border-l pl-4">
            <div className="flex items-center space-x-1">
              <span className="text-sm text-gray-500">Map Opacity:</span>
              <HelpIcon 
                title="Map Transparency"
                content="Adjust how transparent the map background appears. Useful when overlaying drawings or reference images."
                bullets={[
                  "100% = Fully opaque map",
                  "50% = Semi-transparent",
                  "Lower values make map more transparent"
                ]}
                size="sm"
                position="top"
              />
            </div>
            
            {/* Opacity Control */}
            <div className="relative" ref={mapOpacityRef}>
              <button
                onClick={() => setShowMapOpacitySlider(!showMapOpacitySlider)}
                className="px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center space-x-1"
                title="Adjust map transparency"
              >
                <Eye className="w-4 h-4" />
                <span>{Math.round(mapOpacity * 100)}%</span>
              </button>
              
              {showMapOpacitySlider && (
                <div className="absolute top-full mt-2 left-0 bg-white border border-gray-200 rounded-md shadow-lg p-3 z-50">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 w-8">0%</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={mapOpacity * 100}
                      onChange={(e) => {
                        if (onMapOpacityChange) {
                          onMapOpacityChange(e.target.value / 100)
                        }
                      }}
                      className="w-32"
                    />
                    <span className="text-xs text-gray-500 w-12">100%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Reference Image Controls - Only visible in blank mode */}
        {backgroundType === 'blank' && (
          <div className="flex items-center space-x-2 border-l pl-4">
            {!referenceImageUrl ? (
              <>
                <div className="flex items-center space-x-1">
                  <span className="text-sm text-gray-500">Reference:</span>
                  <HelpIcon 
                    title="Reference Images"
                    content="Upload site plans, blueprints, or photos to draw over them. Perfect for creating technical drawings based on existing documentation."
                    bullets={[
                      "Upload: JPG, PNG, or other image formats",
                      "Opacity: Adjust transparency as needed",
                      "Use for: Site plans, blueprints, aerial photos"
                    ]}
                    size="sm"
                    position="top"
                  />
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingReference}
                  className="px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center space-x-1"
                  title="Upload reference image (site plan, blueprint, etc.)"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>{isUploadingReference ? 'Uploading...' : 'Upload Site Plan'}</span>
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-500">Reference Image:</span>
                
                {/* Opacity Control */}
                <div className="relative" ref={referenceOpacityRef}>
                  <button
                    onClick={() => setShowOpacitySlider(!showOpacitySlider)}
                    className="px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center space-x-1"
                    title="Adjust reference image opacity"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{Math.round(referenceImageOpacity * 100)}%</span>
                  </button>
                  
                  {showOpacitySlider && (
                    <div className="absolute top-full mt-2 left-0 bg-white border border-gray-200 rounded-md shadow-lg p-3 z-50">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 w-8">0%</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={referenceImageOpacity * 100}
                          onChange={(e) => {
                            if (onReferenceImageOpacityChange) {
                              onReferenceImageOpacityChange(e.target.value / 100)
                            }
                          }}
                          className="w-32"
                        />
                        <span className="text-xs text-gray-500 w-12">100%</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Change Image */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingReference}
                  className="px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  title="Change reference image"
                >
                  Change
                </button>
                
                {/* Remove Image */}
                <button
                  onClick={() => {
                    if (confirm('Remove the reference image?')) {
                      if (onReferenceImageRemove) {
                        onReferenceImageRemove()
                      }
                    }
                  }}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                  title="Remove reference image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
        
        {/* Postcode Search - Only available in Map mode */}
        {backgroundType === 'map' && (
          <div className="flex items-center space-x-2 flex-1 max-w-md ml-4">
            <HelpIcon 
              title="Location Search"
              content="Search for any UK postcode to quickly navigate to a specific area on the map."
              bullets={[
                "Enter any UK postcode (e.g., SW1A 1AA)",
                "Map will zoom to that location",
                "Useful for finding project sites quickly"
              ]}
              size="sm"
              position="top"
            />
            <PostcodeSearch map={map} visible={true} />
          </div>
        )}
      </div>

      {/* Hidden file input for reference images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleReferenceImageSelect}
        className="hidden"
      />

      {/* Map Header and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Map className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">
            {backgroundType === 'blank' ? 'Drawing Canvas' : 'Site Map'}
          </h3>
          {mode === 'view' && (
            <span className="text-xs text-gray-500 ml-2">(Drag nodes to move them)</span>
          )}
          {mode === 'drawing' && (
            <span className="text-xs text-blue-600 ml-2">(Drawing mode active)</span>
          )}
        </div>
        
        {/* Map Controls */}
        <div className="flex items-center space-x-2">
          {/* Manage Node Types Button */}
          <div className="flex items-center space-x-1">
            <button
              onClick={onManageNodeTypes}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center space-x-1"
              title="Manage Custom Node Types"
            >
              <Settings className="w-4 h-4" />
              <span>Node Types</span>
            </button>
            <HelpIcon 
              title="Node Type Management"
              content="Create and manage custom node types for your infrastructure mapping needs."
              bullets={[
                "Add custom manholes, chambers, valves",
                "Set icons and colors for each type",
                "Organize nodes by function or priority"
              ]}
              size="sm"
              position="top"
            />
          </div>
          
          {/* Fit to Content Button */}
          {onFitToContent && (
            <div className="flex items-center space-x-1">
              <button
                onClick={onFitToContent}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center space-x-1"
                title="Fit map to show all elements"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Fit to Content</span>
              </button>
              <HelpIcon 
                title="Fit to Content"
                content="Automatically zoom and center the map to show all your nodes, lines, and drawings in one view."
                bullets={[
                  "Shows all elements at once",
                  "Automatically calculates best zoom level",
                  "Useful after adding many elements"
                ]}
                size="sm"
                position="top"
              />
            </div>
          )}
          
          {/* Toggle Layers */}
          <div className="flex items-center space-x-1 border-l pl-2">
            <HelpIcon 
              title="Layer Visibility"
              content="Show or hide different types of elements on your map. Blue icons indicate visible layers."
              bullets={[
                "Nodes: Manholes, chambers, inspection points",
                "Lines: Pipe connections between nodes",
                "Observations: Inspection findings and defects",
                "Drawings: Annotations and technical drawings",
                "Labels: Names and references for all elements"
              ]}
              size="sm"
              position="top"
            />
            <button
              onClick={() => setShowNodes(!showNodes)}
              className={`p-1.5 rounded ${showNodes ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
              title="Toggle Nodes"
            >
              <MapPin className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowLines(!showLines)}
              className={`p-1.5 rounded ${showLines ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
              title="Toggle Lines"
            >
              <Navigation className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowObservations(!showObservations)}
              className={`p-1.5 rounded ${showObservations ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
              title="Toggle Observations"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDrawings(!showDrawings)}
              className={`p-1.5 rounded relative ${showDrawings ? 'bg-purple-100 text-purple-600' : 'text-gray-400'}`}
              title="Toggle Drawings"
            >
              <Palette className="w-4 h-4" />
              {drawingsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {drawingsCount > 9 ? '9+' : drawingsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`p-1.5 rounded ${showLabels ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
              title="Toggle Labels"
            >
              <span className="text-xs font-bold px-1">ABC</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mode Selector */}
      <div className="mt-4 flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-500">Mode:</span>
            <HelpIcon 
              title="Interaction Modes"
              content="Choose how you want to interact with the map. Different modes enable different tools and actions."
              bullets={[
                "View: Navigate and inspect existing elements",
                "Add Node: Click to place manholes and inspection points", 
                "Draw Line: Connect nodes to show pipe routes",
                "Draw: Access drawing tools for annotations"
              ]}
              size="sm"
              position="top"
            />
          </div>
          <div className="flex space-x-1 bg-gray-100 rounded p-1">
            <button
              onClick={() => {
                setMode('view')
                setDrawingLine(null)
                setSelectedSectionId(null)
              }}
              className={`px-3 py-1 text-sm rounded ${
                mode === 'view' ? 'bg-white shadow-sm' : ''
              }`}
            >
              <MousePointer className="w-4 h-4 inline mr-1" />
              View
            </button>
            <button
              onClick={() => {
                setMode('add_node')
                setDrawingLine(null)
                setSelectedSectionId(null)
              }}
              className={`px-3 py-1 text-sm rounded ${
                mode === 'add_node' ? 'bg-white shadow-sm' : ''
              }`}
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Add Node
            </button>
            <button
              onClick={() => {
                setMode('draw_line')
                setDrawingLine(null)
                setSelectedSectionId(null)
              }}
              className={`px-3 py-1 text-sm rounded ${
                mode === 'draw_line' ? 'bg-white shadow-sm' : ''
              }`}
            >
              <Navigation className="w-4 h-4 inline mr-1" />
              Draw Line
            </button>
            <button
              onClick={() => {
                setMode('drawing')
                setDrawingLine(null)
                setSelectedSectionId(null)
              }}
              className={`px-3 py-1 text-sm rounded ${
                mode === 'drawing' ? 'bg-white shadow-sm' : ''
              }`}
            >
              <Pencil className="w-4 h-4 inline mr-1" />
              Draw
            </button>
          </div>
        </div>
        
        {/* Node Type Selector (when adding nodes) */}
        {mode === 'add_node' && nodeTypes.length > 0 && (
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <span className="text-sm text-gray-500">Node Type:</span>
              <HelpIcon 
                title="Node Type Selection"
                content="Choose what type of infrastructure point to add. Each type can have different icons and properties."
                bullets={[
                  "Manhole: Standard inspection access points",
                  "Chamber: Larger access structures", 
                  "Custom types: Add your own via Node Types button"
                ]}
                size="sm"
                position="top"
              />
            </div>
            <select
              value={selectedNodeType || ''}
              onChange={(e) => setSelectedNodeType(e.target.value)}
              className="text-sm border-gray-300 rounded"
            >
              {nodeTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Drawing Line Status */}
        {mode === 'draw_line' && (
          <div className="flex items-center space-x-4 flex-1">
            {/* Section Selector */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <span className="text-sm text-gray-500">Link to Section:</span>
                <HelpIcon 
                  title="Section Linking"
                  content="Connect your lines to video inspection sections. This links map topology to your CCTV survey data."
                  bullets={[
                    "Select a section to link the line to video data",
                    "Node references will auto-update to match section",
                    "Choose 'No section' for visual-only lines"
                  ]}
                  size="sm"
                  position="top"
                />
              </div>
              <select
                value={selectedSectionId || ''}
                onChange={(e) => setSelectedSectionId(e.target.value || null)}
                className="text-sm border-gray-300 rounded px-3 py-1"
              >
                <option value="">No section (visual only)</option>
                {sections.map(section => {
                  const isMapped = lines.some(line => line.section?.id === section.id)
                  return (
                    <option key={section.id} value={section.id}>
                      {isMapped && '✓ '}Section {section.section_number}: {section.start_ref} → {section.finish_ref}
                      {section.material && ` (${section.material})`}
                    </option>
                  )
                })}
              </select>
            </div>
            
            {/* Drawing Status */}
            {drawingLine && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-blue-600">Drawing from: {drawingLine.startNode.node_ref}</span>
                {selectedSectionId && (
                  <span className="text-xs text-amber-600">
                    → Will rename to match section refs
                  </span>
                )}
                <button
                  onClick={() => {
                    setDrawingLine(null)
                    setSelectedSectionId(null)
                    setMode('view')
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}