'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

// Import the new transform hook instead of the draggable one
import { useTransformableShape } from './hooks/useTransformableShape'

// Dynamically import Leaflet components
const Rectangle = dynamic(
  () => import('react-leaflet').then(mod => mod.Rectangle),
  { ssr: false }
)
const Circle = dynamic(
  () => import('react-leaflet').then(mod => mod.Circle),
  { ssr: false }
)
const Polygon = dynamic(
  () => import('react-leaflet').then(mod => mod.Polygon),
  { ssr: false }
)
const Polyline = dynamic(
  () => import('react-leaflet').then(mod => mod.Polyline),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
)

// Drawing Renderer with Transform Support (Move, Scale, Rotate)
export default function DrawingRenderer({ 
  drawing, 
  isSelected = false,
  mode = 'view',
  onClick,
  onDrawingSelect,
  onDrawingClick, 
  onDrawingEdit, 
  onDrawingDelete,
  onTransformUpdate,
  drawingContext = 'map' // Add drawingContext prop
}) {
  const [L, setL] = useState(null)
  const layerRef = useRef(null)

  // Callback to set the layer reference when component is ready
  const setLayerRef = useCallback((leafletLayer) => {
    if (leafletLayer && !layerRef.current) {
      console.log('🔧 Setting layer ref for:', drawing?.name, leafletLayer)
      layerRef.current = leafletLayer
    }
  }, [drawing?.name])

  // Use the new transformable hook for complete transform support
  useTransformableShape({ 
    drawing, 
    isSelected,
    mode, 
    onTransformUpdate,
    drawingContext, // Pass drawingContext to the hook
    layerRef
  })
  
  // Load Leaflet on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('leaflet').then((leaflet) => {
        setL(leaflet.default)
      })
    }
  }, [])

  // Clear layer ref when drawing changes or component unmounts
  useEffect(() => {
    return () => {
      layerRef.current = null
    }
  }, [drawing?.id])
  
  if (!drawing || !drawing.geometry || !L) return null
  
  const { geometry, style, text_content, text_style, transform } = drawing
  
  // Only show popup in view mode and when not selected
  const shouldShowPopup = mode === 'view' && !isSelected
  
  // Event handlers - now includes layer ref capture
  const eventHandlers = {
    add: (e) => {
      // This fires when the layer is added to the map
      const layer = e.target
      setLayerRef(layer)
    },
    click: (e) => {
      if (L) L.DomEvent.stopPropagation(e)
      
      if (onClick) onClick(drawing, e)
      if (onDrawingSelect) onDrawingSelect(drawing, e)
      if (onDrawingClick) onDrawingClick(drawing, e)
    }
  }
  
  // Get drawing style with transform visual feedback
  const getDrawingStyle = () => {
    const baseStyle = { ...style }
    
    // Selected styling with transform indicators
    if (isSelected) {
      return {
        ...baseStyle,
        weight: Math.max((baseStyle.weight || 2) + 2, 4),
        color: '#3B82F6', // Blue for selected
        opacity: 1,
        fillOpacity: baseStyle.fillOpacity || 0.3,
        dashArray: mode === 'drawing' ? '2, 4' : undefined // Subtle dash when transformable
      }
    }
    
    return baseStyle
  }
  
  const drawingStyle = getDrawingStyle()
  
  // Apply stored transformations to geometry for rendering
  // Note: The actual geometry is already transformed in the database,
  // but we might need this for future client-side only transforms
  const getTransformedGeometry = () => {
    // For now, just return the geometry as-is since transforms are applied
    // during the transform operation and saved to the database
    return geometry
  }
  
  const transformedGeometry = getTransformedGeometry()
  
  // Render different drawing types
  switch (transformedGeometry.type) {
    case 'rectangle':
      if (!transformedGeometry.bounds) return null
      const bounds = [
        [transformedGeometry.bounds.south, transformedGeometry.bounds.west],
        [transformedGeometry.bounds.north, transformedGeometry.bounds.east]
      ]
      return (
        <Rectangle
          bounds={bounds}
          pathOptions={drawingStyle}
          eventHandlers={eventHandlers}
        >
          {shouldShowPopup && <DrawingPopup drawing={drawing} transform={transform} />}
        </Rectangle>
      )
    
    case 'circle':
      if (!transformedGeometry.center || !transformedGeometry.radius) return null
      return (
        <Circle
          center={[transformedGeometry.center.lat, transformedGeometry.center.lng]}
          radius={transformedGeometry.radius}
          pathOptions={drawingStyle}
          eventHandlers={eventHandlers}
        >
          {shouldShowPopup && <DrawingPopup drawing={drawing} transform={transform} />}
        </Circle>
      )
    
    case 'polygon':
    case 'building':
    case 'boundary':
      if (!transformedGeometry.coordinates || !Array.isArray(transformedGeometry.coordinates)) return null
      const polygonCoords = transformedGeometry.coordinates.map(coord => [coord[0], coord[1]])
      
      // Close polygon if not already closed
      if (polygonCoords.length > 0) {
        const firstCoord = polygonCoords[0]
        const lastCoord = polygonCoords[polygonCoords.length - 1]
        if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
          polygonCoords.push(firstCoord)
        }
      }
      
      const polygonStyle = {
        ...drawingStyle,
        dashArray: transformedGeometry.type === 'boundary' ? '8,8' : drawingStyle.dashArray
      }
      
      return (
        <Polygon
          positions={polygonCoords}
          pathOptions={polygonStyle}
          eventHandlers={eventHandlers}
        >
          {shouldShowPopup && <DrawingPopup drawing={drawing} transform={transform} />}
        </Polygon>
      )
    
    case 'freehand':
    case 'line':
      if (!transformedGeometry.coordinates || !Array.isArray(transformedGeometry.coordinates)) return null
      const lineCoords = transformedGeometry.coordinates.map(coord => [coord[0], coord[1]])
      
      return (
        <Polyline
          positions={lineCoords}
          pathOptions={drawingStyle}
          eventHandlers={eventHandlers}
        >
          {shouldShowPopup && <DrawingPopup drawing={drawing} transform={transform} />}
        </Polyline>
      )
    
    case 'text':
      if (!transformedGeometry.position) return null
      
      const textStyleObj = text_style || {}
      const fontSize = textStyleObj.fontSize || 14
      const fontFamily = textStyleObj.fontFamily || 'Arial'
      const fontWeight = textStyleObj.fontWeight || 'normal'
      const textColor = textStyleObj.textColor || '#000000'
      
      const textBorderColor = isSelected ? '#3B82F6' : '#ccc'
      const textBorderWidth = isSelected ? '2px' : '1px'
      const textTransform = transform?.rotation ? `rotate(${transform.rotation}deg)` : ''
      
      return (
        <Marker
          position={[transformedGeometry.position.lat, transformedGeometry.position.lng]}
          draggable={false}
          eventHandlers={eventHandlers}
          icon={L.divIcon({
            html: `<div style="
              font-size: ${fontSize}px;
              font-family: ${fontFamily};
              font-weight: ${fontWeight};
              color: ${textColor};
              white-space: nowrap;
              text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
              cursor: ${isSelected && mode === 'drawing' ? 'move' : 'pointer'};
              padding: 4px 8px;
              background: rgba(255,255,255,0.9);
              border-radius: 4px;
              border: ${textBorderWidth} solid ${textBorderColor};
              box-shadow: ${isSelected ? '0 0 8px rgba(59, 130, 246, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)'};
              pointer-events: all;
              transform: translate(-50%, -50%) ${textTransform};
              transform-origin: center;
              display: inline-block;
            ">${text_content || 'Text'}</div>`,
            className: 'text-marker-no-container',
            iconSize: null, // Let the content determine size
            iconAnchor: [0, 0] // We'll use CSS transform for centering
          })}
        >
          {shouldShowPopup && <DrawingPopup drawing={drawing} transform={transform} />}
        </Marker>
      )
    
    default:
      console.warn(`Unknown drawing type: ${transformedGeometry.type}`)
      return null
  }
}

// Enhanced popup component with transform info
function DrawingPopup({ drawing, transform }) {
  return (
    <Popup
      autoPan={false}
      keepInView={false}
      autoClose={true}
      closeOnClick={true}
    >
      <div className="p-2">
        <h4 className="font-semibold">{drawing.name}</h4>
        <p className="text-sm text-gray-600 capitalize">{drawing.drawing_type}</p>
        {transform && (
          <div className="text-xs text-gray-500 mt-1">
            {transform.rotation && (
              <div>Rotation: {Math.round(transform.rotation)}°</div>
            )}
            {transform.scale && (
              <div>Scale: {transform.scale.x?.toFixed(2) || transform.scale.uniform?.toFixed(2) || '1.00'}</div>
            )}
          </div>
        )}
      </div>
    </Popup>
  )
}