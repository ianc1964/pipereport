// components/reports/PipeGraphic.js
'use client'

import { useState } from 'react'
import { getSeverityColor, getTrafficLightGroup } from '@/lib/utils/severityUtils'

export default function PipeGraphic({ observations, onObservationClick }) {
  const [hoveredObs, setHoveredObs] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  
  // Calculate actual distance range from observations
  const distances = observations.map(obs => obs.distance).filter(d => d !== null && d !== undefined)
  const minDistance = distances.length > 0 ? Math.min(...distances) : 0
  const maxDistance = distances.length > 0 ? Math.max(...distances) : 100
  const totalLength = Math.max(maxDistance - minDistance, 1) // Prevent division by zero
  
  // Group observations by distance to handle stacking
  const observationsByDistance = {}
  observations.forEach(obs => {
    const distance = obs.distance
    if (distance !== null && distance !== undefined) {
      if (!observationsByDistance[distance]) {
        observationsByDistance[distance] = []
      }
      observationsByDistance[distance].push(obs)
    }
  })
  
  // Sort observations at each distance by severity (highest first)
  Object.keys(observationsByDistance).forEach(distance => {
    observationsByDistance[distance].sort((a, b) => (b.severity || 0) - (a.severity || 0))
  })
  
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }
  
  return (
    <div className="relative w-full h-24 bg-gray-100 rounded-lg overflow-visible my-4" onMouseMove={handleMouseMove}>
      {/* Pipe representation */}
      <div className="absolute inset-x-0 top-8 bottom-8 bg-gradient-to-b from-gray-300 to-gray-400 rounded-full">
        {/* Distance labels */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-700">
          {minDistance.toFixed(1)}m
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-700">
          {maxDistance.toFixed(1)}m
        </div>
        
        {/* Distance scale indicators */}
        <div className="absolute inset-x-0 top-0 flex justify-between items-center h-full px-4">
          {/* Add some scale marks if the distance range is significant */}
          {totalLength > 20 && (
            <>
              <div className="w-px h-2 bg-gray-500"></div>
              <div className="w-px h-2 bg-gray-500"></div>
              <div className="w-px h-2 bg-gray-500"></div>
              <div className="w-px h-2 bg-gray-500"></div>
              <div className="w-px h-2 bg-gray-500"></div>
            </>
          )}
        </div>
      </div>
      
      {/* Observation markers */}
      {Object.entries(observationsByDistance).map(([distance, obsAtDistance]) => {
        const numericDistance = parseFloat(distance)
        const relativePosition = totalLength > 0 ? (numericDistance - minDistance) / totalLength : 0
        const position = Math.min(95, Math.max(5, relativePosition * 100))
        
        return obsAtDistance.map((obs, stackIndex) => {
          const isHovered = hoveredObs === `${distance}-${stackIndex}`
          // Stack markers vertically upward from pipe center, with highest severity (index 0) on the center line
          const verticalOffset = stackIndex * 10 // 10px spacing between stacked markers
          const pipeCenter = 48 // Center of 96px container (h-24)
          
          return (
            <div
              key={`${obs.id}-${stackIndex}`}
              className="absolute flex items-center justify-center cursor-pointer"
              style={{ 
                left: `${position}%`,
                top: `${pipeCenter - verticalOffset - 8}px`, // Center marker on pipe line, stack upward
                zIndex: 10 + stackIndex,
                transform: 'translateX(-50%)' // Center horizontally
              }}
              onMouseEnter={() => setHoveredObs(`${distance}-${stackIndex}`)}
              onMouseLeave={() => setHoveredObs(null)}
              onClick={() => onObservationClick && onObservationClick(obs)}
            >
              {/* Connecting line for stacked markers */}
              {stackIndex > 0 && (
                <div
                  className="absolute w-px bg-gray-400"
                  style={{
                    height: `${verticalOffset}px`,
                    left: '50%',
                    top: '16px', // Start from bottom of marker
                    transform: 'translateX(-50%)'
                  }}
                />
              )}
              
              {/* Marker dot - now larger */}
              <div 
                className={`relative rounded-full border-2 border-white transition-all ${
                  isHovered ? 'w-6 h-6' : 'w-5 h-5'
                } ${stackIndex === 0 ? 'shadow-lg' : 'shadow-md'}`}
                style={{ 
                  backgroundColor: getSeverityColor(obs.severity),
                  transform: isHovered ? 'scale(1.1)' : 'scale(1)'
                }}
              />
              
              {/* Count indicator for multiple observations at same distance */}
              {stackIndex === 0 && obsAtDistance.length > 1 && (
                <div className="absolute -top-1 -right-1 bg-white rounded-full text-xs font-bold text-gray-700 w-5 h-5 flex items-center justify-center border border-gray-300 shadow-sm">
                  {obsAtDistance.length}
                </div>
              )}
            </div>
          )
        })
      })}
      
      {/* Enhanced Tooltip */}
      {hoveredObs !== null && (
        (() => {
          const [distance, stackIndex] = hoveredObs.split('-')
          const obsAtDistance = observationsByDistance[distance]
          const obs = obsAtDistance && obsAtDistance[parseInt(stackIndex)]
          
          if (!obs) return null
          
          const numericDistance = parseFloat(distance)
          const relativePosition = totalLength > 0 ? (numericDistance - minDistance) / totalLength : 0
          const position = Math.min(95, Math.max(5, relativePosition * 100))
          
          return (
            <div 
              className="absolute z-20 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-lg max-w-xs"
              style={{
                left: `${position}%`,
                top: '-70px',
                transform: 'translateX(-50%)'
              }}
            >
              <div className="font-medium text-center mb-1">
                {obs.distance?.toFixed(2)}m - {obs.code}
              </div>
              <div className="text-gray-300 text-center mb-1">
                Severity {obs.severity} - {getTrafficLightGroup(obs.severity)}
              </div>
              {obs.description && (
                <div className="text-gray-300 text-center text-xs truncate max-w-48">
                  {obs.description}
                </div>
              )}
              {obsAtDistance.length > 1 && (
                <div className="text-gray-400 text-center text-xs mt-1">
                  {parseInt(stackIndex) + 1} of {obsAtDistance.length} at this distance
                </div>
              )}
              <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2"></div>
            </div>
          )
        })()
      )}
      
      {/* Distance ruler for context */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-gray-500">
        <span>{minDistance.toFixed(1)}m</span>
        {totalLength > 10 && (
          <span className="absolute left-1/2 transform -translate-x-1/2">
            {((minDistance + maxDistance) / 2).toFixed(1)}m
          </span>
        )}
        <span>{maxDistance.toFixed(1)}m</span>
      </div>
      
      {/* Length indicator */}
      <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 font-medium">
        Total length: {totalLength.toFixed(1)}m
      </div>
    </div>
  )
}