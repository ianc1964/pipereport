'use client'
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import HelpIcon from '@/components/help/HelpIcon'

// Import icons with fallback handling
let Square, Circle, Polygon, Pencil, Type, Home, MapPin, Minus, Palette, Eye, EyeOff, Trash2, Save, X, Move, MousePointer

try {
  const lucideReact = require('lucide-react')
  Square = lucideReact.Square || (() => <span>□</span>)
  Circle = lucideReact.Circle || (() => <span>○</span>)
  Polygon = lucideReact.Polygon || (() => <span>▣</span>)
  Pencil = lucideReact.Pencil || (() => <span>✏️</span>)
  Type = lucideReact.Type || (() => <span>T</span>)
  Home = lucideReact.Home || (() => <span>🏠</span>)
  MapPin = lucideReact.MapPin || (() => <span>📍</span>)
  Minus = lucideReact.Minus || (() => <span>-</span>)
  Palette = lucideReact.Palette || (() => <span>🎨</span>)
  Eye = lucideReact.Eye || (() => <span>👁️</span>)
  EyeOff = lucideReact.EyeOff || (() => <span>🚫</span>)
  Trash2 = lucideReact.Trash2 || (() => <span>🗑️</span>)
  Save = lucideReact.Save || (() => <span>💾</span>)
  X = lucideReact.X || (() => <span>✕</span>)
  Move = lucideReact.Move || (() => <span>✥</span>)
  MousePointer = lucideReact.MousePointer || (() => <span>➤</span>)
} catch (error) {
  console.warn('Lucide React icons not available, using fallbacks')
  Square = () => <span>□</span>
  Circle = () => <span>○</span>
  Polygon = () => <span>▣</span>
  Pencil = () => <span>✏️</span>
  Type = () => <span>T</span>
  Home = () => <span>🏠</span>
  MapPin = () => <span>📍</span>
  Minus = () => <span>-</span>
  Palette = () => <span>🎨</span>
  Eye = () => <span>👁️</span>
  EyeOff = () => <span>🚫</span>
  Trash2 = () => <span>🗑️</span>
  Save = () => <span>💾</span>
  X = () => <span>✕</span>
  Move = () => <span>✥</span>
  MousePointer = () => <span>➤</span>
}

// Drawing Tools Component for ProjectMap
const DrawingTools = forwardRef(function DrawingTools({ 
  map, 
  projectId,
  drawings = [],
  onDrawingsUpdate,
  mode,
  setMode,
  showDrawings,
  setShowDrawings,
  activeLayer = 'default',
  selectedDrawing,
  setSelectedDrawing,
  onDrawingSelect,
  drawingContext = 'map' 
}, ref) {
  // Drawing state
  const [drawingMode, setDrawingMode] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDrawing, setCurrentDrawing] = useState(null)
  const [transformMode, setTransformMode] = useState(false)
  
  // UI state
  const [showStylePanel, setShowStylePanel] = useState(false)
  const [showDrawingsList, setShowDrawingsList] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [gridSize, setGridSize] = useState(20)
  const [currentStyle, setCurrentStyle] = useState({
    color: '#3B82F6',
    fillColor: '#3B82F6',
    weight: 2,
    opacity: 0.8,
    fillOpacity: 0.3,
    dashArray: null
  })
  
  // Color palette
  const colorPalette = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6B7280',
    '#1F2937', '#FFFFFF', '#FEE2E2', '#DBEAFE', '#D1FAE5'
  ]
  
  // Line width options
  const lineWidths = [1, 2, 3, 4, 5, 8, 10, 15, 20]
  
  // Dash patterns
  const dashPatterns = [
    { name: 'Solid', value: null },
    { name: 'Dashed', value: '10,5' },
    { name: 'Dotted', value: '2,3' },
    { name: 'Dash-Dot', value: '10,5,2,5' },
    { name: 'Long Dash', value: '20,10' }
  ]
  
  const [textContent, setTextContent] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  
  // Refs for drawing
  const drawingRef = useRef(null)
  const tempLayerRef = useRef(null)
  
  // Drawing type configurations
  const drawingTypes = [
    { type: 'rectangle', icon: Square, label: 'Rectangle', description: 'Draw rectangles and squares' },
    { type: 'circle', icon: Circle, label: 'Circle', description: 'Draw circles and ovals' },
    { type: 'polygon', icon: Polygon, label: 'Polygon', description: 'Draw custom shapes' },
    { type: 'freehand', icon: Pencil, label: 'Freehand', description: 'Draw freehand lines' },
    { type: 'line', icon: Minus, label: 'Line', description: 'Draw straight lines' },
    { type: 'text', icon: Type, label: 'Text', description: 'Add text annotations' },
    { type: 'building', icon: Home, label: 'Building', description: 'Draw building outlines' },
    { type: 'boundary', icon: MapPin, label: 'Boundary', description: 'Mark boundaries and areas' }
  ]
  
  // Initialize temp layer for drawing
  useEffect(() => {
    if (!map) return
    
    if (!tempLayerRef.current) {
      try {
        tempLayerRef.current = L.layerGroup().addTo(map)
      } catch (error) {
        console.error('Error creating temp layer:', error)
      }
    }
    
    return () => {
      if (tempLayerRef.current && map) {
        try {
          map.removeLayer(tempLayerRef.current)
        } catch (error) {
          console.warn('Error removing temp layer:', error)
        }
        tempLayerRef.current = null
      }
    }
  }, [map])

  // Ensure temp layer exists before drawing operations
  const ensureTempLayer = () => {
    if (!map) return false
    
    if (!tempLayerRef.current) {
      try {
        tempLayerRef.current = L.layerGroup().addTo(map)
      } catch (error) {
        console.error('Error creating temp layer on demand:', error)
        return false
      }
    }
    
    return true
  }
  
  // Reset drawing state when mode changes from parent
  useEffect(() => {
    if (mode === 'view') {
      setIsDrawing(false)
      setCurrentDrawing(null)
      setDrawingMode(null)
      setTransformMode(false)
      clearTempLayer()
    }
  }, [mode])

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    handleDoubleClick
  }), [isDrawing, currentDrawing, drawingMode, map])
  
  // Handle transform mode toggle
  const handleTransformModeToggle = () => {
    if (transformMode) {
      // Turn off transform mode
      setTransformMode(false)
      setMode('view')
      if (selectedDrawing) {
        setSelectedDrawing(null)
        if (onDrawingSelect) {
          onDrawingSelect(null)
        }
      }
    } else {
      // Turn on transform mode
      setTransformMode(true)
      setDrawingMode(null)
      setIsDrawing(false)
      setCurrentDrawing(null)
      clearTempLayer()
      // Don't change the parent mode - let it stay as 'drawing' for transform to work
    }
  }
  
  // Handle drawing mode change - SIMPLIFIED
  const handleDrawingModeChange = (type) => {
    // Turn off transform mode if it's on
    if (transformMode) {
      setTransformMode(false)
    }
    
    // Clear any selection when starting to draw
    if (selectedDrawing) {
      setSelectedDrawing(null)
    }
    
    if (drawingMode === type) {
      // Toggle off
      setDrawingMode(null)
      setIsDrawing(false)
      setCurrentDrawing(null)
      clearTempLayer()
    } else {
      // Set new drawing mode
      setDrawingMode(type)
      setMode('drawing') // Keep in drawing mode
      setIsDrawing(false)
      setCurrentDrawing(null)
      clearTempLayer()
    }
  }
  
  // Clear temporary drawing layer
  const clearTempLayer = () => {
    if (tempLayerRef.current) {
      try {
        tempLayerRef.current.clearLayers()
      } catch (error) {
        console.error('Error clearing temp layer:', error)
      }
    }
  }
  
  // Start drawing with grid snapping
  const startDrawing = (latlng) => {
    if (!drawingMode || !map || transformMode) return
    
    // Apply grid snapping to clicked position
    const snappedLatLng = applyGridSnapping(latlng)
    
    // Handle text - open modal when clicking on map
    if (drawingMode === 'text') {
      const drawingData = {
        type: drawingMode,
        startPoint: snappedLatLng,
        currentPoint: snappedLatLng,
        points: [snappedLatLng]
      }
      setCurrentDrawing(drawingData)
      setIsDrawing(true)
      setShowTextInput(true)
      return
    }
    
    // Multi-point drawing (polygon, building, boundary)
    if (['polygon', 'building', 'boundary'].includes(drawingMode)) {
      if (!isDrawing) {
        // Start new polygon
        setIsDrawing(true)
        clearTempLayer()
        
        const drawingData = {
          type: drawingMode,
          startPoint: snappedLatLng,
          currentPoint: snappedLatLng,
          points: [snappedLatLng]
        }
        
        setCurrentDrawing(drawingData)
        createTempDrawing(drawingData)
      } else {
        // Add point to existing polygon
        const updatedDrawing = {
          ...currentDrawing,
          points: [...currentDrawing.points, snappedLatLng],
          currentPoint: snappedLatLng
        }
        setCurrentDrawing(updatedDrawing)
        updateTempDrawing(updatedDrawing)
      }
      return
    }
    
    // Click-and-drag drawing (rectangle, circle, line, freehand)
    if (['rectangle', 'circle', 'line', 'freehand'].includes(drawingMode)) {
      if (isDrawing && currentDrawing) {
        // Second click - finish the current drawing
        finishDrawing()
        return
      }
      
      // Start new drawing
      setIsDrawing(true)
      clearTempLayer()
      
      const drawingData = {
        type: drawingMode,
        startPoint: snappedLatLng,
        currentPoint: snappedLatLng,
        points: [snappedLatLng]
      }
      
      setCurrentDrawing(drawingData)
      createTempDrawing(drawingData)
      return
    }
  }
  
  // Update drawing with grid snapping
  const updateDrawing = (latlng) => {
    if (!isDrawing || !currentDrawing || !map) return
    
    // Apply grid snapping to mouse position
    const snappedLatLng = applyGridSnapping(latlng)
    
    const updatedDrawing = {
      ...currentDrawing,
      currentPoint: snappedLatLng
    }
    
    // Handle different drawing types
    switch (drawingMode) {
      case 'freehand':
        updatedDrawing.points = [...currentDrawing.points, snappedLatLng]
        break
      case 'polygon':
      case 'building':
      case 'boundary':
        updatedDrawing.currentPoint = snappedLatLng
        break
      default:
        updatedDrawing.currentPoint = snappedLatLng
    }
    
    setCurrentDrawing(updatedDrawing)
    updateTempDrawing(updatedDrawing)
  }
  
  // Handle double-click to finish polygon/building/boundary
  const handleDoubleClick = () => {
    if (['polygon', 'building', 'boundary'].includes(drawingMode) && isDrawing) {
      finishDrawing()
    }
  }
  
  // Finish drawing
  const finishDrawing = async () => {
    if (!isDrawing || !currentDrawing) {
      return
    }
    
    try {
      // Create geometry based on drawing type
      const geometry = createGeometryFromDrawing(currentDrawing)
      
      // Create drawing object with context
      const drawingData = {
        project_id: projectId,
        name: generateDrawingName(drawingMode),
        drawing_type: drawingMode,
        geometry: geometry,
        style: currentStyle,
        layer_name: activeLayer,
        text_content: drawingMode === 'text' ? textContent.trim() : null,
        context: drawingContext // ADD THIS LINE - ADD CONTEXT HERE
      }
      
      console.log(`Creating drawing in ${drawingContext} context:`, drawingData.name)
      
      // Save to database via parent callback
      if (onDrawingsUpdate) {
        await onDrawingsUpdate('create', drawingData)
      }
      
      // Reset state
      setIsDrawing(false)
      setCurrentDrawing(null)
      setTextContent('')
      setShowTextInput(false)
      clearTempLayer()
      
    } catch (error) {
      console.error('Error finishing drawing:', error)
      alert('Failed to save drawing: ' + error.message)
      // Reset state even on error
      setIsDrawing(false)
      setCurrentDrawing(null)
      clearTempLayer()
    }
  }
  
  // Cancel drawing
  const cancelDrawing = () => {
    setIsDrawing(false)
    setCurrentDrawing(null)
    setTextContent('')
    setShowTextInput(false)
    clearTempLayer()
  }
  
  // Create geometry from drawing data
  const createGeometryFromDrawing = (drawing) => {
    switch (drawing.type) {
      case 'rectangle':
        return {
          type: 'rectangle',
          bounds: {
            north: Math.max(drawing.startPoint.lat, drawing.currentPoint.lat),
            south: Math.min(drawing.startPoint.lat, drawing.currentPoint.lat),
            east: Math.max(drawing.startPoint.lng, drawing.currentPoint.lng),
            west: Math.min(drawing.startPoint.lng, drawing.currentPoint.lng)
          }
        }
      
      case 'circle':
        const radius = calculateDistance(
          drawing.startPoint.lat, drawing.startPoint.lng,
          drawing.currentPoint.lat, drawing.currentPoint.lng
        )
        return {
          type: 'circle',
          center: { lat: drawing.startPoint.lat, lng: drawing.startPoint.lng },
          radius: Math.max(radius, 1)
        }
      
      case 'polygon':
      case 'building':
      case 'boundary':
        let coordinates = drawing.points.map(p => [p.lat, p.lng])
        if (coordinates.length < 3) {
          coordinates.push([drawing.currentPoint.lat, drawing.currentPoint.lng])
        }
        return {
          type: drawing.type,
          coordinates: coordinates
        }
      
      case 'freehand':
        return {
          type: 'freehand',
          coordinates: drawing.points.map(p => [p.lat, p.lng])
        }
        
      case 'line':
        return {
          type: 'line',
          coordinates: [
            [drawing.startPoint.lat, drawing.startPoint.lng],
            [drawing.currentPoint.lat, drawing.currentPoint.lng]
          ]
        }
      
      case 'text':
        return {
          type: 'text',
          position: { lat: drawing.startPoint.lat, lng: drawing.startPoint.lng }
        }
      
      default:
        throw new Error(`Unknown drawing type: ${drawing.type}`)
    }
  }
  
  // Create temporary visual feedback during drawing
  const createTempDrawing = (drawing) => {
    if (!ensureTempLayer()) return
    
    try {
      const tempStyle = {
        ...currentStyle,
        color: '#2563EB',
        fillColor: drawingMode === 'line' ? 'transparent' : '#3B82F6',
        fillOpacity: drawingMode === 'line' ? 0 : 0.2,
        weight: 2,
        opacity: 0.8,
        className: 'temp-drawing-preview'
      }
      
      switch (drawing.type) {
        case 'rectangle':
          const bounds = L.latLngBounds(drawing.startPoint, drawing.currentPoint)
          const rect = L.rectangle(bounds, tempStyle)
          tempLayerRef.current.addLayer(rect)
          drawingRef.current = rect
          break
          
        case 'circle':
          let radius = calculateDistance(
            drawing.startPoint.lat, drawing.startPoint.lng,
            drawing.currentPoint.lat, drawing.currentPoint.lng
          )
          
          if (radius < 5) radius = 5
          
          const circle = L.circle(drawing.startPoint, { 
            radius: radius, 
            ...tempStyle
          })
          tempLayerRef.current.addLayer(circle)
          drawingRef.current = circle
          break
          
        case 'line':
          const lineCoords = [drawing.startPoint, drawing.currentPoint]
          const line = L.polyline(lineCoords, tempStyle)
          tempLayerRef.current.addLayer(line)
          drawingRef.current = line
          break
          
        case 'freehand':
          if (drawing.points && drawing.points.length > 1) {
            const freehandLine = L.polyline(drawing.points, {
              ...tempStyle,
              weight: 3
            })
            tempLayerRef.current.addLayer(freehandLine)
            drawingRef.current = freehandLine
          }
          break
          
        case 'polygon':
        case 'building':
        case 'boundary':
          if (drawing.points && drawing.points.length > 0) {
            const polygonStyle = {
              ...tempStyle,
              dashArray: drawing.type === 'boundary' ? '8,8' : null,
              fillOpacity: 0.1
            }
            
            if (drawing.points.length === 1) {
              const marker = L.circleMarker(drawing.points[0], {
                radius: 5,
                color: '#2563EB',
                fillColor: '#3B82F6',
                fillOpacity: 0.8
              })
              tempLayerRef.current.addLayer(marker)
              drawingRef.current = marker
            } else {
              const polygonCoords = [...drawing.points]
              const polygon = L.polygon(polygonCoords, polygonStyle)
              tempLayerRef.current.addLayer(polygon)
              
              if (drawing.currentPoint) {
                const previewLine = L.polyline([
                  drawing.points[drawing.points.length - 1],
                  drawing.currentPoint
                ], {
                  color: '#2563EB',
                  weight: 2,
                  opacity: 0.6,
                  dashArray: '4,4'
                })
                tempLayerRef.current.addLayer(previewLine)
              }
              
              drawingRef.current = polygon
            }
          }
          break
          
        case 'text':
          const fontSize = 14
          const displayText = textContent || 'Click to add text'
          
          const marker = L.marker(drawing.startPoint, {
            icon: L.divIcon({
              html: `<div style="
                background: #ff6b35; 
                color: white;
                padding: 4px 8px; 
                border: 2px solid #ff6b35; 
                border-radius: 4px;
                font-size: ${fontSize}px;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                white-space: nowrap;
                transform: translate(-50%, -50%);
                display: inline-block;
              ">${displayText}</div>`,
              className: 'text-marker-no-container',
              iconSize: null, // Let the content determine size
              iconAnchor: [0, 0] // We'll use CSS transform for centering
            })
          })
          tempLayerRef.current.addLayer(marker)
          drawingRef.current = marker
          break
      }
    } catch (error) {
      console.error('Error creating temp drawing:', error)
    }
  }
  
  // Update temporary drawing
  const updateTempDrawing = (drawing) => {
    clearTempLayer()
    createTempDrawing(drawing)
  }
  
  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371e3
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lng2 - lng1) * Math.PI / 180
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    
    return R * c
  }
  
  // Generate drawing name
  const generateDrawingName = (type) => {
    const typeNames = {
      rectangle: 'Rectangle',
      circle: 'Circle', 
      polygon: 'Polygon',
      freehand: 'Freehand',
      line: 'Line',
      text: 'Text',
      building: 'Building',
      boundary: 'Boundary'
    }
    
    const baseName = typeNames[type] || 'Drawing'
    // Filter drawings by context to avoid name conflicts
    const contextDrawings = drawings.filter(d => d.context === drawingContext) // ADD THIS LINE
    const existingNames = contextDrawings.map(d => d.name) // CHANGE THIS LINE
    let num = 1
    let name = `${baseName} ${num}`
    
    while (existingNames.includes(name)) {
      num++
      name = `${baseName} ${num}`
    }
    
    return name
  }
  
  // Enhanced drawing interaction
  const handleDrawingClick = (drawing, event) => {
    event.stopPropagation()
    
    // Clear any active drawing mode
    if (drawingMode) {
      setDrawingMode(null)
      setIsDrawing(false)
      clearTempLayer()
    }
    
    // Select/deselect drawing
    if (selectedDrawing?.id === drawing.id) {
      setSelectedDrawing(null)
      if (onDrawingSelect) {
        onDrawingSelect(null)
      }
    } else {
      setSelectedDrawing(drawing)
      if (onDrawingSelect) {
        onDrawingSelect(drawing)
      }
    }
  }
  
  // Grid snapping utility
  const snapToGrid = (value, gridSize) => {
    if (!showGrid) return value
    return Math.round(value / gridSize) * gridSize
  }
  
  // Apply grid snapping to coordinates
  const applyGridSnapping = (latlng) => {
    if (!showGrid || !map) return latlng
    
    // Convert lat/lng to pixel coordinates
    const point = map.latLngToContainerPoint(latlng)
    
    // Snap to grid
    const snappedPoint = {
      x: snapToGrid(point.x, gridSize),
      y: snapToGrid(point.y, gridSize)
    }
    
    // Convert back to lat/lng
    return map.containerPointToLatLng(snappedPoint)
  }
  
  // Other helper functions remain the same...
  const handleDuplicateDrawing = async (drawing) => {
    if (onDrawingsUpdate) {
      const duplicatedDrawing = {
        ...drawing,
        name: generateDrawingName(drawing.drawing_type),
        id: undefined,
        created_at: undefined,
        context: drawingContext // ADD THIS LINE
      }
      await onDrawingsUpdate('create', duplicatedDrawing)
    }
  }
  
  const handleChangeDrawingStyle = async (drawing, newStyle) => {
    if (onDrawingsUpdate) {
      await onDrawingsUpdate('update', {
        id: drawing.id,
        style: { ...drawing.style, ...newStyle }
      })
    }
  }
  
  const handleClearAllDrawings = async () => {
    // Only clear drawings from current context
    const contextDrawings = drawings.filter(d => d.context === drawingContext) // ADD THIS LINE
    if (confirm(`Are you sure you want to delete all ${contextDrawings.length} ${drawingContext} drawings? This cannot be undone.`)) {
      for (const drawing of contextDrawings) { // CHANGE THIS LINE
        if (onDrawingsUpdate) {
          await onDrawingsUpdate('delete', { id: drawing.id })
        }
      }
      setSelectedDrawing(null)
      setShowDrawingsList(false)
    }
  }
  
  const handleDeleteDrawing = async (drawingId) => {
    if (confirm('Are you sure you want to delete this drawing?')) {
      if (onDrawingsUpdate) {
        await onDrawingsUpdate('delete', { id: drawingId })
      }
      setSelectedDrawing(null)
    }
  }
  
  const handleToggleVisibility = async (drawing) => {
    if (onDrawingsUpdate) {
      await onDrawingsUpdate('update', {
        id: drawing.id,
        is_visible: !drawing.is_visible
      })
    }
  }
  
  const contextDrawings = drawings.filter(d => {
    const context = d.context || 'map' // Default to 'map' for legacy drawings without context
    return context === drawingContext
  })

  // Don't render if map is not ready
  if (!map) {
    return (
      <div className="drawing-tools">
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-gray-500">Waiting for map to load...</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="drawing-tools">
      {/* Drawing Mode Selector */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="flex items-center space-x-1">
          <span className="text-sm text-gray-500">
            Drawing Tools ({drawingContext === 'canvas' ? 'Canvas' : 'Map'} Mode):
          </span>
          <HelpIcon 
            title="Drawing Tools Overview"
            content="Create professional technical drawings and annotations. Each tool creates different types of shapes and elements."
            bullets={[
              "Rectangle/Circle: Basic geometric shapes",
              "Polygon: Custom multi-point shapes", 
              "Freehand: Draw by hand for sketches",
              "Text: Add labels and annotations",
              "Building/Boundary: Specialized shapes"
            ]}
            size="sm"
            position="top"
          />
        </div>
        
        {/* Drawing Tools */}
        <div className="flex space-x-1 bg-gray-100 rounded p-1">
          {drawingTypes.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => handleDrawingModeChange(type)}
              className={`px-3 py-1.5 text-sm rounded flex items-center space-x-1 ${
                drawingMode === type ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
              }`}
              title={drawingTypes.find(t => t.type === type)?.description}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        
        {/* Separator */}
        <div className="h-8 w-px bg-gray-300"></div>
        
        {/* Transform Mode Button */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleTransformModeToggle}
            className={`px-3 py-1.5 text-sm rounded flex items-center space-x-1 ${
              transformMode ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Select and move drawings"
          >
            <Move className="w-4 h-4" />
            <span className="hidden sm:inline">Transform</span>
          </button>
          <HelpIcon 
            title="Transform Mode"
            content="Select, move, and modify existing drawings. Click a drawing to select it, then drag to reposition."
            bullets={[
              "Click any drawing to select it",
              "Drag selected drawings to move them",
              "Use style tools to change colors",
              "Transform handles appear for precise control"
            ]}
            size="sm"
            position="top"
          />
        </div>
        
        {/* Controls */}
        <div className="flex space-x-1">
          {/* Drawing Layer Toggle */}
          <button
            onClick={() => setShowDrawings(!showDrawings)}
            className={`p-1.5 rounded ${showDrawings ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
            title="Toggle Drawings"
          >
            {showDrawings ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          
          {/* Grid Toggle */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded ${showGrid ? 'bg-purple-100 text-purple-600' : 'text-gray-400'}`}
              title="Toggle Grid"
            >
              <span className="text-xs">⚏</span>
            </button>
            <HelpIcon 
              title="Snap to Grid"
              content="Enable grid snapping for precise alignment. All drawing actions will snap to grid points when enabled."
              bullets={[
                "Helps create perfectly aligned drawings",
                "Adjustable grid size (10px to 100px)",
                "Useful for technical diagrams"
              ]}
              size="sm"
              position="top"
            />
          </div>
          
          {/* Drawings List Toggle */}
          {drawings.length > 0 && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowDrawingsList(!showDrawingsList)}
                className={`p-1.5 rounded ${showDrawingsList ? 'bg-green-100 text-green-600' : 'text-gray-400'}`}
                title={`${showDrawingsList ? 'Hide' : 'Show'} Drawings List (${drawings.length})`}
              >
                <span className="text-xs font-medium">{drawings.length}</span>
              </button>
              <HelpIcon 
                title="Drawings Manager"
                content="View and manage all your drawings. Control visibility, style, and organization."
                bullets={[
                  "See all drawings in current context",
                  "Toggle visibility on/off", 
                  "Quick style changes",
                  "Delete or duplicate drawings"
                ]}
                size="sm"
                position="top"
              />
            </div>
          )}
          
          {/* Style Panel Toggle */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowStylePanel(!showStylePanel)}
              className={`p-1.5 rounded ${showStylePanel ? 'bg-purple-100 text-purple-600' : 'text-gray-400'}`}
              title="Style Options"
            >
              <Palette className="w-4 h-4" />
            </button>
            <HelpIcon 
              title="Drawing Styles"
              content="Customize the appearance of your drawings with colors, line weights, and patterns."
              bullets={[
                "Color palette: Choose from predefined colors",
                "Line width: 1px to 20px thickness",
                "Line styles: Solid, dashed, dotted patterns",
                "Opacity: Control transparency"
              ]}
              size="sm"
              position="top"
            />
          </div>
        </div>
      </div>
      
      {/* Drawing Instructions */}
      {drawingMode && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-700">
              {drawingMode === 'rectangle' && '📐 Click and drag to draw a rectangle'}
              {drawingMode === 'circle' && '⭕ Click center, then click to set radius'}
              {drawingMode === 'polygon' && '🔷 Click points to create polygon, double-click to finish'}
              {drawingMode === 'freehand' && '✏️ Click and drag to draw freehand'}
              {drawingMode === 'line' && '📏 Click start point, then end point'}
              {drawingMode === 'text' && '🔤 Click on map to place text, then enter your text'}
              {drawingMode === 'building' && '🏠 Click points to outline building, double-click to finish'}
              {drawingMode === 'boundary' && '🚧 Click points to mark boundary, double-click to finish'}
            </div>
            {isDrawing && (
              <div className="flex space-x-2">
                <button
                  onClick={finishDrawing}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Save className="w-4 h-4 inline mr-1" />
                  Save
                </button>
                <button
                  onClick={cancelDrawing}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <X className="w-4 h-4 inline mr-1" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Transform Mode Instructions */}
      {transformMode && !selectedDrawing && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded">
          <div className="text-sm text-purple-700">
            🎯 Transform Mode Active - Click on any drawing to select and move it
          </div>
        </div>
      )}
      
      {/* Selected Drawing Info - Now shows when a drawing is selected */}
      {selectedDrawing && !drawingMode && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <div className="text-sm text-green-700 mb-2">
            <strong>Selected:</strong> {selectedDrawing.name}
          </div>
          <div className="text-xs text-green-600">
            The drawing is now draggable! Click and drag to move it around.
          </div>
          <div className="mt-2 space-x-2">
            <button
              onClick={() => handleChangeDrawingStyle(selectedDrawing, currentStyle)}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply Current Style
            </button>
            <button
              onClick={() => {
                setSelectedDrawing(null)
                if (onDrawingSelect) {
                  onDrawingSelect(null)
                }
              }}
              className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Deselect
            </button>
          </div>
        </div>
      )}
      
      {/* Text Input Modal */}
      {showTextInput && createPortal(
        <div 
          className="drawing-tools-modal" 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTextInput(false)
              setTextContent('')
              setCurrentDrawing(null)
            }
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 w-96 shadow-xl" 
            style={{ 
              maxWidth: '90%',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <h3 className="text-lg font-medium mb-4">Add Text Annotation</h3>
            <textarea
              value={textContent}
              onChange={(e) => {
                setTextContent(e.target.value)
                // Update the preview when text changes
                if (currentDrawing) {
                  updateTempDrawing(currentDrawing)
                }
              }}
              placeholder="Enter your text..."
              className="w-full h-24 p-3 border border-gray-300 rounded resize-none"
              autoFocus
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowTextInput(false)
                  setTextContent('')
                  setCurrentDrawing(null)
                  clearTempLayer()
                }}
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (textContent.trim() && currentDrawing) {
                    setShowTextInput(false)
                    finishDrawing()
                  }
                }}
                disabled={!textContent.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Place Text
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Drawings List - Now filtered by context */}
      {contextDrawings.length > 0 && showDrawingsList && (
        <div className="mt-4 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">
              {drawingContext === 'canvas' ? 'Canvas' : 'Map'} Drawings ({contextDrawings.length})
            </h4>
            <div className="flex space-x-1">
              <button
                onClick={handleClearAllDrawings}
                className="px-2 py-1 text-xs text-red-600 hover:bg-red-100 rounded"
                title="Delete all drawings"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowDrawingsList(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Hide list"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {contextDrawings.map(drawing => (
              <div 
                key={drawing.id}
                className={`flex items-center justify-between p-2 text-sm rounded border ${
                  selectedDrawing?.id === drawing.id 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
                onClick={() => handleDrawingClick(drawing, { stopPropagation: () => {} })}
                style={{ cursor: 'pointer' }}
              >
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-4 h-4 rounded border"
                    style={{ 
                      backgroundColor: drawing.style?.fillColor !== 'transparent' ? drawing.style?.fillColor : 'white',
                      borderColor: drawing.style?.color || '#ccc',
                      borderWidth: 1
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{drawing.name}</span>
                    <span className="text-xs text-gray-400 capitalize">
                      {drawing.drawing_type}
                      {drawing.text_content && ` • "${drawing.text_content.substring(0, 20)}${drawing.text_content.length > 20 ? '...' : ''}"`}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  {selectedDrawing?.id === drawing.id && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleChangeDrawingStyle(drawing, { color: '#EF4444', fillColor: '#EF4444' })
                        }}
                        className="w-3 h-3 rounded bg-red-500"
                        title="Make Red"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleChangeDrawingStyle(drawing, { color: '#10B981', fillColor: '#10B981' })
                        }}
                        className="w-3 h-3 rounded bg-green-500"
                        title="Make Green"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleChangeDrawingStyle(drawing, { color: '#3B82F6', fillColor: '#3B82F6' })
                        }}
                        className="w-3 h-3 rounded bg-blue-500"
                        title="Make Blue"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDuplicateDrawing(drawing)
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        title="Duplicate"
                      >
                        <span className="text-xs">⧉</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleVisibility(drawing)
                    }}
                    className={`p-1 rounded ${drawing.is_visible !== false ? 'text-green-600' : 'text-gray-400'}`}
                    title={drawing.is_visible !== false ? 'Hide' : 'Show'}
                  >
                    {drawing.is_visible !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteDrawing(drawing.id)
                    }}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Style Panel remains the same... */}
      {showStylePanel && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Drawing Style</h4>
            <button
              onClick={() => setShowStylePanel(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          
          {/* Color Palette */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 mb-2 block">Colors</label>
            <div className="grid grid-cols-5 gap-1">
              {colorPalette.map(color => (
                <button
                  key={color}
                  onClick={() => setCurrentStyle(prev => ({ 
                    ...prev, 
                    color: color, 
                    fillColor: color 
                  }))}
                  className={`w-8 h-8 rounded border-2 ${
                    currentStyle.color === color ? 'border-gray-800' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
          
          {/* Line Width */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              Line Width ({currentStyle.weight}px)
            </label>
            <div className="flex flex-wrap gap-1">
              {lineWidths.map(width => (
                <button
                  key={width}
                  onClick={() => setCurrentStyle(prev => ({ ...prev, weight: width }))}
                  className={`px-2 py-1 text-xs rounded border ${
                    currentStyle.weight === width 
                      ? 'bg-blue-100 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {width}
                </button>
              ))}
            </div>
          </div>
          
          {/* Dash Pattern */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 mb-2 block">Line Style</label>
            <div className="space-y-1">
              {dashPatterns.map(pattern => (
                <button
                  key={pattern.name}
                  onClick={() => setCurrentStyle(prev => ({ ...prev, dashArray: pattern.value }))}
                  className={`w-full px-2 py-1 text-xs rounded border text-left ${
                    currentStyle.dashArray === pattern.value
                      ? 'bg-blue-100 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {pattern.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* Opacity Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Line Opacity ({Math.round(currentStyle.opacity * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={currentStyle.opacity}
                onChange={(e) => setCurrentStyle(prev => ({ 
                  ...prev, 
                  opacity: parseFloat(e.target.value) 
                }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Fill Opacity ({Math.round(currentStyle.fillOpacity * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={currentStyle.fillOpacity}
                onChange={(e) => setCurrentStyle(prev => ({ 
                  ...prev, 
                  fillOpacity: parseFloat(e.target.value) 
                }))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Grid Controls */}
      {showGrid && (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-purple-700">Grid Active</span>
            <div className="flex items-center space-x-2">
              <label className="text-xs text-purple-600">Size:</label>
              <select
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value))}
                className="text-xs border border-purple-300 rounded px-1"
              >
                <option value={10}>10px</option>
                <option value={20}>20px</option>
                <option value={30}>30px</option>
                <option value={50}>50px</option>
                <option value={100}>100px</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-purple-600">
            Objects will snap to grid when drawing
          </div>
        </div>
      )}
      
      {/* Add CSS for animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
})

export default DrawingTools