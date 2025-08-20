// components/ProjectMap/hooks/useMapEvents.js

import { useCallback } from 'react'
import { uploadMapBackground, updateProjectMap } from '@/lib/maps'
import { ACTION_TYPES } from './constants'

/**
 * Custom hook for managing map-related events and interactions
 * @param {Object} dependencies - Dependencies needed for event handling
 * @returns {Object} Event handlers and utilities
 */
export const useMapEvents = ({ 
  projectId,
  mapState,
  undoRedo 
}) => {
  
  /**
   * Handle background image upload with full undo/redo support
   */
  const handleBackgroundUpload = useCallback(async (fileOrEvent) => {
    const file = fileOrEvent.target?.files?.[0] || fileOrEvent
    if (!file) return
    
    try {
      mapState.setUploadingBackground(true)
      
      const previousBackground = {
        type: mapState.mapData.background_type,
        url: mapState.mapData.background_image_url
      }
      
      const imageUrl = await uploadMapBackground(projectId, file)
      
      const updatedMap = await updateProjectMap(mapState.mapData.id, {
        background_type: 'image',
        background_image_url: imageUrl
      })
      
      mapState.setMapData(updatedMap)
      
      undoRedo.addToHistory({
        type: ACTION_TYPES.UPLOAD_BACKGROUND,
        data: {
          previousBackground,
          newBackground: { type: 'image', url: imageUrl }
        }
      })
      
    } catch (error) {
      console.error('Error uploading background:', error)
      alert('Failed to upload background image')
    } finally {
      mapState.setUploadingBackground(false)
    }
  }, [projectId, mapState, undoRedo])
  
  /**
   * Handle removing background image
   */
  const handleBackgroundRemove = useCallback(async () => {
    try {
      const previousBackground = {
        type: mapState.mapData.background_type,
        url: mapState.mapData.background_image_url
      }
      
      const updatedMap = await updateProjectMap(mapState.mapData.id, {
        background_type: 'openstreetmap',
        background_image_url: null
      })
      
      mapState.setMapData(updatedMap)
      
      undoRedo.addToHistory({
        type: ACTION_TYPES.UPLOAD_BACKGROUND,
        data: {
          previousBackground,
          newBackground: { type: 'openstreetmap', url: null }
        }
      })
      
    } catch (error) {
      console.error('Error removing background:', error)
      alert('Failed to remove background image')
    }
  }, [mapState, undoRedo])
  
  /**
   * Handle map view changes (center, zoom) for saving user preferences
   */
  const handleMapViewChange = useCallback(async (center, zoom) => {
    try {
      // Only save significant changes to avoid too many updates
      const currentCenter = [mapState.mapData?.center_lat, mapState.mapData?.center_lng]
      const currentZoom = mapState.mapData?.default_zoom
      
      const centerChanged = Math.abs(center[0] - currentCenter[0]) > 0.001 || 
                           Math.abs(center[1] - currentCenter[1]) > 0.001
      const zoomChanged = Math.abs(zoom - currentZoom) > 0.5
      
      if (centerChanged || zoomChanged) {
        const updatedMap = await updateProjectMap(mapState.mapData.id, {
          center_lat: center[0],
          center_lng: center[1],
          default_zoom: zoom
        })
        
        mapState.setMapData(updatedMap)
      }
    } catch (error) {
      console.error('Error saving map view:', error)
      // Don't show alert for view changes as they're not critical
    }
  }, [mapState])
  
  /**
   * Handle keyboard shortcuts for map operations
   */
  const handleKeyboardShortcuts = useCallback((event) => {
    // Prevent default browser behavior for our shortcuts
    if ((event.ctrlKey || event.metaKey)) {
      switch (event.key) {
        case 'z':
          if (event.shiftKey) {
            // Ctrl+Shift+Z or Cmd+Shift+Z for Redo
            event.preventDefault()
            undoRedo.redo()
          } else {
            // Ctrl+Z or Cmd+Z for Undo
            event.preventDefault()
            undoRedo.undo()
          }
          break
          
        case 'y':
          // Ctrl+Y or Cmd+Y for Redo (alternative)
          event.preventDefault()
          undoRedo.redo()
          break
          
        default:
          break
      }
    }
  }, [undoRedo])
  
  /**
   * Handle map loading and error states
   */
  const handleMapLoadError = useCallback((error) => {
    console.error('Map loading error:', error)
    // Could implement fallback map or error state here
  }, [])
  
  /**
   * Handle map ready state
   */
  const handleMapReady = useCallback((mapInstance) => {
    // Map is fully loaded and ready
    console.log('Map ready:', mapInstance)
    
    // Could trigger any initialization here
    // For example, fitting bounds to show all nodes
    if (mapState.nodes.length > 0) {
      // Auto-fit to show all nodes (optional feature)
      // const bounds = calculateBoundsFromNodes(mapState.nodes)
      // mapInstance.fitBounds(bounds)
    }
  }, [mapState.nodes])
  
  /**
   * Create file input element for background upload
   */
  const createFileInput = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = handleBackgroundUpload
    return input
  }, [handleBackgroundUpload])
  
  /**
   * Trigger background upload file picker
   */
  const triggerBackgroundUpload = useCallback(() => {
    const input = createFileInput()
    input.click()
  }, [createFileInput])
  
  /**
   * Enhanced background upload handler for programmatic use
   */
  const uploadBackgroundFile = useCallback(async (file) => {
    const fakeEvent = { target: { files: [file] } }
    return handleBackgroundUpload(fakeEvent)
  }, [handleBackgroundUpload])
  
  /**
   * Map interaction utilities
   */
  const mapUtilities = {
    /**
     * Calculate bounds that include all map elements
     */
    calculateAllElementsBounds: useCallback(() => {
      const allPoints = []
      
      // Add node positions
      mapState.nodes.forEach(node => {
        allPoints.push([node.lat, node.lng])
      })
      
      // Add observation positions if needed
      // Could extend this to include other map elements
      
      if (allPoints.length === 0) return null
      
      const lats = allPoints.map(p => p[0])
      const lngs = allPoints.map(p => p[1])
      
      return [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ]
    }, [mapState.nodes]),
    
    /**
     * Get current map statistics
     */
    getMapStats: useCallback(() => {
      return {
        nodes: mapState.nodes.length,
        lines: mapState.lines.length,
        linkedLines: mapState.lines.filter(l => l.section).length,
        drawings: mapState.drawings.length,
        hasBackground: mapState.mapData?.background_type === 'image'
      }
    }, [mapState])
  }
  
  return {
    // Background management
    handleBackgroundUpload,
    handleBackgroundRemove,
    triggerBackgroundUpload,
    uploadBackgroundFile,
    
    // Map view management
    handleMapViewChange,
    
    // Event handling
    handleKeyboardShortcuts,
    handleMapLoadError,
    handleMapReady,
    
    // Utilities
    mapUtilities,
    
    // File handling
    createFileInput
  }
}