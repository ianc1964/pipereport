// components/ProjectMap/components/SimpleImageBackground.js

import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

const SimpleImageBackground = ({ url, opacity = 0.8 }) => {
  const map = useMap()
  const [imageLayer, setImageLayer] = useState(null)
  
  useEffect(() => {
    if (!url || !map) return
    
    // Remove existing image layer if any
    if (imageLayer) {
      map.removeLayer(imageLayer)
    }
    
    const img = new Image()
    img.onload = () => {
      // Get image dimensions
      const width = img.width
      const height = img.height
      
      console.log(`Image loaded: ${width}x${height}`)
      
      // Create simple bounds based on image dimensions
      // We'll use a simple coordinate system where the image fills a reasonable area
      const bounds = [
        [0, 0],                    // Southwest corner
        [height / 100, width / 100] // Northeast corner (scaled down for usability)
      ]
      
      // Create the image overlay
      const layer = L.imageOverlay(url, bounds, {
        opacity: opacity
      }).addTo(map)
      
      setImageLayer(layer)
      
      // Fit the map to the image bounds with some padding
      map.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 18  // Prevent too much zoom
      })
      
      // Set reasonable zoom constraints
      map.setMinZoom(10)
      map.setMaxZoom(20)
    }
    
    img.onerror = () => {
      console.error('Failed to load background image')
    }
    
    img.src = url
    
    // Cleanup
    return () => {
      if (imageLayer) {
        map.removeLayer(imageLayer)
      }
    }
  }, [url, opacity, map])
  
  return null // This component doesn't render anything itself
}

export default SimpleImageBackground