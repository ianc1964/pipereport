import React from 'react'
import { Layers, MapPin } from 'lucide-react'

const MapLegend = ({ 
  nodeTypes = [], 
  showNodes = true, 
  showLines = true, 
  showObservations = true,
  position = 'top-left',
  isCompact = false 
}) => {
  // Filter out any nodes without proper data
  const validNodeTypes = nodeTypes.filter(nt => nt && nt.name)
  
  // Don't show legend if there's nothing to display
  if (!showNodes && !showLines && !showObservations) return null
  if (validNodeTypes.length === 0 && !showLines && !showObservations) return null

  // Get filled shape icon for node type matching database fields
  const getNodeIcon = (nodeType) => {
    // Use icon_color from database, fallback to blue
    const color = nodeType.icon_color || '#3B82F6'
    const size = 20 // Standard size for legend (not using icon_size for consistency)
    
    // Create filled SVG shapes based on icon_shape from database
    switch (nodeType.icon_shape?.toLowerCase()) {
      case 'circle':
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <circle 
              cx="10" 
              cy="10" 
              r="8" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
            />
          </svg>
        )
      
      case 'square':
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <rect 
              x="2" 
              y="2" 
              width="16" 
              height="16" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
            />
          </svg>
        )
      
      case 'triangle':
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <polygon 
              points="10,3 17,16 3,16" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
            />
          </svg>
        )
      
      case 'diamond':
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <polygon 
              points="10,3 17,10 10,17 3,10" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
            />
          </svg>
        )
      
      case 'star':
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <path 
              d="M10,3 L12,7.5 L17,7.5 L13,11 L15,15.5 L10,13 L5,15.5 L7,11 L3,7.5 L8,7.5 Z" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        )
      
      case 'hexagon':
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <polygon 
              points="10,3 16,6.5 16,13.5 10,17 4,13.5 4,6.5" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
            />
          </svg>
        )
      
      case 'octagon':
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <polygon 
              points="7,3 13,3 17,7 17,13 13,17 7,17 3,13 3,7" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
            />
          </svg>
        )
      
      case 'heart':
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <path 
              d="M10,16 C10,16 3,11 3,7 C3,4.5 4.5,3 6.5,3 C8.5,3 10,5 10,5 C10,5 11.5,3 13.5,3 C15.5,3 17,4.5 17,7 C17,11 10,16 10,16 Z" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
            />
          </svg>
        )
        
      case 'pentagon':
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <polygon 
              points="10,3 17,7.5 14.5,16 5.5,16 3,7.5" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
            />
          </svg>
        )
        
      case 'cross':
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <path 
              d="M7,3 L13,3 L13,7 L17,7 L17,13 L13,13 L13,17 L7,17 L7,13 L3,13 L3,7 L7,7 Z" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
            />
          </svg>
        )
      
      default:
        // Default to filled circle
        return (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <circle 
              cx="10" 
              cy="10" 
              r="8" 
              fill={color} 
              stroke="#000000" 
              strokeWidth="1"
            />
          </svg>
        )
    }
  }

  // Position styles
  const positionStyles = {
    'top-left': { top: '10px', left: '10px' },
    'top-right': { top: '10px', right: '10px' },
    'bottom-left': { bottom: '80px', left: '10px' },
    'bottom-right': { bottom: '80px', right: '10px' }
  }

  return (
    <div 
      style={{
        position: 'absolute',
        ...positionStyles[position],
        zIndex: 1000,
        maxWidth: isCompact ? '180px' : '220px',
        pointerEvents: 'none'
      }}
      className="leaflet-top leaflet-left"
    >
      <div 
        className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-3"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Title */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
          <Layers className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-700">Map Legend</h3>
        </div>

        <div className="space-y-2">
          {/* Node Types */}
          {showNodes && validNodeTypes.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-600 mb-1">Node Types</h4>
              <div className="space-y-1">
                {validNodeTypes.map((nodeType) => (
                  <div key={nodeType.id} className="flex items-center gap-2">
                    <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '20px', height: '20px' }}>
                      {getNodeIcon(nodeType)}
                    </div>
                    <span className="text-xs text-gray-700 truncate">
                      {nodeType.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Line Type */}
          {showLines && (
            <div>
              <h4 className="text-xs font-medium text-gray-600 mb-1">Lines</h4>
              <div className="flex items-center gap-2">
                <svg width="20" height="10" className="flex-shrink-0">
                  <line 
                    x1="0" 
                    y1="5" 
                    x2="20" 
                    y2="5" 
                    stroke="#10B981" 
                    strokeWidth="2"
                    strokeDasharray="0"
                  />
                </svg>
                <span className="text-xs text-gray-700">Drain/Pipe</span>
              </div>
            </div>
          )}

          {/* Observation Markers */}
          {showObservations && (
            <div>
              <h4 className="text-xs font-medium text-gray-600 mb-1">Observations</h4>
              <div className="space-y-1">
                {/* Critical Observations */}
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0">
                    <MapPin className="w-4 h-4" fill="#EF4444" color="#EF4444" />
                  </div>
                  <span className="text-xs text-gray-700">Critical</span>
                </div>
                {/* Major Observations */}
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0">
                    <MapPin className="w-4 h-4" fill="#F59E0B" color="#F59E0B" />
                  </div>
                  <span className="text-xs text-gray-700">Major</span>
                </div>
                {/* Minor Observations */}
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0">
                    <MapPin className="w-4 h-4" fill="#228B22" color="#228B22" />
                  </div>
                  <span className="text-xs text-gray-700">Minor</span>
                </div>
                {/* Informational */}
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0">
                    <MapPin className="w-4 h-4" fill="#808080" color="#808080" />
                  </div>
                  <span className="text-xs text-gray-700">Informational</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MapLegend