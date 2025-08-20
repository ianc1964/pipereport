// components/ProjectMap/components/DrawingBackgroundManager.js

import { useEffect, useState, useRef } from 'react'
import { useMap } from 'react-leaflet'
import dynamic from 'next/dynamic'
import L from 'leaflet'

const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
)

// Import the Google Maps layer component
const GoogleMapsLayer = dynamic(
  () => import('./GoogleMapsLayer').then(mod => mod.GoogleMapsLayerSimple),
  { ssr: false }
)

const DrawingBackgroundManager = ({ 
  backgroundType = 'map', // 'map' | 'blank'
  referenceImageUrl = null, // For blank mode reference image
  referenceImageOpacity = 0.5, // Opacity for reference image
  blankCanvasColor = '#f5f5f5',
  mapType = 'roadmap', // Google Maps type: roadmap, satellite, terrain, hybrid
  mapOpacity = 1.0 // New prop for map opacity
}) => {
  console.log('🔍 DrawingBackgroundManager render:', { 
    backgroundType, 
    referenceImageUrl: !!referenceImageUrl, 
    mapType, 
    mapOpacity,
    googleMapsApiKey: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 
  })


  const map = useMap()
  const [blankOverlay, setBlankOverlay] = useState(null)
  const [referenceImageOverlay, setReferenceImageOverlay] = useState(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  
  // Store previous map state to restore when switching backgrounds
  const mapStateRef = useRef({
    center: null,
    zoom: null,
    bounds: null
  })
  
  // Get Google Maps API key from environment variable
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  
  // Canvas bounds - consistent coordinate system for drawing
  // Using a larger default canvas that's more reasonable for drawing
  const CANVAS_BOUNDS = [[0, 0], [2000, 2000]]
  
  // Helper function to reset map to canvas defaults
  const resetToCanvasDefaults = (fitBounds = true) => {
    if (!map) return
    
    console.log('Resetting map to canvas defaults')
    
    // Remove ALL constraints - allow free panning
    map.setMaxBounds(null)
    map.setMinZoom(2)
    map.setMaxZoom(18)
    
    // Force recalculation
    map.invalidateSize()
    
    // Fit to canvas bounds if requested
    if (fitBounds) {
      // Use setView instead of fitBounds for more predictable behavior
      const center = L.latLng(1000, 1000) // Center of CANVAS_BOUNDS
      map.setView(center, 7, { animate: false })
    }
  }
  
  useEffect(() => {
    if (!map) return
    
    // Store current map state before switching
    const storeMapState = () => {
      try {
        mapStateRef.current = {
          center: map.getCenter(),
          zoom: map.getZoom(),
          bounds: map.getBounds()
        }
      } catch (e) {
        console.log('Could not store map state:', e)
      }
    }
    
    // Clean up blank overlay when switching to map
    if (blankOverlay && backgroundType !== 'blank') {
      map.removeLayer(blankOverlay)
      setBlankOverlay(null)
    }
    
    // Also clean up blank overlay if we have a reference image in blank mode
    if (blankOverlay && backgroundType === 'blank' && referenceImageUrl) {
      map.removeLayer(blankOverlay)
      setBlankOverlay(null)
    }
    
   // Set up based on background type
   switch (backgroundType) {
     case 'blank':
       // Store current state before switching
       storeMapState()
       
       // Reset to canvas defaults when entering blank mode
       if (!referenceImageUrl) {
         resetToCanvasDefaults(true)
       }
       
       // Only create the blank background if there's no reference image
       if (!referenceImageUrl && !blankOverlay && !isImageLoading) {
         // Create a much larger grey background for free panning
         const largeBounds = [[-5000, -5000], [7000, 7000]]
         const rect = L.rectangle(largeBounds, {
           color: 'transparent',
           fillColor: blankCanvasColor,
           fillOpacity: 1,
           interactive: false,
           pane: 'tilePane' // Use the tile pane which is below overlays
         }).addTo(map)
         
         // Set explicit z-index to ensure it's below other layers
         if (rect._path) {
           rect._path.style.zIndex = '0'
         }
         
         setBlankOverlay(rect)
       }
       break
       
     case 'map':
     case 'image': 
     default:
        // Reset bounds for map mode
        map.setMaxBounds(null)
        map.setMinZoom(2)
        map.setMaxZoom(22) // Google Maps supports up to 22
        
        // Try to restore previous map state if we have it
        if (mapStateRef.current.center && mapStateRef.current.zoom) {
          try {
            // Check if the previous state is within reasonable bounds for a map
            const lat = mapStateRef.current.center.lat
            const lng = mapStateRef.current.center.lng
            const zoom = mapStateRef.current.zoom
            
            // Only restore if it looks like valid map coordinates
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && zoom >= 2 && zoom <= 22) {
              map.setView([lat, lng], zoom, { animate: false })
            } else {
              // Fall back to default view
              map.setView([51.505, -0.09], 13) // Default to London
            }
          } catch (e) {
            console.log('Could not restore map state:', e)
            map.setView([51.505, -0.09], 13) // Default to London
          }
        } else if (map.getZoom() < 2 || map.getZoom() > 22) {
          // Only reset if current view is invalid
          map.setView([51.505, -0.09], 13) // Default to London
        }
        break
    }
    
    // Cleanup
    return () => {
      if (blankOverlay) {
        map.removeLayer(blankOverlay)
      }
    }
  }, [backgroundType, map, blankCanvasColor, referenceImageUrl, isImageLoading])
  
  // Handle reference image overlay in blank mode
  useEffect(() => {
    if (!map || backgroundType !== 'blank') {
      // Clean up reference image if not in blank mode
      if (referenceImageOverlay) {
        map.removeLayer(referenceImageOverlay)
        setReferenceImageOverlay(null)
      }
      return
    }
    
    // Remove old overlay if URL changes or is removed
    if (referenceImageOverlay) {
      map.removeLayer(referenceImageOverlay)
      setReferenceImageOverlay(null)
    }
    
    // Also remove blank overlay when we have a reference image
    if (referenceImageUrl && blankOverlay) {
      map.removeLayer(blankOverlay)
      setBlankOverlay(null)
    }
    
    // Add new reference image if URL provided
    if (referenceImageUrl) {
      setIsImageLoading(true)
      
      // First remove ALL constraints for free panning
      map.setMaxBounds(null)
      map.setMinZoom(2)
      map.setMaxZoom(20)
      
      const img = new Image()
      img.onload = () => {
        console.log(`Reference image loaded: ${img.width}x${img.height}`)
        
        // Use the image's actual dimensions as the coordinate system
        const imageWidth = img.width
        const imageHeight = img.height
        
        // Create bounds based on image dimensions
        // We'll use the image pixels as our coordinate units
        const imageBounds = [[0, 0], [imageHeight, imageWidth]]
        
        // Create image overlay with proper bounds
        const overlay = L.imageOverlay(referenceImageUrl, imageBounds, {
          opacity: referenceImageOpacity,
          interactive: false,
          pane: 'overlayPane',
          zIndex: 10
        }).addTo(map)
        
        // Force map to recalculate
        map.invalidateSize()
        
        // Use fitBounds to center the image
        setTimeout(() => {
          // Fit to the image bounds with padding
          map.fitBounds(imageBounds, { 
            padding: [50, 50],
            animate: false
          })
          
          // After fitting, get the zoom level Leaflet chose
          const fitZoom = map.getZoom()
          console.log('Leaflet fitted to zoom:', fitZoom)
          
          // Set reasonable zoom limits but NO maxBounds
          // This allows free panning while preventing excessive zoom
          map.setMinZoom(Math.max(2, fitZoom - 4)) // Allow zooming out more
          map.setMaxZoom(20)
          
          // Important: Do NOT set maxBounds - allow free panning
          console.log('Reference image setup complete - free panning enabled')
          console.log('Final zoom:', map.getZoom())
          console.log('Min zoom:', map.getMinZoom(), 'Max zoom:', map.getMaxZoom())
          
          // Create a larger grey background behind the image
          const greyBackgroundBounds = [
            [-imageHeight * 2, -imageWidth * 2], 
            [imageHeight * 3, imageWidth * 3]
          ]
          
          const greyRect = L.rectangle(greyBackgroundBounds, {
            color: 'transparent',
            fillColor: blankCanvasColor,
            fillOpacity: 1,
            interactive: false,
            pane: 'tilePane'
          }).addTo(map)
          
          // Ensure grey background is below the image
          greyRect.bringToBack()
          
          // Store the grey background so we can remove it later
          if (blankOverlay) {
            map.removeLayer(blankOverlay)
          }
          setBlankOverlay(greyRect)
        }, 100)
        
        overlay.bringToFront()
        setReferenceImageOverlay(overlay)
        setIsImageLoading(false)
        
        console.log('Reference image setup initiated with free panning')
        console.log('Image bounds:', imageBounds)
      }
      
      img.onerror = () => {
        console.error('Failed to load reference image:', referenceImageUrl)
        alert('Failed to load reference image. Please try another image.')
        setIsImageLoading(false)
        
        // Reset to blank canvas on error
        resetToCanvasDefaults(true)
      }
      
      img.src = referenceImageUrl
    } else if (!blankOverlay && backgroundType === 'blank' && !isImageLoading) {
      // No reference image - reset to blank canvas with free panning
      console.log('No reference image - setting up blank canvas with free panning')
      
      // Remove ALL constraints
      map.setMaxBounds(null)
      map.setMinZoom(2)
      map.setMaxZoom(18)
      
      // Center on the canvas
      const center = L.latLng(1000, 1000)
      map.setView(center, 7, { animate: false })
      
      // Create a large grey background
      setTimeout(() => {
        if (!blankOverlay && !referenceImageUrl) {
          const largeBounds = [[-5000, -5000], [7000, 7000]]
          const rect = L.rectangle(largeBounds, {
            color: 'transparent',
            fillColor: blankCanvasColor,
            fillOpacity: 1,
            interactive: false,
            pane: 'tilePane'
          }).addTo(map)
          
          if (rect._path) {
            rect._path.style.zIndex = '0'
          }
          
          setBlankOverlay(rect)
          console.log('Blank canvas overlay created with free panning')
        }
      }, 100)
    }
    
    // Cleanup
    return () => {
      if (referenceImageOverlay) {
        map.removeLayer(referenceImageOverlay)
      }
    }
  }, [backgroundType, referenceImageUrl, map, blankCanvasColor]) // Removed referenceImageOpacity from dependencies
  
  // Separate effect to ONLY update opacity of existing reference image
  useEffect(() => {
    if (referenceImageOverlay && referenceImageOpacity !== undefined) {
      referenceImageOverlay.setOpacity(referenceImageOpacity)
    }
  }, [referenceImageOverlay, referenceImageOpacity])
  
  // Render the appropriate background
  if (backgroundType === 'map' || backgroundType === 'image') {
    // Use Google Maps if API key is available, otherwise fall back to OpenStreetMap
    if (googleMapsApiKey) {
      return <GoogleMapsLayer apiKey={googleMapsApiKey} mapType={mapType} opacity={mapOpacity} />
    } else {
      console.warn('Google Maps API key not found. Falling back to OpenStreetMap.')
      return (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          opacity={mapOpacity}
        />
      )
    }
  }
  
  // For blank type, the overlays are handled in useEffect
  return null
}

export default DrawingBackgroundManager