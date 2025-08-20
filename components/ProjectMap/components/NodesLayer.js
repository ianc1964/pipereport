'use client'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

/**
 * NodesLayer - Renders all node markers on the map
 * Handles: node display, node clicks, node dragging, node popups
 */
export default function NodesLayer({
  // Data
  nodes = [],
  nodeTypes = [],
  
  // State
  showNodes,
  showLabels,
  mode,
  editingWaypoints,
  
  // Event handlers
  onNodeClick,
  onNodeDragEnd,
  
  // Helper functions
  getNodeType,
  
  // Visibility
  visible = true
}) {
  if (!visible || !showNodes) return null

  // Handle node drag start
  const handleNodeDragStart = (e) => {
    e.target.setOpacity(0.5)
  }

  // Handle node drag end with error handling
  const handleNodeDragEnd = async (e, node) => {
    e.target.setOpacity(1)
    
    const newLat = e.target.getLatLng().lat
    const newLng = e.target.getLatLng().lng
    
    const previousPosition = { lat: node.lat, lng: node.lng }
    const newPosition = { lat: newLat, lng: newLng }
    
    try {
      await onNodeDragEnd(node.id, previousPosition, newPosition)
    } catch (error) {
      console.error('Error in node drag end:', error)
    }
  }

  // Handle node click
  const handleNodeClick = (node) => {
    if (!editingWaypoints) {
      onNodeClick(node)
    }
  }

  // Generate node icon HTML
  const generateNodeIcon = (node, nodeType) => {
    if (!nodeType) return null

    const cursorStyle = mode === 'view' && !editingWaypoints ? 'move' : 'pointer'
    
    return L.divIcon({
      html: `
        <div style="position: absolute; transform: translate(-50%, -50%); width: ${nodeType.icon_size}px; height: ${nodeType.icon_size}px; cursor: ${cursorStyle};">
          <svg width="${nodeType.icon_size}" height="${nodeType.icon_size}" viewBox="0 0 ${nodeType.icon_size} ${nodeType.icon_size}">
            ${nodeType.icon_shape === 'circle' ? 
              `<circle cx="${nodeType.icon_size/2}" cy="${nodeType.icon_size/2}" r="${nodeType.icon_size/2 - 2}" fill="${nodeType.icon_color}" stroke="black" stroke-width="2"/>` : 
              nodeType.icon_shape === 'square' ? 
              `<rect x="2" y="2" width="${nodeType.icon_size - 4}" height="${nodeType.icon_size - 4}" fill="${nodeType.icon_color}" stroke="black" stroke-width="2"/>` : 
              nodeType.icon_shape === 'triangle' ? 
              `<polygon points="${nodeType.icon_size/2},2 ${nodeType.icon_size-2},${nodeType.icon_size-2} 2,${nodeType.icon_size-2}" fill="${nodeType.icon_color}" stroke="black" stroke-width="2"/>` : 
              `<polygon points="${nodeType.icon_size/2},2 ${nodeType.icon_size-2},${nodeType.icon_size/2} ${nodeType.icon_size/2},${nodeType.icon_size-2} 2,${nodeType.icon_size/2}" fill="${nodeType.icon_color}" stroke="black" stroke-width="2"/>`
            }
          </svg>
        </div>
        ${showLabels ? `
          <div style="
            position: absolute; 
            top: ${nodeType.icon_size/2}px; 
            left: 0; 
            transform: translate(-50%, 3px); 
            font-size: 11px; 
            font-weight: bold; 
            color: black; 
            white-space: nowrap;
            font-family: Arial, sans-serif;
          ">
            ${node.node_ref}
          </div>
        ` : ''}
      `,
      className: 'custom-node-icon',
      iconSize: null,
      iconAnchor: [0, 0],
      popupAnchor: [0, -nodeType.icon_size / 2]
    })
  }

  return (
    <>
      {nodes.map(node => {
        const nodeType = getNodeType(node.node_type_id)
        if (!nodeType) return null
        
        return (
          <Marker
            key={node.id}
            position={[node.lat, node.lng]}
            draggable={mode === 'view' && !editingWaypoints}
            autoPan={true}
            eventHandlers={{
              click: () => handleNodeClick(node),
              dragstart: handleNodeDragStart,
              dragend: (e) => handleNodeDragEnd(e, node)
            }}
            icon={typeof window !== 'undefined' && L ? generateNodeIcon(node, nodeType) : undefined}
          >
            <Popup>
              <div className="p-2">
                <h4 className="font-medium">{node.node_ref}</h4>
                <p className="text-sm text-gray-600">{nodeType.name}</p>
                {node.description && (
                  <p className="text-sm mt-1">{node.description}</p>
                )}
                {node.cover_level && (
                  <p className="text-xs text-gray-500 mt-1">Cover: {node.cover_level}m</p>
                )}
                {node.invert_level && (
                  <p className="text-xs text-gray-500">Invert: {node.invert_level}m</p>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}