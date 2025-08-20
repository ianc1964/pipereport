'use client'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

// Simple Google Maps layer component using XYZ tiles
export function GoogleMapsLayerSimple({ apiKey, mapType = 'roadmap', opacity = 1.0 }) {
  const map = useMap()

  useEffect(() => {
    console.log('🗺️ GoogleMapsLayer useEffect triggered', { apiKey: !!apiKey, mapType, opacity })
    
    if (!apiKey) {
      console.error('Google Maps API key is required')
      return
    }

    // Google Maps tile URL patterns
    let tileUrl = ''
    
    switch(mapType) {
      case 'satellite':
        tileUrl = `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=${apiKey}`
        break
      case 'terrain':
        tileUrl = `https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&key=${apiKey}`
        break
      case 'hybrid':
        tileUrl = `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${apiKey}`
        break
      default: // roadmap
        tileUrl = `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${apiKey}`
    }

    console.log('🌍 Creating Google Maps layer with URL:', tileUrl.substring(0, 60) + '...')

    const googleLayer = L.tileLayer(tileUrl, {
      maxZoom: 22,
      minZoom: 2,
      attribution: '&copy; Google Maps',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      opacity: opacity
    })

    console.log('➕ Adding Google Maps layer to map')
    googleLayer.addTo(map)
    
    // Check if the layer was actually added
    setTimeout(() => {
      const hasLayer = map.hasLayer(googleLayer)
      console.log('✅ Google Maps layer still on map after 1s:', hasLayer)
      console.log('🎯 Current map center:', map.getCenter())
      console.log('🔍 Current map zoom:', map.getZoom())
    }, 1000)

    return () => {
      console.log('🗑️ Removing Google Maps layer from map')
      if (map.hasLayer(googleLayer)) {
        map.removeLayer(googleLayer)
      }
    }
  }, [map, apiKey, mapType, opacity])

  return null
}

// Export as default for easier importing
export default GoogleMapsLayerSimple