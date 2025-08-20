// Fixed transform hook with proper React-Leaflet v4 layer access
// Save this as: components/ProjectMap/hooks/useTransformableShape.js

import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'

// Transform types
const TRANSFORM_TYPES = {
  MOVE: 'move',
  SCALE: 'scale',
  ROTATE: 'rotate'
}

// Handle types for scaling
const HANDLE_TYPES = {
  TOP_LEFT: 'top-left',
  TOP_CENTER: 'top-center',
  TOP_RIGHT: 'top-right',
  MIDDLE_LEFT: 'middle-left',
  MIDDLE_RIGHT: 'middle-right',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_CENTER: 'bottom-center',
  BOTTOM_RIGHT: 'bottom-right',
  ROTATE: 'rotate'
}

export function useTransformableShape({ drawing, isSelected, mode, onTransformUpdate, drawingContext, layerRef }) {
  const map = useMap()
  const [handles, setHandles] = useState([])
  const isDragging = useRef(false)
  const transformData = useRef(null)
  const targetLayerRef = useRef(null)
  const previewLayerRef = useRef(null)
  const handlesGroupRef = useRef(null)
  const activeHandle = useRef(null)
  const transformType = useRef(null)
  const previousGeometry = useRef(null)
  
  // Check if we're in canvas mode (pixel coordinates)
  const isCanvasMode = drawingContext === 'canvas'
  
 // Helper function to get the actual Leaflet layer from React-Leaflet component
const getLeafletLayer = (reactLeafletRef) => {
  if (!reactLeafletRef?.current) {
    console.log('🔍 No ref.current')
    return null
  }
  
  const component = reactLeafletRef.current
  
  // Check if this is already a Leaflet layer by looking for Leaflet-specific properties
  if (component._leaflet_id && component._map) {
    console.log('✅ Found direct Leaflet layer with ID:', component._leaflet_id)
    return component
  }
  
  console.log('🔍 Inspecting layerRef.current:', {
    component,
    keys: Object.keys(component),
    constructor: component.constructor?.name,
    hasLeafletId: !!component._leaflet_id,
    hasMap: !!component._map
  })
  
  // Try the old methods as fallback
  if (component._layer) {
    console.log('✅ Found layer via _layer')
    return component._layer
  }
  if (component.leafletElement) {
    console.log('✅ Found layer via leafletElement')
    return component.leafletElement
  }
  
  console.log('❌ Could not find Leaflet layer')
  return null
}
  
  // Helper function to set opacity on handle group
  const setHandlesOpacity = (opacity) => {
    if (handlesGroupRef.current) {
      handlesGroupRef.current.eachLayer(layer => {
        if (layer.setStyle) {
          layer.setStyle({ opacity: opacity, fillOpacity: opacity * 0.8 })
        }
      })
    }
  }

  // Helper functions
  function getCursorForHandle(handleType) {
    switch (handleType) {
      case HANDLE_TYPES.TOP_LEFT:
      case HANDLE_TYPES.BOTTOM_RIGHT:
        return 'nwse-resize'
      case HANDLE_TYPES.TOP_RIGHT:
      case HANDLE_TYPES.BOTTOM_LEFT:
        return 'nesw-resize'
      case HANDLE_TYPES.TOP_CENTER:
      case HANDLE_TYPES.BOTTOM_CENTER:
        return 'ns-resize'
      case HANDLE_TYPES.MIDDLE_LEFT:
      case HANDLE_TYPES.MIDDLE_RIGHT:
        return 'ew-resize'
      case HANDLE_TYPES.ROTATE:
        return 'grab'
      default:
        return 'pointer'
    }
  }

  function getShapeCenter(geometry) {
    switch (geometry.type) {
      case 'rectangle':
        return {
          lat: (geometry.bounds.north + geometry.bounds.south) / 2,
          lng: (geometry.bounds.west + geometry.bounds.east) / 2
        }
      case 'circle':
        return geometry.center
      case 'polygon':
      case 'building':
      case 'boundary':
      case 'line':
      case 'freehand':
        const coords = geometry.coordinates
        const avgLat = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length
        const avgLng = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length
        return { lat: avgLat, lng: avgLng }
      case 'text':
        return geometry.position
      default:
        return { lat: 0, lng: 0 }
    }
  }

  function getShapeBounds(geometry) {
    switch (geometry.type) {
      case 'rectangle':
        return geometry.bounds
      case 'circle':
        const radius = geometry.radius || 0.001
        return {
          north: geometry.center.lat + radius,
          south: geometry.center.lat - radius,
          east: geometry.center.lng + radius,
          west: geometry.center.lng - radius
        }
      case 'polygon':
      case 'building':
      case 'boundary':
      case 'line':
      case 'freehand':
        const coords = geometry.coordinates
        const lats = coords.map(c => c[0])
        const lngs = coords.map(c => c[1])
        return {
          north: Math.max(...lats),
          south: Math.min(...lats),
          east: Math.max(...lngs),
          west: Math.min(...lngs)
        }
      case 'text':
        const padding = 0.0001
        return {
          north: geometry.position.lat + padding,
          south: geometry.position.lat - padding,
          east: geometry.position.lng + padding,
          west: geometry.position.lng - padding
        }
      default:
        return { north: 0, south: 0, east: 0, west: 0 }
    }
  }

  function createPreviewLayer(geometry, style, transform = null) {
    if (typeof window === 'undefined' || !window.L) return null
    
    const L = window.L
    const previewStyle = {
      ...style,
      color: '#3B82F6',
      weight: 2,
      dashArray: '5, 5',
      fillOpacity: 0.1,
      opacity: 0.8
    }

    switch (geometry.type) {
      case 'rectangle':
        return L.rectangle([
          [geometry.bounds.south, geometry.bounds.west],
          [geometry.bounds.north, geometry.bounds.east]
        ], previewStyle)
        
      case 'circle':
        return L.circle([geometry.center.lat, geometry.center.lng], {
          ...previewStyle,
          radius: geometry.radius
        })
        
      case 'polygon':
      case 'building':
      case 'boundary':
        const polygonCoords = geometry.coordinates.map(c => [c[0], c[1]])
        return L.polygon(polygonCoords, previewStyle)
        
      case 'line':
      case 'freehand':
        const lineCoords = geometry.coordinates.map(c => [c[0], c[1]])
        return L.polyline(lineCoords, previewStyle)
        
      case 'text':
        return L.marker([geometry.position.lat, geometry.position.lng], {
          icon: L.divIcon({
            className: 'text-preview-marker',
            html: `<div style="color: #3B82F6; opacity: 0.8;">${geometry.text || 'Text'}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, 10]
          })
        })
        
      default:
        return null
    }
  }

  function calculateScale(handleType, startPos, currentPos, center, bounds) {
    const startDist = {
      x: Math.abs(startPos.lng - center.lng),
      y: Math.abs(startPos.lat - center.lat)
    }
    const currentDist = {
      x: Math.abs(currentPos.lng - center.lng),
      y: Math.abs(currentPos.lat - center.lat)
    }
    
    let scaleX = 1, scaleY = 1
    
    switch (handleType) {
      case HANDLE_TYPES.TOP_LEFT:
      case HANDLE_TYPES.TOP_RIGHT:
      case HANDLE_TYPES.BOTTOM_LEFT:
      case HANDLE_TYPES.BOTTOM_RIGHT:
        const startDiag = Math.sqrt(startDist.x * startDist.x + startDist.y * startDist.y)
        const currentDiag = Math.sqrt(currentDist.x * currentDist.x + currentDist.y * currentDist.y)
        const uniformScale = currentDiag / startDiag
        return { scale: { x: uniformScale, y: uniformScale, uniform: uniformScale } }
        
      case HANDLE_TYPES.TOP_CENTER:
      case HANDLE_TYPES.BOTTOM_CENTER:
        scaleY = currentDist.y / startDist.y
        return { scale: { x: 1, y: scaleY } }
        
      case HANDLE_TYPES.MIDDLE_LEFT:
      case HANDLE_TYPES.MIDDLE_RIGHT:
        scaleX = currentDist.x / startDist.x
        return { scale: { x: scaleX, y: 1 } }
        
      default:
        return { scale: { x: 1, y: 1 } }
    }
  }

  function moveGeometryInCanvasMode(geometry, pixelDeltaX, pixelDeltaY, map) {
    const newGeometry = JSON.parse(JSON.stringify(geometry))
    
    const movePointByPixels = (lat, lng) => {
      const originalPoint = map.latLngToContainerPoint([lat, lng])
      const newPoint = window.L.point(
        originalPoint.x + pixelDeltaX,
        originalPoint.y + pixelDeltaY
      )
      const newLatLng = map.containerPointToLatLng(newPoint)
      
      return {
        lat: newLatLng.lat,
        lng: newLatLng.lng
      }
    }
    
    switch (geometry.type) {
      case 'rectangle':
        const topLeft = movePointByPixels(geometry.bounds.north, geometry.bounds.west)
        const bottomRight = movePointByPixels(geometry.bounds.south, geometry.bounds.east)
        
        newGeometry.bounds = {
          north: topLeft.lat,
          south: bottomRight.lat,
          east: bottomRight.lng,
          west: topLeft.lng
        }
        break
        
      case 'circle':
        const newCenter = movePointByPixels(geometry.center.lat, geometry.center.lng)
        newGeometry.center = newCenter
        break
        
      case 'polygon':
      case 'building':
      case 'boundary':
      case 'line':
      case 'freehand':
        newGeometry.coordinates = geometry.coordinates.map(coord => {
          const moved = movePointByPixels(coord[0], coord[1])
          return [moved.lat, moved.lng]
        })
        break
        
      case 'text':
        const newPos = movePointByPixels(geometry.position.lat, geometry.position.lng)
        newGeometry.position = newPos
        break
    }
    
    return newGeometry
  }

  function moveGeometry(geometry, deltaLat, deltaLng) {
    const newGeometry = { ...geometry }
    
    switch (geometry.type) {
      case 'rectangle':
        newGeometry.bounds = {
          north: geometry.bounds.north + deltaLat,
          south: geometry.bounds.south + deltaLat,
          east: geometry.bounds.east + deltaLng,
          west: geometry.bounds.west + deltaLng
        }
        break
        
      case 'circle':
        newGeometry.center = {
          lat: geometry.center.lat + deltaLat,
          lng: geometry.center.lng + deltaLng
        }
        break
        
      case 'polygon':
      case 'building':
      case 'boundary':
      case 'line':
      case 'freehand':
        newGeometry.coordinates = geometry.coordinates.map(coord => [
          coord[0] + deltaLat,
          coord[1] + deltaLng
        ])
        break
        
      case 'text':
        newGeometry.position = {
          lat: geometry.position.lat + deltaLat,
          lng: geometry.position.lng + deltaLng
        }
        break
    }
    
    return newGeometry
  }

  function applyTransform(geometry, transform) {
    const { rotation, scale, center } = transform
    const newGeometry = JSON.parse(JSON.stringify(geometry))
    
    const rotatePoint = (point, angle, center) => {
      const centerScreen = map.latLngToContainerPoint([center.lat, center.lng])
      const pointScreen = map.latLngToContainerPoint([point.lat, point.lng])
      
      const rad = angle * Math.PI / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      
      const x = pointScreen.x - centerScreen.x
      const y = pointScreen.y - centerScreen.y
      
      const rotatedX = centerScreen.x + (x * cos - y * sin)
      const rotatedY = centerScreen.y + (x * sin + y * cos)
      
      const rotatedLatLng = map.containerPointToLatLng([rotatedX, rotatedY])
      
      return {
        lat: rotatedLatLng.lat,
        lng: rotatedLatLng.lng
      }
    }
    
    const scalePoint = (point, scale, center) => {
      if (isCanvasMode) {
        const centerScreen = map.latLngToContainerPoint([center.lat, center.lng])
        const pointScreen = map.latLngToContainerPoint([point.lat, point.lng])
        
        const scaledX = centerScreen.x + (pointScreen.x - centerScreen.x) * (scale.x || scale.uniform || 1)
        const scaledY = centerScreen.y + (pointScreen.y - centerScreen.y) * (scale.y || scale.uniform || 1)
        
        const scaledLatLng = map.containerPointToLatLng([scaledX, scaledY])
        
        return {
          lat: scaledLatLng.lat,
          lng: scaledLatLng.lng
        }
      } else {
        return {
          lat: center.lat + (point.lat - center.lat) * (scale.y || scale.uniform || 1),
          lng: center.lng + (point.lng - center.lng) * (scale.x || scale.uniform || 1)
        }
      }
    }
        
    switch (geometry.type) {
      case 'rectangle':
        const corners = [
          { lat: geometry.bounds.north, lng: geometry.bounds.west },
          { lat: geometry.bounds.north, lng: geometry.bounds.east },
          { lat: geometry.bounds.south, lng: geometry.bounds.east },
          { lat: geometry.bounds.south, lng: geometry.bounds.west }
        ]
        
        let transformedCorners = corners
        
        if (scale) {
          transformedCorners = transformedCorners.map(c => scalePoint(c, scale, center))
        }
        
        if (rotation) {
          transformedCorners = transformedCorners.map(c => rotatePoint(c, rotation, center))
        }
        
        if (rotation) {
          newGeometry.type = 'polygon'
          newGeometry.coordinates = transformedCorners.map(c => [c.lat, c.lng])
          delete newGeometry.bounds
        } else {
          newGeometry.bounds = {
            north: Math.max(...transformedCorners.map(c => c.lat)),
            south: Math.min(...transformedCorners.map(c => c.lat)),
            east: Math.max(...transformedCorners.map(c => c.lng)),
            west: Math.min(...transformedCorners.map(c => c.lng))
          }
        }
        break
        
      case 'circle':
        if (scale) {
          newGeometry.radius = geometry.radius * (scale.uniform || scale.x || 1)
        }
        break
        
      case 'polygon':
      case 'building':
      case 'boundary':
      case 'line':
      case 'freehand':
        newGeometry.coordinates = geometry.coordinates.map(coord => {
          let point = { lat: coord[0], lng: coord[1] }
          
          if (scale) {
            point = scalePoint(point, scale, center)
          }
          if (rotation) {
            point = rotatePoint(point, rotation, center)
          }
          
          return [point.lat, point.lng]
        })
        break
        
      case 'text':
        // For text, only apply rotation and position changes
        break
    }
    
    return newGeometry
  }

  function updatePreviewLayer(layer, geometry, originalType) {
    if (!layer) return
    
    switch (geometry.type || originalType) {
      case 'rectangle':
        layer.setBounds([
          [geometry.bounds.south, geometry.bounds.west],
          [geometry.bounds.north, geometry.bounds.east]
        ])
        break
        
      case 'circle':
        layer.setLatLng([geometry.center.lat, geometry.center.lng])
        if (geometry.radius !== layer.getRadius()) {
          layer.setRadius(geometry.radius)
        }
        break
        
      case 'polygon':
      case 'building':
      case 'boundary':
        const polygonCoords = geometry.coordinates.map(c => [c[0], c[1]])
        layer.setLatLngs(polygonCoords)
        break
        
      case 'line':
      case 'freehand':
        const lineCoords = geometry.coordinates.map(c => [c[0], c[1]])
        layer.setLatLngs(lineCoords)
        break
        
      case 'text':
        layer.setLatLng([geometry.position.lat, geometry.position.lng])
        break
    }
  }

  // Mouse move handler with canvas mode support
  const onMouseMove = (e) => {
    if (!isDragging.current || !transformData.current || !previewLayerRef.current) return
    
    const currentLatLng = e.latlng
    let newGeometry
    
    switch (transformType.current) {
      case TRANSFORM_TYPES.MOVE:
        if (isCanvasMode) {
          const startPoint = map.latLngToContainerPoint(transformData.current.startMouseLatLng)
          const currentPoint = map.latLngToContainerPoint(currentLatLng)
          
          const pixelDeltaX = currentPoint.x - startPoint.x
          const pixelDeltaY = currentPoint.y - startPoint.y
          
          newGeometry = moveGeometryInCanvasMode(
            transformData.current.startGeometry,
            pixelDeltaX,
            pixelDeltaY,
            map
          )
        } else {
          const deltaLat = currentLatLng.lat - transformData.current.startMouseLatLng.lat
          const deltaLng = currentLatLng.lng - transformData.current.startMouseLatLng.lng
          newGeometry = moveGeometry(transformData.current.startGeometry, deltaLat, deltaLng)
        }
        break
        
      case TRANSFORM_TYPES.ROTATE:
        const center = transformData.current.center
        const centerPoint = map.latLngToContainerPoint([center.lat, center.lng])
        const currentPoint = map.latLngToContainerPoint(currentLatLng)
        const startPoint = map.latLngToContainerPoint(transformData.current.startMouseLatLng)
        
        const currentAngle = Math.atan2(currentPoint.y - centerPoint.y, currentPoint.x - centerPoint.x)
        const startAngle = Math.atan2(startPoint.y - centerPoint.y, startPoint.x - centerPoint.x)
        const angleDelta = (currentAngle - startAngle) * 180 / Math.PI
        
        const newRotation = (transformData.current.currentRotation + angleDelta + 360) % 360
        
        const rotationTransform = {
          rotation: newRotation,
          center: center
        }
        newGeometry = transformData.current.startGeometry
        
        transformData.current.newRotation = newRotation
        
        if (previewLayerRef.current) {
          map.removeLayer(previewLayerRef.current)
          previewLayerRef.current = createPreviewLayer(
            transformData.current.startGeometry, 
            drawing.style,
            rotationTransform
          )
          previewLayerRef.current.addTo(map)
        }
        return
        
      case TRANSFORM_TYPES.SCALE:
        if (drawing.geometry.type === 'text') {
          return
        }
        
        if (isCanvasMode) {
          const center = transformData.current.center
          const centerPoint = map.latLngToContainerPoint([center.lat, center.lng])
          const startPoint = map.latLngToContainerPoint(transformData.current.startMouseLatLng)
          const currentPoint = map.latLngToContainerPoint(currentLatLng)
          
          const startDist = Math.sqrt(
            Math.pow(startPoint.x - centerPoint.x, 2) + 
            Math.pow(startPoint.y - centerPoint.y, 2)
          )
          const currentDist = Math.sqrt(
            Math.pow(currentPoint.x - centerPoint.x, 2) + 
            Math.pow(currentPoint.y - centerPoint.y, 2)
          )
          
          const scale = currentDist / startDist
          
          const scaleTransform = {
            scale: { x: scale, y: scale, uniform: scale },
            center: transformData.current.center
          }
          newGeometry = applyTransform(transformData.current.startGeometry, scaleTransform)
          
          transformData.current.newScale = scaleTransform.scale
        } else {
          const scaleData = calculateScale(
            transformData.current.handleType,
            transformData.current.startMouseLatLng,
            currentLatLng,
            transformData.current.center,
            transformData.current.bounds
          )
          
          const scaleTransform = {
            scale: scaleData.scale,
            center: transformData.current.center
          }
          newGeometry = applyTransform(transformData.current.startGeometry, scaleTransform)
          
          transformData.current.newScale = scaleData.scale
        }
        break
    }
    
    if (newGeometry) {
      updatePreviewLayer(previewLayerRef.current, newGeometry, drawing.geometry.type)
    }
  }
  
  // Mouse up handler
  const onMouseUp = (e) => {
    if (!isDragging.current || !transformData.current) return
    
    console.log('🏁 Transform complete')
    
    map.off('mousemove', onMouseMove)
    map.off('mouseup', onMouseUp)
    
    if (previewLayerRef.current) {
      map.removeLayer(previewLayerRef.current)
      previewLayerRef.current = null
    }
    
    if (targetLayerRef.current && targetLayerRef.current._path) {
      targetLayerRef.current._path.style.opacity = ''
      targetLayerRef.current._path.style.cursor = ''
    }
    
    setHandlesOpacity(1)
    
    let updates = {}
    
    switch (transformType.current) {
      case TRANSFORM_TYPES.MOVE:
        if (isCanvasMode) {
          const startPoint = map.latLngToContainerPoint(transformData.current.startMouseLatLng)
          const currentPoint = map.latLngToContainerPoint(e.latlng)
          
          const pixelDeltaX = currentPoint.x - startPoint.x
          const pixelDeltaY = currentPoint.y - startPoint.y
          
          if (Math.abs(pixelDeltaX) > 1 || Math.abs(pixelDeltaY) > 1) {
            updates.geometry = moveGeometryInCanvasMode(
              transformData.current.startGeometry,
              pixelDeltaX,
              pixelDeltaY,
              map
            )
          }
        } else {
          const deltaLat = e.latlng.lat - transformData.current.startMouseLatLng.lat
          const deltaLng = e.latlng.lng - transformData.current.startMouseLatLng.lng
          if (Math.abs(deltaLat) > 0.00001 || Math.abs(deltaLng) > 0.00001) {
            updates.geometry = moveGeometry(transformData.current.startGeometry, deltaLat, deltaLng)
          }
        }
        break
        
      case TRANSFORM_TYPES.ROTATE:
        if (transformData.current.newRotation !== undefined) {
          const rotationTransform = {
            rotation: transformData.current.newRotation,
            center: transformData.current.center
          }
          
          updates.geometry = applyTransform(transformData.current.startGeometry, rotationTransform)
          updates.transform = {
            ...(drawing.transform || {}),
            rotation: transformData.current.newRotation
          }
        }
        break
        
      case TRANSFORM_TYPES.SCALE:
        if (transformData.current.newScale && drawing.geometry.type !== 'text') {
          updates.transform = {
            ...(drawing.transform || {}),
            scale: transformData.current.newScale
          }
          updates.geometry = applyTransform(transformData.current.startGeometry, {
            scale: transformData.current.newScale,
            center: transformData.current.center
          })
        }
        break
    }
    
    if (Object.keys(updates).length > 0 && onTransformUpdate) {
      onTransformUpdate(drawing.id, updates, { isTemporary: false })
    }
    
    isDragging.current = false
    transformData.current = null
    transformType.current = null
    activeHandle.current = null
    map.getContainer().style.cursor = ''
    map.dragging.enable()
  }
  
  // Handle interactions
  const onHandleMouseDown = (e, handleType) => {
    console.log('🎯 Handle grabbed:', handleType)
    
    if (typeof window === 'undefined' || !window.L) return
    const L = window.L
    
    L.DomEvent.stopPropagation(e)
    L.DomEvent.preventDefault(e)
    
    isDragging.current = true
    activeHandle.current = handleType
    
    if (handleType === HANDLE_TYPES.ROTATE) {
      transformType.current = TRANSFORM_TYPES.ROTATE
    } else {
      transformType.current = TRANSFORM_TYPES.SCALE
    }
    
    const startLatLng = e.latlng
    const center = getShapeCenter(drawing.geometry)
    const bounds = getShapeBounds(drawing.geometry)
    
    transformData.current = {
      startMouseLatLng: startLatLng,
      startGeometry: JSON.parse(JSON.stringify(drawing.geometry)),
      center: center,
      bounds: bounds,
      handleType: handleType,
      currentRotation: drawing.transform?.rotation || 0,
      currentScale: drawing.transform?.scale || { x: 1, y: 1 }
    }
    
    if (targetLayerRef.current) {
      if (targetLayerRef.current._path) {
        targetLayerRef.current._path.style.opacity = '0.3'
      } else if (targetLayerRef.current._icon) {
        targetLayerRef.current._icon.style.opacity = '0.3'
      }
    }
    
    previewLayerRef.current = createPreviewLayer(drawing.geometry, drawing.style)
    if (previewLayerRef.current) {
      previewLayerRef.current.addTo(map)
    }
    
    setHandlesOpacity(0.3)
    
    map.getContainer().style.cursor = handleType === HANDLE_TYPES.ROTATE ? 'grabbing' : 'nwse-resize'
    map.dragging.disable()
    
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)
  }
  
  // Shape click for move
  const onShapeMouseDown = (e) => {
    if (isDragging.current) return
    
    if (typeof window === 'undefined' || !window.L) return
    const L = window.L
    
    L.DomEvent.stopPropagation(e)
    
    console.log('🎯 Shape clicked for move')
    
    isDragging.current = true
    transformType.current = TRANSFORM_TYPES.MOVE
    activeHandle.current = null
    
    const startLatLng = e.latlng
    transformData.current = {
      startMouseLatLng: startLatLng,
      startGeometry: JSON.parse(JSON.stringify(drawing.geometry))
    }
    
    if (targetLayerRef.current) {
      if (targetLayerRef.current._path) {
        targetLayerRef.current._path.style.opacity = '0.3'
        targetLayerRef.current._path.style.cursor = 'move'
      } else if (targetLayerRef.current._icon) {
        targetLayerRef.current._icon.style.opacity = '0.3'
        targetLayerRef.current._icon.style.cursor = 'move'
      }
    }
    
    previewLayerRef.current = createPreviewLayer(drawing.geometry, drawing.style)
    if (previewLayerRef.current) {
      previewLayerRef.current.addTo(map)
    }
    
    setHandlesOpacity(0.3)
    
    map.getContainer().style.cursor = 'move'
    map.dragging.disable()
    
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)
  }
  
  // Create handles function
  const createHandles = () => {
    const bounds = getShapeBounds(drawing.geometry)
    if (!bounds) return
    
    console.log('🔨 Creating handles for:', drawing.name)
    
    if (handlesGroupRef.current) {
      map.removeLayer(handlesGroupRef.current)
      handlesGroupRef.current = null
    }
    
    if (typeof window === 'undefined' || !window.L) return
    const L = window.L
    
    handlesGroupRef.current = L.layerGroup()
    
    const positions = []
    
    if (drawing.geometry.type !== 'text') {
      positions.push({
        type: HANDLE_TYPES.TOP_LEFT,
        position: { lat: bounds.north, lng: bounds.west }
      })
      positions.push({
        type: HANDLE_TYPES.TOP_RIGHT,
        position: { lat: bounds.north, lng: bounds.east }
      })
      positions.push({
        type: HANDLE_TYPES.BOTTOM_LEFT,
        position: { lat: bounds.south, lng: bounds.west }
      })
      positions.push({
        type: HANDLE_TYPES.BOTTOM_RIGHT,
        position: { lat: bounds.south, lng: bounds.east }
      })
      
      positions.push({
        type: HANDLE_TYPES.TOP_CENTER,
        position: { lat: bounds.north, lng: (bounds.west + bounds.east) / 2 }
      })
      positions.push({
        type: HANDLE_TYPES.BOTTOM_CENTER,
        position: { lat: bounds.south, lng: (bounds.west + bounds.east) / 2 }
      })
      positions.push({
        type: HANDLE_TYPES.MIDDLE_LEFT,
        position: { lat: (bounds.north + bounds.south) / 2, lng: bounds.west }
      })
      positions.push({
        type: HANDLE_TYPES.MIDDLE_RIGHT,
        position: { lat: (bounds.north + bounds.south) / 2, lng: bounds.east }
      })
    }
    
    if (drawing.geometry.type === 'text') {
      const center = getShapeCenter(drawing.geometry)
      const centerPoint = map.latLngToContainerPoint([center.lat, center.lng])
      const handlePoint = L.point(centerPoint.x, centerPoint.y - 40)
      const handleLatLng = map.containerPointToLatLng(handlePoint)
      
      positions.push({
        type: HANDLE_TYPES.ROTATE,
        position: { lat: handleLatLng.lat, lng: handleLatLng.lng }
      })
    } else {
      const rotateOffset = (bounds.north - bounds.south) * 0.15
      positions.push({
        type: HANDLE_TYPES.ROTATE,
        position: { lat: bounds.north + rotateOffset, lng: (bounds.west + bounds.east) / 2 }
      })
    }
    
    const createdHandles = []
    const allowedHandles = drawing.geometry.type === 'text' 
      ? [HANDLE_TYPES.ROTATE] 
      : positions.map(h => h.type)
    
    positions.forEach(({ type, position }) => {
      if (drawing.geometry.type === 'text' && !allowedHandles.includes(type)) {
        return
      }
      
      const isRotateHandle = type === HANDLE_TYPES.ROTATE
      const radius = isRotateHandle ? 10 : 8
      const color = isRotateHandle ? '#10B981' : '#3B82F6'
      
      const handle = L.circleMarker([position.lat, position.lng], {
        radius: radius,
        fillColor: 'white',
        color: color,
        weight: 3,
        opacity: 1,
        fillOpacity: 1,
        interactive: true,
        bubblingMouseEvents: false,
        pane: 'markerPane'
      })
      
      handle._originalRadius = radius
      handle._originalWeight = 3
      handle._handleType = type
      
      let isHovered = false
      
      handle.on('mousedown', (e) => {
        onHandleMouseDown(e, type)
      })
      
      handle.on('mouseover', (e) => {
        L.DomEvent.stopPropagation(e)
        if (!isHovered && !isDragging.current) {
          isHovered = true
          handle.setStyle({
            radius: radius + 2,
            weight: 4
          })
          map.getContainer().style.cursor = getCursorForHandle(type)
        }
      })
      
      handle.on('mouseout', (e) => {
        L.DomEvent.stopPropagation(e)
        if (isHovered && !isDragging.current) {
          isHovered = false
          handle.setStyle({
            radius: handle._originalRadius,
            weight: handle._originalWeight
          })
          map.getContainer().style.cursor = ''
        }
      })
      
      handle.addTo(handlesGroupRef.current)
      createdHandles.push(handle)
      
      if (isRotateHandle) {
        const centerPos = getShapeCenter(drawing.geometry)
        if (centerPos) {
          const line = L.polyline([
            [position.lat, position.lng],
            [centerPos.lat, centerPos.lng]
          ], {
            color: '#10B981',
            weight: 2,
            dashArray: '4, 4',
            interactive: false
          })
          line.addTo(handlesGroupRef.current)
        }
      }
    })
    
    handlesGroupRef.current.addTo(map)
    if (handlesGroupRef.current._container) {
      handlesGroupRef.current._container.style.zIndex = 1000
    }
    
    setHandles(createdHandles)
    console.log(`✅ Created ${createdHandles.length} handles`)
    
    return createdHandles
  }

  // Main useEffect for setting up transforms
  useEffect(() => {
    console.log('🔍 Transform useEffect triggered:', {
      isSelected,
      hasDrawing: !!drawing,
      drawingName: drawing?.name,
      mode,
      hasMap: !!map,
      hasLayerRef: !!layerRef,
      layerRefCurrent: !!layerRef?.current
    })

    if (!isSelected || !drawing || mode !== 'drawing' || !map) {
      if (handlesGroupRef.current) {
        map.removeLayer(handlesGroupRef.current)
        handlesGroupRef.current = null
      }
      return
    }
    
    if (typeof window === 'undefined' || !window.L) {
      return
    }
    
    const setupTransforms = () => {
      // Use the new helper function to get the actual Leaflet layer
      const layer = getLeafletLayer(layerRef)
      
      console.log('🔧 setupTransforms called:', {
        hasLayerRef: !!layerRef,
        hasLayer: !!layer,
        layerType: layer?.constructor?.name,
        drawingName: drawing?.name
      })
      
      if (!layer) {
        console.log('❌ Layer not ready yet, retrying...')
        return false
      }
      
      console.log('✅ Found layer via ref for transforms:', drawing.name, layer)
      
      targetLayerRef.current = layer
      
      if (layer.off) layer.off('mousedown')
      if (layer.on) layer.on('mousedown', onShapeMouseDown)
      
      if (drawing.geometry.type === 'text' && layer.dragging) {
        layer.dragging.disable()
      }
      
      createHandles()
      
      return true
    }
    
    if (!setupTransforms()) {
      const retryTimeout = setTimeout(() => {
        setupTransforms()
      }, 100)
      
      return () => clearTimeout(retryTimeout)
    }
    
    return () => {
      if (targetLayerRef.current) {
        targetLayerRef.current.off('mousedown')
        if (targetLayerRef.current._path) {
          targetLayerRef.current._path.style.cursor = ''
          targetLayerRef.current._path.style.opacity = ''
        } else if (targetLayerRef.current._icon) {
          targetLayerRef.current._icon.style.cursor = ''
          targetLayerRef.current._icon.style.opacity = ''
        }
        if (drawing.geometry.type === 'text' && targetLayerRef.current.dragging) {
          targetLayerRef.current.dragging.enable()
        }
      }
      if (previewLayerRef.current && map.hasLayer(previewLayerRef.current)) {
        map.removeLayer(previewLayerRef.current)
      }
      if (handlesGroupRef.current) {
        map.removeLayer(handlesGroupRef.current)
      }
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
    }
  }, [map, drawing, isSelected, mode, onTransformUpdate, isCanvasMode, layerRef])
  
  // Effect to update handles when geometry changes
  useEffect(() => {
    if (isSelected && mode === 'drawing' && drawing && previousGeometry.current) {
      const geometryChanged = JSON.stringify(drawing.geometry) !== JSON.stringify(previousGeometry.current)
      
      if (geometryChanged && handlesGroupRef.current) {
        console.log('📐 Geometry changed, updating handles')
        
        if (handlesGroupRef.current) {
          map.removeLayer(handlesGroupRef.current)
          handlesGroupRef.current = null
        }
      }
    }
    
    previousGeometry.current = drawing ? JSON.parse(JSON.stringify(drawing.geometry)) : null
  }, [drawing?.geometry, isSelected, mode, map])

  return { handles }
}