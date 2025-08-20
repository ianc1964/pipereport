'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'

// Transform handles component for direct object manipulation
const TransformHandles = ({ 
  map, 
  selectedDrawing, 
  onTransformStart,
  onTransformUpdate, 
  onTransformEnd,
  onDeselect,
  multiSelectMode = false,
  mode = 'view'
}) => {
  const [transforming, setTransforming] = useState(false)
  const [transformType, setTransformType] = useState(null)
  const [initialBounds, setInitialBounds] = useState(null)
  const [initialMousePos, setInitialMousePos] = useState(null)
  
  const handlesLayerRef = useRef(null)
  const transformDataRef = useRef(null)
  const handlesRef = useRef([])
  const mapRef = useRef(null) // 🔧 FIXED: Store stable map reference

  console.log('🎯 TransformHandles render:', { 
    hasMap: !!map, 
    hasSelectedDrawing: !!selectedDrawing,
    selectedDrawingName: selectedDrawing?.name,
    mode: mode,
    transforming: transforming
  })

  // 🔧 FIXED: Store map reference to prevent recreation
  useEffect(() => {
    if (map && !mapRef.current) {
      mapRef.current = map
      console.log('📍 Stored stable map reference')
    }
  }, [map])

  // Show handles when we have a selected drawing and we're not in node/line creation modes
  const shouldShowHandles = selectedDrawing && mode !== 'add_node' && mode !== 'draw_line'

  // 🔧 FIXED: Initialize handles layer only once and keep it stable
  useEffect(() => {
    if (!mapRef.current) {
      console.log('❌ No map available for TransformHandles')
      return
    }

    if (!handlesLayerRef.current) {
      try {
        handlesLayerRef.current = L.layerGroup().addTo(mapRef.current)
        console.log('✅ Created STABLE handles layer group')
      } catch (error) {
        console.error('❌ Error creating handles layer:', error)
      }
    }

    // 🔧 FIXED: Don't remove layer on cleanup - keep it stable
    return () => {
      // Only clear layers, don't remove the layer group
      if (handlesLayerRef.current) {
        handlesLayerRef.current.clearLayers()
        console.log('🧹 Cleared handles content (kept layer)')
      }
    }
  }, []) // 🔧 FIXED: Empty dependency array - only run once

  // 🔧 FIXED: Only destroy layer when component unmounts completely
  useEffect(() => {
    return () => {
      if (handlesLayerRef.current && mapRef.current) {
        try {
          mapRef.current.removeLayer(handlesLayerRef.current)
          console.log('🗑️ Removed handles layer on unmount')
        } catch (error) {
          console.warn('⚠️ Error removing handles layer:', error)
        }
        handlesLayerRef.current = null
      }
    }
  }, [])

  // 🔧 FIXED: Stable handle creation that doesn't recreate layer
  useEffect(() => {
    if (!shouldShowHandles || !mapRef.current || !handlesLayerRef.current) {
      clearHandles()
      return
    }

    console.log('🔄 Creating transform handles for:', selectedDrawing.name)
    createTransformHandles()
  }, [selectedDrawing?.id, shouldShowHandles]) // 🔧 FIXED: Only depend on drawing ID

  // Clear handles content without removing layer
  const clearHandles = useCallback(() => {
    if (handlesLayerRef.current) {
      handlesLayerRef.current.clearLayers()
    }
    handlesRef.current = []
    console.log('🧹 Cleared handles content')
  }, [])

  // Create transform handles around selected drawing
  const createTransformHandles = useCallback(() => {
    console.log('🎯 Creating transform handles...')
    clearHandles()
    
    if (!selectedDrawing || !selectedDrawing.geometry) {
      console.log('❌ No drawing or geometry to create handles for')
      return
    }

    const bounds = getDrawingBounds(selectedDrawing)
    if (!bounds) {
      console.log('❌ Could not calculate bounds for drawing')
      return
    }

    console.log('📐 Drawing bounds:', bounds)

    const handleSize = 12
    const handles = []

    // Calculate handle positions
    const handlePositions = [
      // Corner handles for resize
      { type: 'resize', position: 'nw', point: [bounds.north, bounds.west], cursor: 'nw-resize' },
      { type: 'resize', position: 'ne', point: [bounds.north, bounds.east], cursor: 'ne-resize' },
      { type: 'resize', position: 'se', point: [bounds.south, bounds.east], cursor: 'se-resize' },
      { type: 'resize', position: 'sw', point: [bounds.south, bounds.west], cursor: 'sw-resize' },
      
      // Edge handles for resize
      { type: 'resize', position: 'n', point: [bounds.north, (bounds.west + bounds.east) / 2], cursor: 'n-resize' },
      { type: 'resize', position: 'e', point: [(bounds.north + bounds.south) / 2, bounds.east], cursor: 'e-resize' },
      { type: 'resize', position: 's', point: [bounds.south, (bounds.west + bounds.east) / 2], cursor: 's-resize' },
      { type: 'resize', position: 'w', point: [(bounds.north + bounds.south) / 2, bounds.west], cursor: 'w-resize' },
    ]

    console.log('🎯 Creating', handlePositions.length, 'handles')

    // Create handle markers
    handlePositions.forEach((handleInfo, index) => {
      try {        
        const icon = createHandleIcon(handleInfo.type, handleInfo.position, handleSize)
        
        const marker = L.marker(handleInfo.point, {
          icon: icon,
          draggable: false,
          interactive: true,
          zIndexOffset: 1000
        })

        // 🔧 FIXED: Stable event handlers that don't cause re-renders
        marker.on('mousedown', (e) => {
          console.log('🖱️ HANDLE MOUSEDOWN FIRED!', handleInfo.position)
          
          try {
            e.originalEvent.stopPropagation()
            e.originalEvent.preventDefault()
            
            if (!mapRef.current || typeof mapRef.current.mouseEventToLatLng !== 'function') {
              console.error('❌ Map missing mouseEventToLatLng method!')
              return
            }
            
            const mapMousePos = mapRef.current.mouseEventToLatLng(e.originalEvent)
            console.log('📍 Starting transform from handle:', handleInfo.position)
            
            startTransform(handleInfo.type, handleInfo.position, e.originalEvent, mapMousePos)
          } catch (error) {
            console.error('❌ Error in handle mousedown:', error)
          }
        })

        // Add to map
        handlesLayerRef.current.addLayer(marker)
        handles.push({ ...handleInfo, marker })
        
        console.log('✅ Created stable handle:', handleInfo.position)
      } catch (error) {
        console.error('❌ Error creating handle:', handleInfo.position, error)
      }
    })

    handlesRef.current = handles
    
    // Create selection outline
    createSelectionOutline(bounds)
    
    console.log('✅ Created', handles.length, 'STABLE transform handles')
  }, [selectedDrawing, clearHandles])

  // Create handle icon
  const createHandleIcon = (type, position, size) => {
    let backgroundColor = '#ffffff'
    let borderColor = '#3B82F6'

    if (type === 'rotate') {
      backgroundColor = '#10B981'
      borderColor = '#059669'
    }

    const html = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${backgroundColor};
        border: 2px solid ${borderColor};
        border-radius: 2px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
        user-select: none;
        pointer-events: auto;
      "></div>
    `

    return L.divIcon({
      html: html,
      className: `transform-handle transform-handle-${type} transform-handle-${position}`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, 0]
    })
  }

  // Create selection outline
  const createSelectionOutline = (bounds) => {
    try {
      const outline = L.rectangle(
        [[bounds.south, bounds.west], [bounds.north, bounds.east]], 
        {
          color: '#3B82F6',
          weight: 2,
          fillOpacity: 0,
          opacity: 0.8,
          dashArray: '4,4',
          interactive: false,
          className: 'selection-outline'
        }
      )
      
      handlesLayerRef.current.addLayer(outline)
      console.log('✅ Created selection outline')
    } catch (error) {
      console.error('❌ Error creating selection outline:', error)
    }
  }

  // Start transform with proper coordinate handling
  const startTransform = useCallback((type, position, mouseEvent, mapMousePos) => {
    console.log('🚀 START TRANSFORM!', { type, position })
    
    try {
      setTransforming(true)
      setTransformType(type)
      
      const mousePos = { 
        screen: { x: mouseEvent.clientX, y: mouseEvent.clientY },
        map: { lat: mapMousePos.lat, lng: mapMousePos.lng }
      }
      setInitialMousePos(mousePos)
      
      const bounds = getDrawingBounds(selectedDrawing)
      setInitialBounds(bounds)
      
      transformDataRef.current = {
        type,
        position,
        initialBounds: bounds,
        initialMousePos: mousePos,
        startTime: Date.now()
      }

      // Add global mouse event listeners
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      // Disable map dragging during transform
      if (mapRef.current.dragging) {
        mapRef.current.dragging.disable()
      }
      
      if (onTransformStart) {
        onTransformStart(selectedDrawing, type, position)
      }

      console.log('✅ Transform started successfully!')
    } catch (error) {
      console.error('❌ Error in startTransform:', error)
    }
  }, [selectedDrawing, onTransformStart])

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    if (!transforming || !transformDataRef.current || !initialBounds || !mapRef.current) {
      return
    }

    try {
      const currentMapPos = mapRef.current.mouseEventToLatLng(e)
      
      const deltaLat = currentMapPos.lat - transformDataRef.current.initialMousePos.map.lat
      const deltaLng = currentMapPos.lng - transformDataRef.current.initialMousePos.map.lng

      const { type, position } = transformDataRef.current

      if (type === 'resize') {
        handleResize(position, deltaLat, deltaLng)
      }
    } catch (error) {
      console.error('❌ Error in handleMouseMove:', error)
    }
  }, [transforming, initialBounds])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    console.log('🏁 Transform ended')
    
    try {
      setTransforming(false)
      setTransformType(null)
      
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      
      if (mapRef.current.dragging) {
        mapRef.current.dragging.enable()
      }
      
      if (onTransformEnd && transformDataRef.current) {
        onTransformEnd(selectedDrawing, transformDataRef.current.type)
      }
      
      // Recreate handles after transform
      setTimeout(() => {
        if (selectedDrawing && shouldShowHandles) {
          createTransformHandles()
        }
      }, 100)
      
      transformDataRef.current = null
    } catch (error) {
      console.error('❌ Error in handleMouseUp:', error)
    }
  }, [onTransformEnd, selectedDrawing, shouldShowHandles, createTransformHandles, handleMouseMove])

  // Handle resize
  const handleResize = useCallback((position, deltaLat, deltaLng) => {
    if (!mapRef.current || !selectedDrawing || !initialBounds) return

    try {
      const newBounds = { ...initialBounds }

      switch (position) {
        case 'nw':
          newBounds.north += deltaLat
          newBounds.west += deltaLng
          break
        case 'ne':
          newBounds.north += deltaLat
          newBounds.east += deltaLng
          break
        case 'se':
          newBounds.south += deltaLat
          newBounds.east += deltaLng
          break
        case 'sw':
          newBounds.south += deltaLat
          newBounds.west += deltaLng
          break
        case 'n':
          newBounds.north += deltaLat
          break
        case 'e':
          newBounds.east += deltaLng
          break
        case 's':
          newBounds.south += deltaLat
          break
        case 'w':
          newBounds.west += deltaLng
          break
      }

      if (newBounds.north <= newBounds.south || newBounds.east <= newBounds.west) {
        return
      }

      const newGeometry = resizeGeometry(selectedDrawing.geometry, initialBounds, newBounds)
      
      if (onTransformUpdate && newGeometry) {
        onTransformUpdate(selectedDrawing.id, { geometry: newGeometry })
      }
    } catch (error) {
      console.error('❌ Error in handleResize:', error)
    }
  }, [selectedDrawing, initialBounds, onTransformUpdate])

  // Get drawing bounds for different geometry types
  const getDrawingBounds = (drawing) => {
    if (!drawing || !drawing.geometry) return null

    const { geometry } = drawing

    switch (geometry.type) {
      case 'rectangle':
        return geometry.bounds

      case 'circle':
        const radiusInDegrees = geometry.radius / 111000
        return {
          north: geometry.center.lat + radiusInDegrees,
          south: geometry.center.lat - radiusInDegrees,
          east: geometry.center.lng + radiusInDegrees,
          west: geometry.center.lng - radiusInDegrees
        }

      case 'polygon':
      case 'building':
      case 'boundary':
        if (!geometry.coordinates || geometry.coordinates.length === 0) return null
        
        const lats = geometry.coordinates.map(coord => coord[0])
        const lngs = geometry.coordinates.map(coord => coord[1])
        
        return {
          north: Math.max(...lats),
          south: Math.min(...lats),
          east: Math.max(...lngs),
          west: Math.min(...lngs)
        }

      case 'line':
      case 'freehand':
        if (!geometry.coordinates || geometry.coordinates.length === 0) return null
        
        const lineLats = geometry.coordinates.map(coord => coord[0])
        const lineLngs = geometry.coordinates.map(coord => coord[1])
        
        return {
          north: Math.max(...lineLats),
          south: Math.min(...lineLats),
          east: Math.max(...lineLngs),
          west: Math.min(...lineLngs)
        }

      case 'text':
        const padding = 0.001
        return {
          north: geometry.position.lat + padding,
          south: geometry.position.lat - padding,
          east: geometry.position.lng + padding,
          west: geometry.position.lng - padding
        }

      default:
        return null
    }
  }

  // Resize geometry to new bounds
  const resizeGeometry = (geometry, oldBounds, newBounds) => {
    const newGeometry = { ...geometry }

    const scaleX = (newBounds.east - newBounds.west) / (oldBounds.east - oldBounds.west)
    const scaleY = (newBounds.north - newBounds.south) / (oldBounds.north - oldBounds.south)

    switch (geometry.type) {
      case 'rectangle':
        newGeometry.bounds = newBounds
        break

      case 'circle':
        const avgScale = (scaleX + scaleY) / 2
        newGeometry.radius = geometry.radius * avgScale
        
        const centerLatRatio = (geometry.center.lat - oldBounds.south) / (oldBounds.north - oldBounds.south)
        const centerLngRatio = (geometry.center.lng - oldBounds.west) / (oldBounds.east - oldBounds.west)
        
        newGeometry.center = {
          lat: newBounds.south + centerLatRatio * (newBounds.north - newBounds.south),
          lng: newBounds.west + centerLngRatio * (newBounds.east - newBounds.west)
        }
        break

      case 'polygon':
      case 'building':
      case 'boundary':
      case 'line':
      case 'freehand':
        newGeometry.coordinates = geometry.coordinates.map(coord => {
          const latRatio = (coord[0] - oldBounds.south) / (oldBounds.north - oldBounds.south)
          const lngRatio = (coord[1] - oldBounds.west) / (oldBounds.east - oldBounds.west)
          
          return [
            newBounds.south + latRatio * (newBounds.north - newBounds.south),
            newBounds.west + lngRatio * (newBounds.east - newBounds.west)
          ]
        })
        break

      case 'text':
        const textLatRatio = (geometry.position.lat - oldBounds.south) / (oldBounds.north - oldBounds.south)
        const textLngRatio = (geometry.position.lng - oldBounds.west) / (oldBounds.east - oldBounds.west)
        
        newGeometry.position = {
          lat: newBounds.south + textLatRatio * (newBounds.north - newBounds.south),
          lng: newBounds.west + textLngRatio * (newBounds.east - newBounds.west)
        }
        break
    }

    return newGeometry
  }

  return null
}

export default TransformHandles