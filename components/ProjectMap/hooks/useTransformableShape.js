// Fixed transform hook with corrected rotation logic
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
  
  // New refs for rotation feedback
  const rotationFeedbackRef = useRef(null)
  const rotationCenterMarkerRef = useRef(null)
  const rotationGuideLineRef = useRef(null)
  
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

  // NEW: Create rotation feedback UI
  const createRotationFeedback = (center, currentAngle) => {
    if (typeof window === 'undefined' || !window.L) return
    const L = window.L
    
    // Remove existing feedback
    removeRotationFeedback()
    
    // Create center marker
    rotationCenterMarkerRef.current = L.circleMarker([center.lat, center.lng], {
      radius: 4,
      fillColor: '#10B981',
      color: '#10B981',
      weight: 2,
      opacity: 1,
      fillOpacity: 1,
      interactive: false,
      pane: 'markerPane'
    }).addTo(map)
    
    // Create angle display
    const centerPoint = map.latLngToContainerPoint([center.lat, center.lng])
    const displayPoint = L.point(centerPoint.x, centerPoint.y - 60)
    const displayLatLng = map.containerPointToLatLng(displayPoint)
    
    rotationFeedbackRef.current = L.marker([displayLatLng.lat, displayLatLng.lng], {
      icon: L.divIcon({
        className: 'rotation-feedback',
        html: `
          <div style="
            background: rgba(59, 130, 246, 0.95);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
          ">
            ${Math.round(currentAngle)}°
          </div>
        `,
        iconSize: [60, 20],
        iconAnchor: [30, 10]
      }),
      interactive: false,
      pane: 'markerPane'
    }).addTo(map)
  }
  
  // NEW: Remove rotation feedback
  const removeRotationFeedback = () => {
    if (rotationFeedbackRef.current) {
      map.removeLayer(rotationFeedbackRef.current)
      rotationFeedbackRef.current = null
    }
    if (rotationCenterMarkerRef.current) {
      map.removeLayer(rotationCenterMarkerRef.current)
      rotationCenterMarkerRef.current = null
    }
    if (rotationGuideLineRef.current) {
      map.removeLayer(rotationGuideLineRef.current)
      rotationGuideLineRef.current = null
    }
  }
  
  // NEW: Snap angle to common increments
  const snapAngle = (angle, snapIncrement = 15) => {
    if (!transformData.current?.isSnapping) return angle
    
    const snapped = Math.round(angle / snapIncrement) * snapIncrement
    return snapped % 360
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
        const radius = 0.0001
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
      weight: 3,
      dashArray: '8, 4',
      fillOpacity: 0.15,
      opacity: 0.9
    }

    let layer = null

    switch (geometry.type) {
      case 'rectangle':
        layer = L.rectangle([
          [geometry.bounds.south, geometry.bounds.west],
          [geometry.bounds.north, geometry.bounds.east]
        ], previewStyle)
        break
        
      case 'circle':
        layer = L.circle([geometry.center.lat, geometry.center.lng], {
          ...previewStyle,
          radius: geometry.radius
        })
        break
        
      case 'polygon':
      case 'building':
      case 'boundary':
        const polygonCoords = geometry.coordinates.map(c => [c[0], c[1]])
        layer = L.polygon(polygonCoords, previewStyle)
        break
        
      case 'line':
      case 'freehand':
        const lineCoords = geometry.coordinates.map(c => [c[0], c[1]])
        layer = L.polyline(lineCoords, previewStyle)
        break
        
      case 'text':
        layer = L.marker([geometry.position.lat, geometry.position.lng], {
          icon: L.divIcon({
            className: 'text-preview-marker',
            html: `<div style="color: #3B82F6; opacity: 0.8; font-weight: bold;">${geometry.text || 'Text'}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, 10]
          })
        })
        break
        
      default:
        return null
    }
    
    return layer
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
        if (rotation) {
          // Circle center can be rotated
          const rotatedCenter = rotatePoint(geometry.center, rotation, center)
          newGeometry.center = rotatedCenter
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
        // FIXED: Apply rotation to text position
        if (rotation) {
          const rotatedPos = rotatePoint(geometry.position, rotation, center)
          newGeometry.position = rotatedPos
        }
        if (scale) {
          // Text can be scaled (font size, etc.) - but keep position
          const scaledPos = scalePoint(geometry.position, scale, center)
          newGeometry.position = scaledPos
        }
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

  // ENHANCED: Mouse move handler with improved rotation feedback
  const onMouseMove = (e) => {
    if (!isDragging.current || !transformData.current) return
    
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
        
        // FIXED: Calculate angle relative to the handle, not the mouse start position
        const currentAngle = Math.atan2(currentPoint.y - centerPoint.y, currentPoint.x - centerPoint.x)
        const startAngle = Math.atan2(startPoint.y - centerPoint.y, startPoint.x - centerPoint.x)
        let angleDelta = (currentAngle - startAngle) * 180 / Math.PI
        
        // FIXED: Use absolute rotation instead of adding to current rotation
        let newRotation = angleDelta
        
        // NEW: Apply angle snapping when Shift key is held
        if (e.originalEvent?.shiftKey) {
          transformData.current.isSnapping = true
          newRotation = snapAngle(newRotation, 15)
        } else {
          transformData.current.isSnapping = false
        }
        
        // Normalize angle
        newRotation = (newRotation + 360) % 360
        
        // NEW: Update rotation feedback
        createRotationFeedback(center, newRotation)
        
        const rotationTransform = {
          rotation: newRotation,
          center: center
        }
        
        // Apply rotation to get new geometry
        newGeometry = applyTransform(transformData.current.startGeometry, rotationTransform)
        transformData.current.newRotation = newRotation
        
        // Update preview layer
        if (previewLayerRef.current) {
          map.removeLayer(previewLayerRef.current)
          previewLayerRef.current = createPreviewLayer(
            newGeometry, 
            drawing.style,
            rotationTransform
          )
          if (previewLayerRef.current) {
            previewLayerRef.current.addTo(map)
          }
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
    
    if (newGeometry && previewLayerRef.current) {
      updatePreviewLayer(previewLayerRef.current, newGeometry, drawing.geometry.type)
    }
  }
  
  // ENHANCED: Mouse up handler with cleanup
  const onMouseUp = (e) => {
    if (!isDragging.current || !transformData.current) return
    
    console.log('🎯 Transform complete')
    
    map.off('mousemove', onMouseMove)
    map.off('mouseup', onMouseUp)
    
    // NEW: Clean up rotation feedback
    removeRotationFeedback()
    
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
  
  // ENHANCED: Handle interactions with keyboard support
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
      currentScale: drawing.transform?.scale || { x: 1, y: 1 },
      isSnapping: false
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
    
    // NEW: Show rotation feedback for rotation handle
    if (handleType === HANDLE_TYPES.ROTATE) {
      createRotationFeedback(center, drawing.transform?.rotation || 0)
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
  
  // FIXED: Create handles function with closer rotation handle
  const createHandles = () => {
    const bounds = getShapeBounds(drawing.geometry)
    if (!bounds) return
    
    console.log('🔨 Creating handles for:', drawing.name)
    console.log('🔍 Bounds from getShapeBounds:', bounds) // CHANGE THIS LINE
    console.log('🔍 Drawing geometry:', drawing.geometry) // AND THIS LINE
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
    
    // FIXED: Rotation handle positioning using screen coordinates for all objects
    if (drawing.geometry.type === 'text') {
      const center = getShapeCenter(drawing.geometry)
      const centerPoint = map.latLngToContainerPoint([center.lat, center.lng])
      const topPoint = map.latLngToContainerPoint([bounds.north, center.lng])
      const handlePoint = L.point(centerPoint.x, topPoint.y - 30) // 30px above text bounds
      const handleLatLng = map.containerPointToLatLng(handlePoint)
      
      positions.push({
        type: HANDLE_TYPES.ROTATE,
        position: { lat: handleLatLng.lat, lng: handleLatLng.lng }
      })
    } else if (drawing.geometry.type === 'circle') {
      
    } else {
      // For rectangles, polygons, etc. - use geographic offset but with better calculation
      const center = getShapeCenter(drawing.geometry)
      const centerPoint = map.latLngToContainerPoint([center.lat, center.lng])
      const topPoint = map.latLngToContainerPoint([bounds.north, center.lng])
      
      // Calculate handle position 25px above the top of the shape
      const handlePoint = L.point(centerPoint.x, topPoint.y - 25)
      const handleLatLng = map.containerPointToLatLng(handlePoint)
      
      positions.push({
        type: HANDLE_TYPES.ROTATE,
        position: { lat: handleLatLng.lat, lng: handleLatLng.lng }
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
      const radius = isRotateHandle ? 12 : 8
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
      
      // NEW: Add rotation icon
      if (isRotateHandle) {
        handle.bindTooltip('↻', {
          permanent: true,
          direction: 'center',
          className: 'rotation-handle-icon',
          offset: [0, 0]
        })
      }
      
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
            radius: radius + 3,
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
      
      // ENHANCED: Shorter rotation guide line
      if (isRotateHandle) {
        const centerPos = getShapeCenter(drawing.geometry)
        if (centerPos) {
          const line = L.polyline([
            [position.lat, position.lng],
            [centerPos.lat, centerPos.lng]
          ], {
            color: '#10B981',
            weight: 2,
            dashArray: '6, 6',
            interactive: false,
            opacity: 0.7
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
    console.log('🔧 Transform useEffect triggered:', {
      isSelected,
      hasDrawing: !!drawing,
      drawingName: drawing?.name,
      mode,
      hasMap: !!map,
      hasLayerRef: !!layerRef,
      layerRefCurrent: !!layerRef?.current
    })

    if (!isSelected || !drawing || mode !== 'drawing' || !map) {
      // Clean up when not selected
      removeRotationFeedback()
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
      // Cleanup
      removeRotationFeedback()
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
        console.log('🔄 Geometry changed, updating handles')
        
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