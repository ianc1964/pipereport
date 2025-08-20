'use client'
import { Polyline, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

/**
 * LinesLayer - Renders all lines, waypoints, and line labels on the map
 * Handles: line display, waypoint editing, line labels, line clicks
 */
export default function LinesLayer({
  // Data
  lines = [],
  nodes = [],
  sections = [],
  observations = [],
  
  // State
  showLines,
  showLabels,
  editingWaypoints,
  setEditingWaypoints,
  
  // Event handlers
  onLineClick,
  onWaypointDelete,
  
  // Visibility
  visible = true
}) {
  if (!visible || !showLines) return null

  // Handle waypoint drag end
  const handleWaypointDragEnd = (e, lineId, waypointIndex) => {
    e.target.setOpacity(1)
    
    const newPos = e.target.getLatLng()
    const newWaypoints = [...editingWaypoints.waypoints]
    newWaypoints[waypointIndex] = [newPos.lat, newPos.lng]
    
    setEditingWaypoints({
      ...editingWaypoints,
      waypoints: newWaypoints
    })
  }

  // Handle waypoint context menu (right-click to delete)
  const handleWaypointContextMenu = (e, lineId, waypointIndex) => {
    e.originalEvent.preventDefault()
    onWaypointDelete(lineId, waypointIndex)
  }

  return (
    <>
      {/* Lines */}
      {lines.map(line => {
        const lineColor = line.section ? '#10B981' : (line.line_color || '#3B82F6')
        const lineWeight = line.section ? 4 : (line.line_width || 3)
        
        const startNode = nodes.find(n => n.id === line.start_node_id) || line.start_node
        const endNode = nodes.find(n => n.id === line.end_node_id) || line.end_node
        
        if (!startNode || !endNode) return null
        
        const waypoints = editingWaypoints?.lineId === line.id 
          ? editingWaypoints.waypoints 
          : (line.waypoints || [])
        
        return (
          <Polyline
            key={line.id}
            positions={[
              [startNode.lat, startNode.lng],
              ...waypoints,
              [endNode.lat, endNode.lng]
            ]}
            color={lineColor}
            weight={lineWeight}
            opacity={0.8}
            dashArray={line.section ? null : '5, 10'}
            eventHandlers={{
              click: (e) => onLineClick(line, e)
            }}
          >
            <Popup>
              <div className="p-2">
                <h4 className="font-medium">
                  {line.section ? `${line.section.start_ref} → ${line.section.finish_ref}` : `${startNode.node_ref} → ${endNode.node_ref}`}
                </h4>
                {line.section && (
                  <div className="mt-2 text-sm">
                    <p className="font-medium text-green-600">Section {line.section.section_number}</p>
                    <p>Direction: {line.section.direction || 'N/A'}</p>
                    <p>Diameter: {line.section.diameter || 'N/A'}</p>
                    <p>Material: {line.section.material || 'N/A'}</p>
                    <p>Use: {line.section.use_type || 'N/A'}</p>
                    {(() => {
                      const sectionObs = observations.filter(obs => obs.section_id === line.section_id)
                      const maxDist = Math.max(...sectionObs.map(obs => obs.distance || 0), 0)
                      return maxDist > 0 ? (
                        <p>Length: {maxDist}m (based on furthest observation)</p>
                      ) : null
                    })()}
                    <p className="text-xs text-gray-500 mt-1">Map nodes: {startNode.node_ref} → {endNode.node_ref}</p>
                  </div>
                )}
                {!line.section && (
                  <p className="text-sm text-gray-500 mt-1">Visual reference only</p>
                )}
                {waypoints.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">{waypoints.length} waypoint{waypoints.length > 1 ? 's' : ''}</p>
                )}
              </div>
            </Popup>
          </Polyline>
        )
      })}
      
      {/* Waypoint Markers (when editing) */}
      {editingWaypoints && editingWaypoints.waypoints.map((waypoint, index) => (
        <Marker
          key={`waypoint-${editingWaypoints.lineId}-${index}`}
          position={waypoint}
          draggable={true}
          autoPan={true}
          eventHandlers={{
            dragstart: (e) => {
              e.target.setOpacity(0.5)
            },
            dragend: (e) => handleWaypointDragEnd(e, editingWaypoints.lineId, index),
            contextmenu: (e) => handleWaypointContextMenu(e, editingWaypoints.lineId, index)
          }}
          icon={typeof window !== 'undefined' && L ? L.divIcon({
            html: `
              <div style="
                position: absolute; 
                transform: translate(-50%, -50%); 
                width: 12px; 
                height: 12px;
                background: white;
                border: 2px solid #3B82F6;
                border-radius: 50%;
                cursor: move;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              "></div>
            `,
            className: 'waypoint-marker',
            iconSize: null,
            iconAnchor: [0, 0]
          }) : undefined}
        />
      ))}
      
      {/* Line Labels */}
      {showLabels && lines.map(line => {
        const startNode = nodes.find(n => n.id === line.start_node_id) || line.start_node
        const endNode = nodes.find(n => n.id === line.end_node_id) || line.end_node
        
        if (!startNode || !endNode) return null
        
        const midLat = (startNode.lat + endNode.lat) / 2
        const midLng = (startNode.lng + endNode.lng) / 2
        
        let labelText = ''
        if (line.section) {
          const parts = []
          if (line.section.diameter) parts.push(line.section.diameter)
          if (line.section.material) parts.push(line.section.material)
          if (line.section.use_type) parts.push(line.section.use_type)
          labelText = parts.join(' • ')
        }
        
        if (!labelText) return null
        
        return (
          <Marker
            key={`label-${line.id}`}
            position={[midLat, midLng]}
            interactive={false}
            icon={typeof window !== 'undefined' && L ? L.divIcon({
              html: `
                <div style="
                  position: absolute; 
                  transform: translate(-50%, -50%);
                  font-size: 10px; 
                  font-weight: bold; 
                  color: black; 
                  white-space: nowrap;
                  font-family: Arial, sans-serif;
                ">
                  ${labelText}
                </div>
              `,
              className: '',
              iconSize: null,
              iconAnchor: [0, 0]
            }) : undefined}
          />
        )
      })}
    </>
  )
}