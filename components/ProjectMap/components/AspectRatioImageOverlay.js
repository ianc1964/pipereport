// Alternative simpler version - components/ProjectMap/components/AspectRatioImageOverlay.js

import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import dynamic from 'next/dynamic'

const ImageOverlay = dynamic(
  () => import('react-leaflet').then(mod => mod.ImageOverlay),
  { ssr: false }
)

const AspectRatioImageOverlay = ({ url, defaultBounds, opacity = 0.8, onBoundsCalculated }) => {
  const [bounds, setBounds] = useState(defaultBounds)
  const [isReady, setIsReady] = useState(false)
  const map = useMap()
  
  useEffect(() => {
    if (!url || !map) return
    
    const img = new Image()
    img.onload = () => {
      // Get image dimensions
      const imageWidth = img.width
      const imageHeight = img.height
      const imageAspectRatio = imageWidth / imageHeight
      
      console.log(`Image loaded: ${imageWidth}x${imageHeight}, AR: ${imageAspectRatio}`)
      
      // Get the current map view
      const mapBounds = map.getBounds()
      const mapCenter = map.getCenter()
      
      // Calculate the span of the current view
      const viewHeight = mapBounds.getNorth() - mapBounds.getSouth()
      const viewWidth = mapBounds.getEast() - mapBounds.getWest()
      
      // Size the image to fit 60% of the view height
      const targetHeight = viewHeight * 0.6
      const targetWidth = targetHeight * imageAspectRatio
      
      // Create bounds centered on the map
      const newBounds = [
        [mapCenter.lat - targetHeight / 2, mapCenter.lng - targetWidth / 2],
        [mapCenter.lat + targetHeight / 2, mapCenter.lng + targetWidth / 2]
      ]
      
      console.log('Calculated bounds:', newBounds)
      
      setBounds(newBounds)
      setIsReady(true)
      
      // Save the bounds
      if (onBoundsCalculated) {
        onBoundsCalculated(newBounds)
      }
      
      // Fit the map to show the entire image with padding
      setTimeout(() => {
        map.fitBounds(newBounds, { padding: [50, 50] })
      }, 100)
    }
    
    img.onerror = () => {
      console.error('Failed to load background image')
      setIsReady(true)
    }
    
    img.src = url
  }, [url, map]) // Only recalculate when URL changes
  
  if (!isReady || !bounds) {
    return null
  }
  
  return <ImageOverlay url={url} bounds={bounds} opacity={opacity} />
}

export default AspectRatioImageOverlay