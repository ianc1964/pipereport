'use client'
import { Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { calculateObservationPosition, getSeverityColor, formatTimestamp } from '../utils/mapHelpers'

/**
 * ObservationsLayer - Renders observation markers on the map
 * Handles: observation markers, complex popups, video integration
 */
export default function ObservationsLayer({
  // Data
  lines = [],
  nodes = [],
  observations = [],
  
  // State
  showObservations,
  editingWaypoints,
  
  // Event handlers
  onJumpToVideo,
  
  // Visibility
  visible = true,
  
  // Drawing context
  drawingContext = 'map'
}) {
  const map = useMap()
  
  if (!visible || !showObservations) return null

  // Handle observation marker click
  const handleObservationClick = (observation, sectionId) => {
    if (observation.video_timestamp !== null && onJumpToVideo) {
      onJumpToVideo(sectionId, observation.video_timestamp)
    }
  }

  // Handle observation marker hover
  const handleObservationMouseOver = (e) => {
    e.target.openPopup()
  }

  // Handle observation marker mouse out
  const handleObservationMouseOut = (e) => {
    setTimeout(() => {
      if (!e.target.getPopup()?.isOpen()) {
        e.target.closePopup()
      }
    }, 100)
  }

  // Generate observation marker icon
  const generateObservationIcon = (observation) => {
    const markerColor = getSeverityColor(observation.severity)
    const markerSize = observation.severity >= 4 ? 16 : 12
    
    return L.divIcon({
      html: `
        <div style="
          position: absolute; 
          transform: translate(-50%, -50%); 
          width: ${markerSize}px; 
          height: ${markerSize}px;
          cursor: pointer;
          transition: transform 0.2s;
        " 
        onmouseover="this.style.transform='translate(-50%, -50%) scale(1.2)'"
        onmouseout="this.style.transform='translate(-50%, -50%) scale(1.0)'"
        >
          <svg width="${markerSize}" height="${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}">
            <circle 
              cx="${markerSize/2}" 
              cy="${markerSize/2}" 
              r="${markerSize/2 - 1}" 
              fill="${markerColor}" 
              stroke="black" 
              stroke-width="1"
              style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));"
            />
            ${observation.severity >= 4 ? `
              <text 
                x="${markerSize/2}" 
                y="${markerSize/2 + 1}" 
                text-anchor="middle" 
                dominant-baseline="middle"
                fill="white"
                font-size="10"
                font-weight="bold"
              >!</text>
            ` : ''}
          </svg>
        </div>
      `,
      className: 'observation-marker-enhanced',
      iconSize: null,
      iconAnchor: [0, 0],
      popupAnchor: [0, -markerSize / 2]
    })
  }

  // Generate observation popup content
  const generateObservationPopup = (observation, position, line) => (
    <Popup 
      maxWidth={350}
      className="observation-popup"
      closeButton={true}
      autoPan={true}
    >
      <div className="p-3">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="font-semibold text-base">
              {observation.name || `${observation.code} at ${observation.distance}m`}
            </h4>
            <p className="text-sm text-gray-600">
              Distance: <span className="font-medium">{observation.distance}m</span>
              {position.percentage && (
                <span className="text-xs text-gray-500 ml-2">
                  ({Math.round(position.percentage)}% along {position.totalLength}m pipe)
                </span>
              )}
            </p>
          </div>
          <div className={`px-2 py-1 rounded text-xs font-medium text-white ${
            observation.severity >= 4 ? 'bg-red-500' : 
            observation.severity === 3 ? 'bg-yellow-500' : 
            'bg-green-500'
          }`}>
            Severity {observation.severity || 'N/A'}
          </div>
        </div>

        {observation.image_url && (
          <div className="mb-3 relative group">
            <img 
              src={observation.image_url} 
              alt="Observation" 
              className="w-full h-40 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(observation.image_url, '_blank')}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center pointer-events-none">
              <span className="text-white opacity-0 group-hover:opacity-100 text-sm">
                Click to enlarge
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm">
          {observation.description && (
            <p className="text-gray-700">{observation.description}</p>
          )}
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            {observation.band && (
              <div>
                <span className="text-gray-500">Band:</span>
                <span className="ml-1 font-medium">{observation.band}</span>
              </div>
            )}
            {observation.material && (
              <div>
                <span className="text-gray-500">Material:</span>
                <span className="ml-1 font-medium">{observation.material}</span>
              </div>
            )}
            {observation.is_at_joint && (
              <div className="col-span-2">
                <span className="text-green-600 font-medium">✓ At Joint</span>
              </div>
            )}
            {observation.loss_percentage && (
              <div>
                <span className="text-gray-500">Loss:</span>
                <span className="ml-1 font-medium">{observation.loss_percentage}%</span>
              </div>
            )}
            {(observation.dimension_1 || observation.dimension_2) && (
              <div>
                <span className="text-gray-500">Dimensions:</span>
                <span className="ml-1 font-medium">
                  {observation.dimension_1}
                  {observation.dimension_2 && ` × ${observation.dimension_2}`}
                </span>
              </div>
            )}
            {(observation.clock_ref_1 || observation.clock_ref_2) && (
              <div className="col-span-2">
                <span className="text-gray-500">Clock:</span>
                <span className="ml-1 font-medium">
                  {[observation.clock_ref_1, observation.clock_ref_2].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>

          {observation.remarks && (
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-600 italic">"{observation.remarks}"</p>
            </div>
          )}

          {observation.video_timestamp !== null && onJumpToVideo && (
            <div className="pt-2 border-t">
              <button
                onClick={() => {
                  onJumpToVideo(line.section_id, observation.video_timestamp)
                }}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-xs font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Jump to video ({formatTimestamp(observation.video_timestamp)})</span>
              </button>
            </div>
          )}

          <div className="pt-2 text-xs text-gray-500">
            <p>Created: {new Date(observation.created_at).toLocaleDateString()}</p>
            {observation.photo_ref && <p>Photo Ref: {observation.photo_ref}</p>}
          </div>
        </div>
      </div>
    </Popup>
  )

  return (
    <>
      {lines.map(line => {
        if (!line.section_id || !line.section) return null
        
        const startNode = nodes.find(n => n.id === line.start_node_id) || line.start_node
        const endNode = nodes.find(n => n.id === line.end_node_id) || line.end_node
        
        if (!startNode || !endNode) return null
        
        const currentLine = {
          ...line,
          start_node: startNode,
          end_node: endNode,
          waypoints: editingWaypoints?.lineId === line.id 
            ? editingWaypoints.waypoints 
            : (line.waypoints || [])
        }
        
        const sectionObservations = observations.filter(obs => 
          obs.section_id === line.section_id
        )
        
        return sectionObservations.map(observation => {
          // Pass drawing context and map instance to the calculation function
          const position = calculateObservationPosition(
            currentLine, 
            observation, 
            observations, 
            drawingContext, 
            map
          )
          if (!position) return null
          
          return (
            <Marker
              key={`obs-${observation.id}`}
              position={[position.lat, position.lng]}
              eventHandlers={{
                click: () => handleObservationClick(observation, line.section_id),
                mouseover: handleObservationMouseOver,
                mouseout: handleObservationMouseOut
              }}
              icon={typeof window !== 'undefined' && L ? generateObservationIcon(observation) : undefined}
            >
              {generateObservationPopup(observation, position, line)}
            </Marker>
          )
        })
      })}
    </>
  )
}