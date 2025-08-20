// Helper function to calculate observation position along a line (with waypoint support)
export const calculateObservationPosition = (line, observation, observations, drawingContext, map) => {
  if (!line || !observation || observation.distance === null || observation.distance === undefined) {
    return null
  }

  // Get all observations for this section to find the maximum distance
  const sectionObservations = observations.filter(obs => 
    obs.section_id === line.section_id
  )
  
  // Find the maximum observation distance (the finish observation distance)
  const maxDistance = Math.max(...sectionObservations.map(obs => obs.distance || 0))
  
  // Use the maximum observation distance as total length, with fallback to 100
  const totalLength = maxDistance > 0 ? maxDistance : 100
  
  // Calculate percentage along the line (0-100)
  // If observation distance is greater than total length, cap at 100%
  const percentage = Math.min(100, Math.max(0, (observation.distance / totalLength) * 100))
  
  // Build the complete path including waypoints
  const waypoints = line.waypoints || []
  const path = [
    { lat: line.start_node.lat, lng: line.start_node.lng },
    ...waypoints.map(wp => ({ lat: wp[0], lng: wp[1] })),
    { lat: line.end_node.lat, lng: line.end_node.lng }
  ]
  
  // Check if we're in Canvas mode
  const isCanvasMode = drawingContext === 'canvas'
  
  if (isCanvasMode && map) {
    // Canvas mode: Use pixel-based calculations for accuracy
    
    // Ensure map is ready for conversions
    try {
      // Test conversion to ensure map is initialized
      map.latLngToContainerPoint([0, 0])
    } catch (e) {
      console.warn('Map not ready for coordinate conversions, falling back to geographic calculation')
      // Fall through to geographic calculation by not returning early
    }
    
    // Try to do pixel-based calculation
    try {
      // Convert all path points to pixel coordinates
      const pixelPath = path.map(point => 
        map.latLngToContainerPoint([point.lat, point.lng])
      )
      
      // Validate pixel path
      if (!pixelPath || pixelPath.length < 2) {
        console.warn('Invalid pixel path, falling back to end node')
        return { 
          lat: line.end_node.lat, 
          lng: line.end_node.lng, 
          percentage: 100, 
          totalLength 
        }
      }

      // Calculate the total pixel length of the path
      let pathSegments = []
      let totalPixelLength = 0
      
      for (let i = 0; i < pixelPath.length - 1; i++) {
        const segmentLength = Math.sqrt(
          Math.pow(pixelPath[i + 1].x - pixelPath[i].x, 2) + 
          Math.pow(pixelPath[i + 1].y - pixelPath[i].y, 2)
        )
        pathSegments.push({
          startPixel: pixelPath[i],
          endPixel: pixelPath[i + 1],
          length: segmentLength,
          startDistance: totalPixelLength
        })
        totalPixelLength += segmentLength
      }
      
      // Safety check: if the line has no length (all points at same position)
      if (totalPixelLength === 0) {
        console.warn('Line has zero length in pixel space, placing observation at start node')
        const startLatLng = map.containerPointToLatLng(pixelPath[0])
        return { 
          lat: startLatLng.lat, 
          lng: startLatLng.lng, 
          percentage: 0, 
          totalLength 
        }
      }
      
      // Find the position along the path based on percentage
      const targetDistance = (percentage / 100) * totalPixelLength
      let accumulatedDistance = 0
      
      for (const segment of pathSegments) {
        if (accumulatedDistance + segment.length >= targetDistance) {
          // The observation is on this segment
          let segmentPercentage = 0
          
          // Avoid division by zero
          if (segment.length > 0) {
            segmentPercentage = (targetDistance - accumulatedDistance) / segment.length
          }
          
          // Ensure percentage is between 0 and 1
          segmentPercentage = Math.max(0, Math.min(1, segmentPercentage))
          
          // Calculate pixel position
          const pixelX = segment.startPixel.x + (segment.endPixel.x - segment.startPixel.x) * segmentPercentage
          const pixelY = segment.startPixel.y + (segment.endPixel.y - segment.startPixel.y) * segmentPercentage
          
          // Validate pixel coordinates before conversion
          if (isNaN(pixelX) || isNaN(pixelY)) {
            console.warn('Invalid pixel coordinates calculated:', { pixelX, pixelY, segment, segmentPercentage })
            // Fallback to start of segment
            const fallbackLatLng = map.containerPointToLatLng(segment.startPixel)
            return { 
              lat: fallbackLatLng.lat, 
              lng: fallbackLatLng.lng, 
              percentage, 
              totalLength 
            }
          }
          
          // Convert back to lat/lng for display
          const latLng = map.containerPointToLatLng(L.point(pixelX, pixelY))
          
          return { 
            lat: latLng.lat, 
            lng: latLng.lng, 
            percentage, 
            totalLength 
          }
        }
        accumulatedDistance += segment.length
      }
      
      // Fallback to end position
      if (pixelPath.length > 0) {
        const endPixel = pixelPath[pixelPath.length - 1]
        if (endPixel && typeof endPixel.x === 'number' && typeof endPixel.y === 'number') {
          const endLatLng = map.containerPointToLatLng(endPixel)
          return { 
            lat: endLatLng.lat, 
            lng: endLatLng.lng, 
            percentage: 100, 
            totalLength 
          }
        }
      }
      
      // Ultimate fallback to end node position
      return { 
        lat: line.end_node.lat, 
        lng: line.end_node.lng, 
        percentage: 100, 
        totalLength 
      }
      
    } catch (error) {
      console.warn('Error in pixel calculations, falling back to geographic:', error)
      // Fall through to geographic calculation
    }
  }
  
  // Map mode or fallback: Use geographic calculations (existing logic)
  
  // Calculate the total geometric length of the path
  let pathSegments = []
  let totalPathLength = 0
  
  for (let i = 0; i < path.length - 1; i++) {
    const segmentLength = calculateDistanceBetweenPoints(path[i], path[i + 1])
    pathSegments.push({
      start: path[i],
      end: path[i + 1],
      length: segmentLength,
      startDistance: totalPathLength
    })
    totalPathLength += segmentLength
  }
  
  // Find the position along the path based on percentage
  const targetDistance = (percentage / 100) * totalPathLength
  let accumulatedDistance = 0
  
  for (const segment of pathSegments) {
    if (accumulatedDistance + segment.length >= targetDistance) {
      // The observation is on this segment
      const segmentPercentage = (targetDistance - accumulatedDistance) / segment.length
      
      const lat = segment.start.lat + (segment.end.lat - segment.start.lat) * segmentPercentage
      const lng = segment.start.lng + (segment.end.lng - segment.start.lng) * segmentPercentage
      
      return { lat, lng, percentage, totalLength }
    }
    accumulatedDistance += segment.length
  }
  
  // Fallback to end position
  return { 
    lat: line.end_node.lat, 
    lng: line.end_node.lng, 
    percentage: 100, 
    totalLength 
  }
}

// Calculate distance between two points (for waypoint segments)
const calculateDistanceBetweenPoints = (point1, point2) => {
  const lat1Rad = point1.lat * Math.PI / 180
  const lat2Rad = point2.lat * Math.PI / 180
  const deltaLat = (point2.lat - point1.lat) * Math.PI / 180
  const deltaLng = (point2.lng - point1.lng) * Math.PI / 180
  
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const earthRadius = 6371000 // meters
  
  return earthRadius * c
}

// Function to get severity color
export const getSeverityColor = (severity) => {
  if (!severity) return '#6B7280' // Gray for unknown
  if (severity >= 4) return '#DC2626' // Red for high severity (4-5)
  if (severity === 3) return '#F59E0B' // Yellow/amber for medium
  return '#10B981' // Green for low severity (1-2)
}

// Helper function to format video timestamp
export const formatTimestamp = (seconds) => {
  if (seconds === null || seconds === undefined) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// Default map settings
export const DEFAULT_CENTER = [51.505, -0.09] // Default to London
export const DEFAULT_ZOOM = 15
export const DEFAULT_BOUNDS = [[51.49, -0.12], [51.52, -0.06]]