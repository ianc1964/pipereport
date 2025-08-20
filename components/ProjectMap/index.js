'use client'
import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import dynamic from 'next/dynamic'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import html2canvas from 'html2canvas'
import { Camera, X, Loader2 } from 'lucide-react'
import domtoimage from 'dom-to-image'

// Import custom hooks
import { useMapData } from './hooks/useMapData'
import { useUndoRedo } from './hooks/useUndoRedo'
import { ACTION_TYPES, LEAFLET_ICON_CONFIG, DEFAULT_CENTER, DEFAULT_ZOOM, DEFAULT_BOUNDS, MAP_MODES } from './hooks/constants'
import { useWaypoints } from './hooks/useWaypoints'
import { useModeManagement } from './hooks/useModeManagement'
import { useMapEvents } from './hooks/useMapEvents'

// Import components
import NodeEditModal from './NodeEditModal'
import MapControls from './MapControls'
import NodeTypesModal from './NodeTypesModal'
import DrawingTools from './DrawingTools'
import TransformHandles from './TransformHandles'
import { createNodeHandlers } from './handlers/nodeHandlers'
import { createLineHandlers } from './handlers/lineHandlers'
import { createDrawingHandlers } from './handlers/drawingHandlers'
import MapLegend from './MapLegend'

// Import layer components
import LinesLayer from './components/LinesLayer'
import NodesLayer from './components/NodesLayer'
import ObservationsLayer from './components/ObservationsLayer'
import DrawingsLayer from './components/DrawingsLayer'

// Import API functions
import { 
  uploadMapBackground, updateProjectMap,
  createMapNode, updateMapNode, deleteMapNode, generateNodeRef,
  createMapLine, updateMapLine, deleteMapLine,
  createMapDrawing, updateMapDrawing, deleteMapDrawing,
  getMapNodes
} from '@/lib/maps'

// Import Supabase for reference image upload
import { supabase } from '@/lib/supabase'

// Fix Leaflet default icon issue with Next.js
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions(LEAFLET_ICON_CONFIG)

// Helper function to calculate bounds from all map elements
const calculateBoundsFromElements = (nodes, lines, drawings) => {
  const allPoints = []
  
  // Collect points from nodes
  nodes.forEach(node => {
    if (node.lat && node.lng) {
      allPoints.push([node.lat, node.lng])
    }
  })
  
  // Collect points from lines (waypoints)
  lines.forEach(line => {
    if (line.waypoints && Array.isArray(line.waypoints)) {
      line.waypoints.forEach(point => {
        if (point.lat && point.lng) {
          allPoints.push([point.lat, point.lng])
        }
      })
    }
  })
  
  // Collect points from drawings
  drawings.forEach(drawing => {
    if (drawing.geometry) {
      switch (drawing.geometry.type) {
        case 'point':
        case 'text':
          if (drawing.geometry.coordinates) {
            allPoints.push([
              drawing.geometry.coordinates.lat,
              drawing.geometry.coordinates.lng
            ])
          }
          break
          
        case 'rectangle':
          if (drawing.geometry.bounds) {
            allPoints.push(drawing.geometry.bounds[0])
            allPoints.push(drawing.geometry.bounds[1])
          }
          break
          
        case 'circle':
          if (drawing.geometry.center) {
            const center = drawing.geometry.center
            const radius = drawing.geometry.radius || 100
            // Add approximate bounds for circle
            const latOffset = radius / 111000 // rough conversion
            const lngOffset = radius / (111000 * Math.cos(center.lat * Math.PI / 180))
            
            allPoints.push([center.lat - latOffset, center.lng - lngOffset])
            allPoints.push([center.lat + latOffset, center.lng + lngOffset])
          }
          break
          
        case 'polygon':
        case 'line':
          if (drawing.geometry.coordinates && Array.isArray(drawing.geometry.coordinates)) {
            drawing.geometry.coordinates.forEach(coord => {
              if (coord.lat && coord.lng) {
                allPoints.push([coord.lat, coord.lng])
              }
            })
          }
          break
      }
    }
  })
  
  // If no points found, return null
  if (allPoints.length === 0) {
    return null
  }

  // Filter out any undefined/null points and ensure they have valid coordinates
  const validPoints = allPoints.filter(p => 
    p && 
    Array.isArray(p) && 
    p.length >= 2 && 
    typeof p[0] === 'number' && 
    typeof p[1] === 'number' &&
    !isNaN(p[0]) && 
    !isNaN(p[1])
  )

  // Check if we have any valid points after filtering
  if (validPoints.length === 0) {
    console.warn('No valid coordinates found for fit to content')
    return null
  }

  // Calculate bounds using valid points only
  const lats = validPoints.map(p => p[0])
  const lngs = validPoints.map(p => p[1])

  const bounds = [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)]
  ]

  // Add some padding (5% on each side)
  const latPadding = (bounds[1][0] - bounds[0][0]) * 0.05
  const lngPadding = (bounds[1][1] - bounds[0][1]) * 0.05

  return [
    [bounds[0][0] - latPadding, bounds[0][1] - lngPadding],
    [bounds[1][0] + latPadding, bounds[1][1] + lngPadding]
  ]
}
// Dynamic imports
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
)
const ImageOverlay = dynamic(
  () => import('react-leaflet').then(mod => mod.ImageOverlay),
  { ssr: false }
)

const DrawingBackgroundManager = dynamic(
  () => import('./components/DrawingBackgroundManager'),
  { ssr: false }
)


const ProjectMap = forwardRef(function ProjectMap({ 
  projectId, 
  sections = [], 
  observations = [],
  onJumpToVideo,
}, ref) {
  // Get URL parameters for special modes
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const urlMode = urlParams?.get('mode')
  const reportId = urlParams?.get('reportId')
  
  // Determine if we're in capture mode
  const isCaptureMode = urlMode === 'capture'
  const isReadOnly = isCaptureMode
  
  // Capture mode state
  const [captureState, setCaptureState] = useState({
    isCapturing: false,
    captureError: null
  })
  
  // Use custom hooks for state management
  const mapState = useMapData(projectId)
  const undoRedo = useUndoRedo(
    projectId, 
    mapState.mapData, 
    mapState.setNodes, 
    mapState.setLines, 
    mapState.setDrawings, 
    mapState.setMapData
  )

  const [backgroundType, setBackgroundType] = useState(
    mapState.mapData?.background_type || 'map'
  )
  
  // Reference image state
  const [referenceImageUrl, setReferenceImageUrl] = useState(null)
  const [referenceImageOpacity, setReferenceImageOpacity] = useState(0.5)
  const [uploadingReferenceImage, setUploadingReferenceImage] = useState(false)
  
  // Map opacity state
  const [mapOpacity, setMapOpacity] = useState(1.0)

  // Transform handles state
  const [selectedDrawing, setSelectedDrawing] = useState(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedDrawings, setSelectedDrawings] = useState([])
  
  // Local refs and state for interaction
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null) // Separate ref for the actual Leaflet map instance
  const drawingToolsRef = useRef(null)
  const mapContainerRef = useRef(null) // Reference to the map container div
  
  // Create line handlers using the factory function
  const lineHandlers = createLineHandlers({
    mapState,
    undoRedo
  })

  // Create drawing handlers using the factory function
  const drawingHandlers = createDrawingHandlers({
    mapState,
    undoRedo,
    drawingToolsRef
  })

  // Create waypoint management with enhanced line handlers
  const waypoints = useWaypoints(lineHandlers)

  // Create mode management first (before node handlers to avoid circular dependency)
  const modeManager = useModeManagement({
    mapState,
    waypointsHook: waypoints
  })

  // Determine current context for node creation
  const currentContext = backgroundType === 'blank' ? 'canvas' : 'map'

  // Create base node handlers with proper setMode function
  const baseNodeHandlers = createNodeHandlers({
    projectId,
    sections,
    mapState,
    undoRedo,
    setMode: modeManager.setMode // Pass the actual function, not null
  })

  // Create wrapper node handlers with context support - only if not in read-only mode
  const nodeHandlers = isReadOnly ? {} : {
    ...baseNodeHandlers,
    handleMapClick: async (latlng) => {
      // Check if we have a selected node type (same as original)
      if (!mapState.selectedNodeType) return
      
      try {
        // Follow the original pattern but add context
        const existingRefs = mapState.nodes.map(n => n.node_ref)
        const nodeRef = generateNodeRef('MH', existingRefs)
        
        // Create node with context injection
        const newNode = await createMapNode({
          project_id: projectId,
          node_type_id: mapState.selectedNodeType, // Use correct field name
          node_ref: nodeRef,
          name: nodeRef,
          lat: latlng.lat,
          lng: latlng.lng,
          context: currentContext // Add context field
        })
        
        // Update local state
        mapState.setNodes([...mapState.nodes, newNode])
        
        // Add to undo history
        undoRedo.addToHistory({
          type: ACTION_TYPES.CREATE_NODE,
          data: { node: newNode }
        })
        
        // Switch back to view mode (same as original)
        modeManager.setMode('view')
        
        console.log('✅ Node created successfully with context:', currentContext)
      } catch (error) {
        console.error('❌ Error creating node:', error)
        alert('Failed to create node')
      }
    }
  }

  // Create map events management
  const mapEvents = useMapEvents({
    projectId,
    mapState,
    undoRedo
  })

  // Filter data by current context - in capture mode, show ALL data
  const contextNodes = (isCaptureMode) 
    ? mapState.nodes 
    : mapState.nodes.filter(node => {
        const nodeContext = node.context || 'map'
        return nodeContext === currentContext
      })

  const contextLines = (isCaptureMode)
    ? mapState.lines
    : mapState.lines.filter(line => {
        const lineContext = line.context || 'map'
        return lineContext === currentContext
      })

  const contextDrawings = (isCaptureMode)
    ? mapState.drawings
    : mapState.drawings.filter(drawing => {
        const drawingContext = drawing.context || 'map'
        return drawingContext === currentContext
      })

  // Function to fit map to all elements
  const fitMapToElements = useCallback(() => {
    if (!mapInstanceRef.current) return
    
    // Calculate bounds from current context elements
    const bounds = calculateBoundsFromElements(contextNodes, contextLines, contextDrawings)
    
    if (bounds) {
      // Fit the map to the calculated bounds
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [50, 50], // Add some padding around the elements
        maxZoom: 18 // Don't zoom in too close
      })
      
      console.log('✅ Map fitted to show all elements')
    } else if (!mapState.mapData?.center_lat) {
      // No elements and no saved position, use default
      mapInstanceRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    }
  }, [contextNodes, contextLines, contextDrawings, mapState.mapData])

  // Function to save current viewport to database
  const saveViewport = useCallback(async () => {
    if (!mapInstanceRef.current || !mapState.mapData?.id || isReadOnly) return
    
    try {
      const center = mapInstanceRef.current.getCenter()
      const zoom = mapInstanceRef.current.getZoom()
      
      await updateProjectMap(mapState.mapData.id, {
        center_lat: center.lat,
        center_lng: center.lng,
        default_zoom: zoom
      })
      
      console.log('✅ Map viewport saved')
    } catch (error) {
      console.error('Failed to save viewport:', error)
    }
  }, [mapState.mapData, isReadOnly])

 // Replace the captureMapSnapshot function with this fixed version that includes the legend

 const captureMapSnapshot = async () => {
   console.log('📸 FIXED CAPTURE: Starting capture with legend...')
   
   setCaptureState({ isCapturing: true, captureError: null })
   
   try {
     // Force map to update/redraw before capture
     mapInstanceRef.current.invalidateSize()
     await new Promise(resolve => setTimeout(resolve, 500))
     
     // Hide ONLY the capture UI and leaflet controls, but keep the legend
     const leafletControls = mapContainerRef.current.querySelectorAll('.leaflet-control')
     leafletControls.forEach(control => {
       control.style.visibility = 'hidden'
     })
     
     const captureUI = document.getElementById('capture-ui')
     if (captureUI) {
       captureUI.style.visibility = 'hidden'
     }
     
     // Close any popups
     mapInstanceRef.current.closePopup()
     
     // Wait for UI changes to take effect
     await new Promise(resolve => setTimeout(resolve, 200))
     
     console.log('📸 Capturing ENTIRE map container (including legend)...')
     
     // Capture the ENTIRE map container div (includes legend + map)
     const mapContainerDiv = mapContainerRef.current
     
     // Capture options for good quality but manageable size
     const options = {
       quality: 0.9,
       width: mapContainerDiv.offsetWidth,
       height: mapContainerDiv.offsetHeight,
       filter: (node) => {
         // Exclude leaflet controls and capture UI
         if (node.classList) {
           if (node.classList.contains('leaflet-control-container')) return false
           if (node.id === 'capture-ui') return false
         }
         return true
       },
       cacheBust: true,
       backgroundColor: '#f8f9fa' // Light background
     }
     
     console.log('📸 Capture options:', {
       width: options.width,
       height: options.height,
       targetElement: 'mapContainerRef (includes legend)'
     })
     
     // Try to capture the full map container
     let imageData
     try {
       imageData = await domtoimage.toPng(mapContainerDiv, options)
       console.log('✅ Full map container captured successfully')
       console.log('📸 Image data size:', imageData.length, 'characters')
       console.log('📸 Image data preview:', imageData.substring(0, 100) + '...')
     } catch (pngError) {
       console.warn('PNG capture failed, trying JPEG:', pngError)
       try {
         imageData = await domtoimage.toJpeg(mapContainerDiv, {
           ...options,
           quality: 0.85
         })
         console.log('✅ JPEG capture successful')
       } catch (jpegError) {
         console.error('Both PNG and JPEG capture failed:', jpegError)
         throw new Error('Image capture failed: ' + jpegError.message)
       }
     }
     
     // Restore hidden elements
     leafletControls.forEach(control => {
       control.style.visibility = ''
     })
     if (captureUI) {
       captureUI.style.visibility = ''
     }
     
     // Get current map state
     const center = mapInstanceRef.current.getCenter()
     const zoom = mapInstanceRef.current.getZoom()
     const bounds = mapInstanceRef.current.getBounds()
     
     const viewState = {
       center: [center.lat, center.lng],
       zoom: zoom,
       bounds: [
         [bounds.getSouth(), bounds.getWest()],
         [bounds.getNorth(), bounds.getEast()]
       ]
     }
     
     // Create snapshot data with additional metadata
     const snapshotData = {
       type: 'map-snapshot-captured',
       name: `${backgroundType === 'blank' ? 'Drawing Canvas' : 'Map'} - ${new Date().toLocaleString()}`,
       description: `Captured from ${backgroundType === 'blank' ? 'drawing canvas' : 'map view'} at zoom level ${zoom}`,
       context: backgroundType === 'blank' ? 'canvas' : 'map',
       imageUrl: imageData,
       viewState: viewState,
       backgroundType: backgroundType,
       timestamp: new Date().toISOString(),
       metadata: {
         captureMethod: 'localStorage-bridge',
         includesLegend: true,
         imageFormat: imageData.startsWith('data:image/png') ? 'PNG' : 'JPEG',
         captureSize: {
           width: mapContainerDiv.offsetWidth,
           height: mapContainerDiv.offsetHeight
         }
       }
     }
     
     console.log('💾 Saving enhanced snapshot data to localStorage...')
     console.log('📋 Snapshot metadata:', snapshotData.metadata)
     
     // Use localStorage as communication bridge
     const storageKey = `map_snapshot_${Date.now()}`
     localStorage.setItem(storageKey, JSON.stringify(snapshotData))
     localStorage.setItem('latest_map_snapshot_key', storageKey)
     
     console.log('💾 Enhanced snapshot saved to localStorage with key:', storageKey)
     
     // Try postMessage as backup notification
     if (window.opener && !window.opener.closed) {
       try {
         window.opener.postMessage({
           type: 'map-snapshot-via-localstorage',
           storageKey: storageKey,
           timestamp: Date.now()
         }, '*')
         console.log('📤 Notification sent to parent')
       } catch (e) {
         console.log('📤 PostMessage failed (expected):', e.message)
       }
     }
     
     // Show success message with details
     alert(`✅ Map snapshot captured successfully!\n\n• Includes map legend\n• Image size: ${Math.round(imageData.length / 1024)} KB\n• Format: ${snapshotData.metadata.imageFormat}\n\nThe report editor will automatically detect it. You can close this window.`)
     
     // Auto-close after 3 seconds
     setTimeout(() => {
       console.log('🔄 Auto-closing capture window...')
       window.close()
     }, 3000)
     
   } catch (error) {
     console.error('❌ Enhanced capture failed:', error)
     setCaptureState({ isCapturing: false, captureError: error.message })
     
     // Restore hidden elements on error
     const leafletControls = mapContainerRef.current.querySelectorAll('.leaflet-control')
     leafletControls.forEach(control => {
       control.style.visibility = ''
     })
     const captureUI = document.getElementById('capture-ui')
     if (captureUI) {
       captureUI.style.visibility = ''
     }
     
     alert('Enhanced capture failed: ' + error.message)
   }
 }
  // Reference image handlers
  const handleReferenceImageUpload = async (file) => {
    if (!file || !projectId || isReadOnly) return
    
    setUploadingReferenceImage(true)
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${projectId}_ref_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/map-references/${fileName}`
      
      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file)
      
      if (uploadError) throw uploadError
      
      // Get the public URL
      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)
      
      const publicUrl = data.publicUrl
      
      // Update database with reference image URL
      if (mapState.mapData?.id) {
        await updateProjectMap(mapState.mapData.id, {
          reference_image_url: publicUrl,
          reference_image_opacity: referenceImageOpacity
        })
      }
      
      setReferenceImageUrl(publicUrl)
      console.log('✅ Reference image uploaded successfully')
    } catch (error) {
      console.error('Error uploading reference image:', error)
      alert('Failed to upload reference image. Please try again.')
    } finally {
      setUploadingReferenceImage(false)
    }
  }
  
  const handleReferenceImageRemove = async () => {
    if (!mapState.mapData?.id || isReadOnly) return
    
    try {
      // Remove from database
      await updateProjectMap(mapState.mapData.id, {
        reference_image_url: null,
        reference_image_opacity: null
      })
      
      // Delete from storage if we have the URL
      if (referenceImageUrl) {
        try {
          // Extract the file path from the URL
          const urlParts = referenceImageUrl.split('/storage/v1/object/public/images/')
          if (urlParts.length > 1) {
            const filePath = urlParts[1]
            const { error } = await supabase.storage
              .from('images')
              .remove([filePath])
            
            if (error) {
              console.error('Error deleting file from storage:', error)
            }
          }
        } catch (error) {
          console.error('Error deleting file from storage:', error)
          // Continue even if deletion fails
        }
      }
      
      setReferenceImageUrl(null)
      console.log('✅ Reference image removed')
    } catch (error) {
      console.error('Error removing reference image:', error)
      alert('Failed to remove reference image')
    }
  }
  
  const handleReferenceImageOpacityChange = async (newOpacity) => {
    setReferenceImageOpacity(newOpacity)
    
    // Save to database
    if (mapState.mapData?.id && referenceImageUrl && !isReadOnly) {
      try {
        await updateProjectMap(mapState.mapData.id, {
          reference_image_opacity: newOpacity
        })
      } catch (error) {
        console.error('Error saving opacity:', error)
      }
    }
  }
  
  // Map opacity handler
  const handleMapOpacityChange = async (newOpacity) => {
    setMapOpacity(newOpacity)
    
    // Save to database if needed
    if (mapState.mapData?.id && !isReadOnly) {
      try {
        await updateProjectMap(mapState.mapData.id, {
          map_opacity: newOpacity
        })
      } catch (error) {
        console.error('Error saving map opacity:', error)
      }
    }
  }

  // Transform handles operations
  const handleTransformStart = useCallback((drawing, transformType, position) => {
    if (isReadOnly) return
    
    console.log('🎯 Transform started:', { drawing: drawing.name, transformType, position })
    
    // Add to history before starting transform
    undoRedo.addToHistory({
      type: ACTION_TYPES.UPDATE_DRAWING,
      data: { 
        drawing: { ...drawing }, // Store original state
        isTransformStart: true
      }
    })
  }, [undoRedo, isReadOnly])

  const handleTransformUpdate = useCallback(async (drawingId, updates, options = {}) => {
    if (isReadOnly) return
    
    console.log('🔄 Transform update:', { drawingId, updates, isTemporary: options.isTemporary })
    
    // Update the drawing in local state immediately for smooth interaction
    mapState.setDrawings(prevDrawings => 
      prevDrawings.map(drawing => 
        drawing.id === drawingId 
          ? { 
              ...drawing, 
              ...updates,
              // Merge transform data if it exists
              transform: updates.transform ? 
                { ...(drawing.transform || {}), ...updates.transform } : 
                drawing.transform
            }
          : drawing
      )
    )

    
    // Update selected drawing if it's the one being transformed
    if (selectedDrawing && selectedDrawing.id === drawingId) {
      setSelectedDrawing(prev => ({ 
        ...prev, 
        ...updates,
        transform: updates.transform ? 
          { ...(prev.transform || {}), ...updates.transform } : 
          prev.transform
      }))
    }
    
    // Only save to database if this is not a temporary update
    if (!options.isTemporary) {
      try {
        // Prepare the update object
        const updateData = {
          updated_at: new Date().toISOString()
        }
        
        // Add geometry if it was updated
        if (updates.geometry) {
          updateData.geometry = updates.geometry
        }
        
        // Add transform if it was updated
        if (updates.transform) {
          // Get the current drawing to merge transform data
          const currentDrawing = mapState.drawings.find(d => d.id === drawingId)
          updateData.transform = {
            ...(currentDrawing?.transform || {}),
            ...updates.transform
          }
        }
        
        await updateMapDrawing(drawingId, updateData)
        console.log('💾 Drawing saved to database with transform data')
      } catch (error) {
        console.error('❌ Failed to save drawing:', error)
        // Could add error toast notification here
      }
    }
  }, [mapState, selectedDrawing, isReadOnly])

  const handleTransformEnd = useCallback(async (drawing, transformType) => {
    if (isReadOnly) return
    
    console.log('✅ Transform ended:', { drawing: drawing.name, transformType })
    
    try {
      // Update the drawing in the database
      const updatedDrawing = mapState.drawings.find(d => d.id === drawing.id)
      if (updatedDrawing) {
        await updateMapDrawing(drawing.id, {
          geometry: updatedDrawing.geometry,
          updated_at: new Date().toISOString()
        })
        
        console.log('💾 Drawing saved to database after transform')
      }
    } catch (error) {
      console.error('❌ Failed to save transformed drawing:', error)
      // Could add error handling here - maybe revert the change
    }
  }, [mapState.drawings, isReadOnly])

  const handleBackgroundTypeChange = async (newType) => {
    if (isReadOnly) return
    
    // Close all popups when switching from canvas to map mode
    if (backgroundType === 'blank' && newType === 'map' && mapInstanceRef.current) {
      mapInstanceRef.current.closePopup()
    }
    
    setBackgroundType(newType)
    
    // Save the background type to database if we have a map
    if (mapState.mapData?.id) {
      try {
        await updateProjectMap(mapState.mapData.id, {
          background_type: newType
        })
        console.log(`✅ Background type changed to: ${newType}`)
      } catch (error) {
        console.error('Error saving background type:', error)
      }
    }
  }
  // Drawing selection handlers
  const handleDrawingSelect = useCallback((drawing, event) => {
    if (isReadOnly) return
    
    console.log('🎯 Drawing selected:', drawing?.name)
    
    if (!drawing) {
      setSelectedDrawing(null)
      setSelectedDrawings([])
      return
    }
    
    if (multiSelectMode && event?.ctrlKey) {
      // Multi-select with Ctrl+click
      setSelectedDrawings(prev => {
        const isAlreadySelected = prev.some(d => d.id === drawing.id)
        if (isAlreadySelected) {
          return prev.filter(d => d.id !== drawing.id)
        } else {
          return [...prev, drawing]
        }
      })
    } else {
      // Single select
      setSelectedDrawing(drawing)
      setSelectedDrawings([])
      // Switch to drawing mode to show transform handles
      if (modeManager.mode === 'view') {
        modeManager.setMode('drawing')
      }
    }
  }, [multiSelectMode, modeManager, isReadOnly])

  const handleDrawingDeselect = useCallback(() => {
    console.log('❌ Drawing deselected')
    setSelectedDrawing(null)
    setSelectedDrawings([])
  }, [])

  // Multi-select mode toggle
  const toggleMultiSelectMode = useCallback(() => {
    if (isReadOnly) return
    
    setMultiSelectMode(prev => !prev)
    if (multiSelectMode) {
      // Exiting multi-select mode
      setSelectedDrawings([])
    } else {
      // Entering multi-select mode
      setSelectedDrawing(null)
    }
  }, [multiSelectMode, isReadOnly])

  // Enhanced drawing handlers with selection integration
  const enhancedDrawingHandlers = isReadOnly ? {} : {
    ...drawingHandlers,
    handleDrawingsUpdate: async (operation, drawingData) => {
      console.log('🎨 Enhanced drawing update:', { operation, drawingData })
      
      // Call original handler
      const result = await drawingHandlers.handleDrawingsUpdate(operation, drawingData)
      
      // Clear selection if drawing was deleted
      if (operation === 'delete' && selectedDrawing && selectedDrawing.id === drawingData.id) {
        handleDrawingDeselect()
      }
      
      return result
    },
    
    // Add selection handlers
    handleDrawingSelect,
    handleDrawingDeselect
  }

  // Function to get map container CSS classes based on mode
  const getMapContainerClasses = () => {
    const baseClasses = "h-full w-full"
    const modeClass = isReadOnly ? 'map-mode-view' : `map-mode-${modeManager.mode.replace('_', '-')}`
    const drawingActiveClass = modeManager.isDrawingMode ? 'map-drawing-active' : ''
    const multiSelectClass = multiSelectMode ? 'map-multi-select-active' : ''
    const hasSelectedClass = selectedDrawing ? 'has-selected-drawing' : ''
    
    return `${baseClasses} ${modeClass} ${drawingActiveClass} ${multiSelectClass} ${hasSelectedClass}`.trim()
  }

  // Effect to update map container CSS classes when mode changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      const container = mapInstanceRef.current.getContainer()
      if (container) {
        // Remove all existing mode classes
        container.classList.remove(
          'map-mode-view', 
          'map-mode-add-node', 
          'map-mode-draw-line', 
          'map-mode-drawing',
          'map-drawing-active',
          'map-multi-select-active',
          'leaflet-crosshair-cursor',
          'has-selected-drawing'
        )
        
        // Add current mode class
        const modeClass = isReadOnly ? 'map-mode-view' : `map-mode-${modeManager.mode.replace('_', '-')}`
        container.classList.add(modeClass)
        
        // Add drawing active class if in drawing mode
        if (modeManager.isDrawingMode && !isReadOnly) {
          container.classList.add('map-drawing-active', 'leaflet-crosshair-cursor')
        }
        
        // Add multi-select class
        if (multiSelectMode && !isReadOnly) {
          container.classList.add('map-multi-select-active')
        }
        
        // Add selected drawing class
        if (selectedDrawing && !isReadOnly) {
          container.classList.add('has-selected-drawing')
        }
        
        // Add crosshair class for add node mode too
        if (modeManager.mode === MAP_MODES.ADD_NODE && !isReadOnly) {
          container.classList.add('leaflet-crosshair-cursor')
        }
      }
    }
  }, [modeManager.mode, modeManager.isDrawingMode, multiSelectMode, selectedDrawing, isReadOnly])

  // Enhanced node click wrapper with mode management
  const handleNodeClickWrapper = async (node) => {
    if (isReadOnly) return
    
    if (modeManager.mode === 'draw_line') {
      const lineData = await nodeHandlers.handleNodeClick(node, modeManager.mode)
    
      if (lineData && lineData.startNode && lineData.endNode) {
        // Handle line creation with error isolation
        try {
          const lineCreateData = {
            project_id: projectId,
            start_node_id: lineData.startNode.id,
            end_node_id: lineData.endNode.id,
            line_type: 'drain',
            section_id: lineData.selectedSectionId || null,
            context: currentContext // Add context to line creation
          }
          
          // Core operation - create the line
          const newLine = await createMapLine(lineCreateData)
          
          // Immediately update local state
          mapState.setLines(prevLines => [...prevLines, newLine])
          
          // Optional operations - node reference updates
          const nodeUpdates = []
          
          if (lineData.selectedSectionId && newLine.section) {
            const section = sections.find(s => s.id === lineData.selectedSectionId)
            if (section && section.start_ref && section.finish_ref) {
              
              // Check start node reference update
              const existingStartNodeWithRef = mapState.nodes.find(n => 
                n.node_ref === section.start_ref && n.id !== lineData.startNode.id
              )
              
              if (!existingStartNodeWithRef && lineData.startNode.node_ref !== section.start_ref) {
                try {
                  const previousStartState = { ...lineData.startNode }
                  const updatedStartNode = await updateMapNode(lineData.startNode.id, {
                    node_ref: section.start_ref,
                    name: section.start_ref
                  })
                  mapState.setNodes(prevNodes => 
                    prevNodes.map(n => n.id === lineData.startNode.id ? updatedStartNode : n)
                  )
                  nodeUpdates.push({
                    nodeId: lineData.startNode.id,
                    previousState: { node_ref: previousStartState.node_ref, name: previousStartState.name },
                    newState: { node_ref: section.start_ref, name: section.start_ref }
                  })
                } catch (nodeUpdateError) {
                  console.warn('Optional start node update failed:', nodeUpdateError)
                }
              }
              
              // Check end node reference update
              const existingEndNodeWithRef = mapState.nodes.find(n => 
                n.node_ref === section.finish_ref && n.id !== lineData.endNode.id
              )
              
              if (!existingEndNodeWithRef && lineData.endNode.node_ref !== section.finish_ref) {
                try {
                  const previousEndState = { ...lineData.endNode }
                  const updatedEndNode = await updateMapNode(lineData.endNode.id, {
                    node_ref: section.finish_ref,
                    name: section.finish_ref
                  })
                  mapState.setNodes(prevNodes => 
                    prevNodes.map(n => n.id === lineData.endNode.id ? updatedEndNode : n)
                  )
                  nodeUpdates.push({
                    nodeId: lineData.endNode.id,
                    previousState: { node_ref: previousEndState.node_ref, name: previousEndState.name },
                    newState: { node_ref: section.finish_ref, name: section.finish_ref }
                  })
                } catch (nodeUpdateError) {
                  console.warn('Optional end node update failed:', nodeUpdateError)
                }
              }
            }
          }
          
          undoRedo.addToHistory({
            type: ACTION_TYPES.CREATE_LINE,
            data: { 
              line: newLine, 
              lineData: lineCreateData,
              nodeUpdates: nodeUpdates.length > 0 ? nodeUpdates : null
            }
          })
          
          mapState.setDrawingLine(null)
          mapState.setSelectedSectionId(null)
          modeManager.setMode('view')
          
          console.log('✅ Line created successfully')
        } catch (error) {
          console.error('❌ Failed to create line:', error)
          alert('Failed to create line. Please try again.')
        }
      }
    } else {
      // For view mode, just call the node handler
      nodeHandlers.handleNodeClick(node, modeManager.mode)
    }
  }

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    getMapInstance: () => mapInstanceRef.current,
    refreshMapData: () => {
      mapState.loadMapData()
    },
    setMapMode: (newMode) => {
      if (!isReadOnly) {
        modeManager.setMode(newMode)
      }
    },
    // Expose selection methods
    selectDrawing: handleDrawingSelect,
    deselectDrawing: handleDrawingDeselect,
    getSelectedDrawing: () => selectedDrawing,
    toggleMultiSelect: toggleMultiSelectMode,
    // Expose fit to content method
    fitToContent: fitMapToElements
  }), [mapState.loadMapData, modeManager.setMode, handleDrawingSelect, handleDrawingDeselect, selectedDrawing, toggleMultiSelectMode, isReadOnly, fitMapToElements])
  
  // Load initial data
  useEffect(() => {
    console.log('📍 backgroundType changed to:', backgroundType, 'mapState.mapData:', mapState.mapData)
  }, [backgroundType, mapState.mapData])

  useEffect(() => {
    mapState.loadMapData()
  }, [mapState.loadMapData])

  // Add keyboard shortcut support
  useEffect(() => {
    if (isReadOnly) return
    
    const handleKeyDown = mapEvents.handleKeyboardShortcuts
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mapEvents.handleKeyboardShortcuts, isReadOnly])

  // Sync background type, reference image, and map opacity from database
  useEffect(() => {
    if (mapState.mapData) {
      // Update background type
      if (mapState.mapData.background_type) {
        setBackgroundType(mapState.mapData.background_type)
      }
      
      // Update reference image URL
      if (mapState.mapData.reference_image_url) {
        setReferenceImageUrl(mapState.mapData.reference_image_url)
      }
      
      // Update reference image opacity
      if (mapState.mapData.reference_image_opacity !== undefined) {
        setReferenceImageOpacity(mapState.mapData.reference_image_opacity)
      }
      
      // Update map opacity
      if (mapState.mapData.map_opacity !== undefined) {
        setMapOpacity(mapState.mapData.map_opacity)
      }
    }
  }, [mapState.mapData])

  
  // ZOOM FIX: Replace the useEffect around lines 665-680 with this improved version:

useEffect(() => {
  if (!mapInstanceRef.current || mapState.loading) return
  
  // Check if we have a saved viewport
  if (mapState.mapData?.center_lat && mapState.mapData?.center_lng) {
    // Use saved viewport - only on initial load
    if (!mapInstanceRef.current._viewportInitialized) {
      mapInstanceRef.current.setView(
        [mapState.mapData.center_lat, mapState.mapData.center_lng],
        mapState.mapData.default_zoom || DEFAULT_ZOOM
      )
      mapInstanceRef.current._viewportInitialized = true
    }
  } else if (!mapInstanceRef.current._viewportInitialized) {
    // No saved viewport and not initialized yet, fit to elements
    // Only run this on initial load, not on subsequent changes
    const timer = setTimeout(() => {
      fitMapToElements()
      mapInstanceRef.current._viewportInitialized = true
    }, 100)
    
    return () => clearTimeout(timer)
  }
  
  // After initial load, don't auto-fit when context elements change
  // This preserves user's zoom and position when switching modes
}, [
  mapState.mapData?.center_lat, 
  mapState.mapData?.center_lng, 
  mapState.mapData?.default_zoom,
  mapState.loading,
  fitMapToElements
  // REMOVED: contextNodes.length, contextLines.length, contextDrawings.length
  // These were causing the zoom reset when switching to drawing mode
])

// ADDITIONAL FIX: Add this new useEffect to handle mode switching without zoom reset
useEffect(() => {
  // When switching from drawing mode back to view mode, don't auto-fit
  // This preserves the user's current zoom and position
  if (mapInstanceRef.current && mapInstanceRef.current._viewportInitialized) {
    // Map is already initialized, don't change viewport when switching modes
    return
  }
}, [modeManager.mode, backgroundType])

  // Add viewport saving on map move/zoom
  useEffect(() => {
    if (!mapInstanceRef.current || isReadOnly) return
    
    let saveTimer
    
    const handleViewportChange = () => {
      // Debounce the save operation
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveViewport()
      }, 1000) // Save 1 second after user stops moving/zooming
    }
    
    mapInstanceRef.current.on('moveend', handleViewportChange)
    mapInstanceRef.current.on('zoomend', handleViewportChange)
    
    return () => {
      clearTimeout(saveTimer)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('moveend', handleViewportChange)
        mapInstanceRef.current.off('zoomend', handleViewportChange)
      }
    }
  }, [saveViewport, isReadOnly])

  // Keyboard shortcuts for selection and transform
  useEffect(() => {
    if (isReadOnly) return
    
    // Fixed keyboard handler that doesn't interfere with text input
    const handleSelectionKeyboard = (e) => {
      // Check if user is currently typing in an input field
      const activeElement = document.activeElement
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true' ||
        activeElement.isContentEditable
      )
      
      // Don't intercept keys if user is typing
      if (isTyping) {
        return
      }
      
      // Toggle multi-select mode with 'M' key
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        toggleMultiSelectMode()
      }
      
      // Deselect with Escape key
      if (e.key === 'Escape') {
        e.preventDefault()
        handleDrawingDeselect()
      }
      
      // Delete selected drawing(s) with Delete key
      if (e.key === 'Delete' && (selectedDrawing || selectedDrawings.length > 0)) {
        e.preventDefault()
        if (selectedDrawing) {
          enhancedDrawingHandlers.handleDrawingsUpdate('delete', { id: selectedDrawing.id })
        }
        selectedDrawings.forEach(drawing => {
          enhancedDrawingHandlers.handleDrawingsUpdate('delete', { id: drawing.id })
        })
      }
    }

    window.addEventListener('keydown', handleSelectionKeyboard)
    return () => window.removeEventListener('keydown', handleSelectionKeyboard)
  }, [selectedDrawing, selectedDrawings, toggleMultiSelectMode, handleDrawingDeselect, enhancedDrawingHandlers, isReadOnly])

  // Enhanced Map Events Component from mode manager
  const MapEventsComponentWithMode = () => {
    if (isReadOnly) return null
    
    return (
      <modeManager.MapEventsComponent 
        handlers={{
          nodeHandlers,
          drawingHandlers: enhancedDrawingHandlers
        }}
      />
    )
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200" ref={ref}>
      {/* Map Header Controls - Hide in capture mode */}
      {!isReadOnly && (
        <MapControls
          mode={modeManager.mode}
          setMode={modeManager.setMode}
          showNodes={mapState.showNodes}
          setShowNodes={mapState.setShowNodes}
          showLines={mapState.showLines}
          setShowLines={mapState.setShowLines}
          showObservations={mapState.showObservations}
          setShowObservations={mapState.setShowObservations}
          showLabels={mapState.showLabels}
          setShowLabels={mapState.setShowLabels}
          showDrawings={mapState.showDrawings}
          setShowDrawings={mapState.setShowDrawings}
          drawingsCount={contextDrawings.length}
          onBackgroundUpload={mapEvents.handleBackgroundUpload}
          nodeTypes={mapState.nodeTypes}
          selectedNodeType={mapState.selectedNodeType}
          setSelectedNodeType={mapState.setSelectedNodeType}
          sections={sections}
          backgroundType={backgroundType}
          onBackgroundTypeChange={handleBackgroundTypeChange}
          lines={contextLines}
          selectedSectionId={mapState.selectedSectionId}
          setSelectedSectionId={mapState.setSelectedSectionId}
          drawingLine={mapState.drawingLine}
          setDrawingLine={mapState.setDrawingLine}
          onManageNodeTypes={() => mapState.setShowNodeTypesModal(true)}
          map={mapInstanceRef.current}
          // Reference image props
          referenceImageUrl={referenceImageUrl}
          onReferenceImageUpload={handleReferenceImageUpload}
          onReferenceImageRemove={handleReferenceImageRemove}
          referenceImageOpacity={referenceImageOpacity}
          onReferenceImageOpacityChange={handleReferenceImageOpacityChange}
          uploadingReferenceImage={uploadingReferenceImage}
          // Map opacity props
          mapOpacity={mapOpacity}
          onMapOpacityChange={handleMapOpacityChange}
          // Fit to content method
          onFitToContent={fitMapToElements}
        />
      )}
      
      {/* Drawing Tools - Hide in read-only mode */}
      {modeManager.isDrawingMode && !isReadOnly && (
        <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
          <DrawingTools
            map={mapInstanceRef.current}
            projectId={projectId}
            drawings={contextDrawings}
            onDrawingsUpdate={enhancedDrawingHandlers.handleDrawingsUpdate}
            mode={modeManager.mode}
            setMode={modeManager.setMode}
            showDrawings={mapState.showDrawings}
            setShowDrawings={mapState.setShowDrawings}
            selectedDrawing={selectedDrawing}
            setSelectedDrawing={setSelectedDrawing}
            onDrawingSelect={handleDrawingSelect}
            ref={drawingToolsRef}
            drawingContext={backgroundType === 'blank' ? 'canvas' : 'map'}
          />
        </div>
      )}
      
      {/* Transform Status - Hide in read-only mode */}
      {selectedDrawing && modeManager.mode === 'drawing' && !isReadOnly && (
        <div className="px-4 py-3 border-b border-gray-200 bg-green-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ 
                    backgroundColor: selectedDrawing.style?.fillColor !== 'transparent' ? selectedDrawing.style?.fillColor : 'white',
                    borderColor: selectedDrawing.style?.color || '#ccc',
                    borderWidth: 1
                  }}
                />
                <span className="font-medium text-green-700">
                  Transform Mode: {selectedDrawing.name}
                </span>
              </div>
              <span className="text-sm text-green-600">
                • Drag shape to move • Drag blue handles to resize • Drag green handle to rotate
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDrawingDeselect}
                className="px-4 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 font-medium"
                title="Deselect shape (Esc key)"
              >
                ✕ Deselect Shape
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Select Status - Hide in read-only mode */}
      {selectedDrawings.length > 0 && modeManager.isDrawingMode && !isReadOnly && (
        <div className="px-4 py-3 border-b border-gray-200 bg-purple-50">
          <div className="flex items-center justify-between">
            <span className="font-medium text-purple-700">
              {selectedDrawings.length} drawings selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  selectedDrawings.forEach(drawing => {
                    enhancedDrawingHandlers.handleDrawingsUpdate('delete', { id: drawing.id })
                  })
                }}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                title="Delete selected (Delete key)"
              >
                Delete All
              </button>
              <button
                onClick={() => setSelectedDrawings([])}
                className="px-3 py-1 text-xs bg-white text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Undo/Redo Controls - Hide in read-only mode */}
      {!isReadOnly && (
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center space-x-2">
            <button
              onClick={undoRedo.undo}
              disabled={!undoRedo.canUndo}
              className={`px-3 py-1.5 text-sm rounded flex items-center space-x-1 ${
                undoRedo.canUndo 
                  ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span>Undo</span>
            </button>
            
            <button
              onClick={undoRedo.redo}
              disabled={!undoRedo.canRedo}
              className={`px-3 py-1.5 text-sm rounded flex items-center space-x-1 ${
                undoRedo.canRedo 
                  ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
              </svg>
              <span>Redo</span>
            </button>
            
            <span className="text-xs text-gray-500 ml-4">
              History: {undoRedo.historyIndex + 1} / {undoRedo.history.length}
            </span>
          </div>
          
          <div className="text-xs text-gray-500 flex space-x-4">
            <span>Ctrl+Z/Y: Undo/Redo</span>
            <span>M: Multi-select</span>
            <span>Esc: Deselect</span>
            <span>Del: Delete</span>
          </div>
        </div>
      )}
      
      {/* Waypoint Editing Controls - Hide in read-only mode */}
      {!isReadOnly && <waypoints.WaypointEditingControls />}
      
      {/* Map Container */}
      <div className="relative h-[600px]" ref={mapContainerRef}>
        {/* Map Legend - Shows on map for reports */}
          <MapLegend 
            nodeTypes={mapState.nodeTypes}
            showNodes={mapState.showNodes}
            showLines={mapState.showLines}
            showObservations={mapState.showObservations}
            position="top-left"
            isCompact={false}
          />
        <MapContainer
          ref={mapRef}
          center={mapState.mapData?.center_lat ? [mapState.mapData.center_lat, mapState.mapData.center_lng] : DEFAULT_CENTER}
          zoom={mapState.mapData?.default_zoom || DEFAULT_ZOOM}
          className={getMapContainerClasses()}
          style={{ cursor: isReadOnly ? 'default' : modeManager.getCursorStyle() }}
          whenReady={(mapEvent) => {
            console.log("🎯 Map is ready!", mapEvent)
            mapInstanceRef.current = mapEvent.target
          }}
          minZoom={2}
          maxZoom={22}
          maxBounds={null} 
        >
          {/* Background Layer */}
          <DrawingBackgroundManager
            backgroundType={backgroundType}
            referenceImageUrl={backgroundType === 'blank' ? referenceImageUrl : null}
            referenceImageOpacity={referenceImageOpacity}
            blankCanvasColor="#f8f9fa"
            mapOpacity={mapOpacity}
          />
          

          {/* Map Click Handler - Only if not read-only */}
          {!isReadOnly && <MapEventsComponentWithMode />}
          
          {/* Drawings Layer */}
          <DrawingsLayer
            drawings={contextDrawings}
            showDrawings={mapState.showDrawings}
            onDrawingsUpdate={enhancedDrawingHandlers.handleDrawingsUpdate}
            selectedDrawing={selectedDrawing}
            selectedDrawings={selectedDrawings}
            onDrawingSelect={handleDrawingSelect}
            multiSelectMode={multiSelectMode}
            mode={isReadOnly ? 'view' : modeManager.mode}
            visible={true}
            onTransformUpdate={handleTransformUpdate}
            drawingContext={backgroundType === 'blank' ? 'canvas' : 'map'}
          />
          
          {/* Lines Layer */}
          <LinesLayer
            lines={contextLines}
            nodes={contextNodes}
            sections={sections}
            observations={observations}
            showLines={mapState.showLines}
            showLabels={mapState.showLabels}
            editingWaypoints={waypoints.editingWaypoints}
            setEditingWaypoints={waypoints.setEditingWaypoints}
            onLineClick={isReadOnly ? null : waypoints.lineHandlers.handleLineClick}
            onWaypointDelete={isReadOnly ? null : waypoints.lineHandlers.handleWaypointDelete}
            visible={true}
          />
          
          {/* Nodes Layer */}
          <NodesLayer
            nodes={contextNodes}
            nodeTypes={mapState.nodeTypes}
            showNodes={mapState.showNodes}
            showLabels={mapState.showLabels}
            mode={isReadOnly ? 'view' : modeManager.mode}
            editingWaypoints={waypoints.editingWaypoints}
            onNodeClick={isReadOnly ? null : handleNodeClickWrapper}
            onNodeDragEnd={isReadOnly ? null : nodeHandlers.handleNodeDragEnd} 
            getNodeType={mapState.getNodeType}
            visible={true}
          />
          
          {/* Observations Layer */}
          <ObservationsLayer
            lines={contextLines}
            nodes={contextNodes}
            observations={observations}
            showObservations={mapState.showObservations}
            editingWaypoints={waypoints.editingWaypoints}
            onJumpToVideo={onJumpToVideo}
            visible={true}
            drawingContext={backgroundType === 'blank' ? 'canvas' : 'map'}
          />
        </MapContainer>
        
        {/* Capture Mode UI */}
        {isCaptureMode && (
          <div 
            id="capture-ui"
            className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4 max-w-sm"
          >
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              Capture Map Snapshot
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Position the map as desired, then click capture to create a snapshot for your report.
            </p>
            
            {captureState.captureError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                Error: {captureState.captureError}
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={captureMapSnapshot}
                disabled={captureState.isCapturing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {captureState.isCapturing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Capturing...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Capture Snapshot
                  </>
                )}
              </button>
              <button
                onClick={() => window.close()}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Map Stats */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex space-x-4">
            <span>{contextNodes.length} nodes</span>
            <span>{contextLines.length} lines</span>
            <span className="text-green-600">{contextLines.filter(l => l.section).length} linked to sections</span>
            <span>{observations.length} observations</span>
            <span className="text-purple-600">{contextDrawings.length} drawings</span>
            {selectedDrawing && !isReadOnly && (
              <span className="text-green-600 font-medium">• 1 selected (Transform mode)</span>
            )}
            {selectedDrawings.length > 0 && !isReadOnly && (
              <span className="text-purple-600">• {selectedDrawings.length} multi-selected</span>
            )}
            <span className="text-blue-600">
              Context: {currentContext === 'canvas' ? 'Drawing Canvas' : 'Map Mode'}
            </span>
          </div>
          <div className="flex space-x-2">
            <span className="text-xs">
              {isReadOnly ? (isCaptureMode ? 'Capture Mode' : 'Read-Only Mode') : modeManager.getStatusText()}
            </span>
            {multiSelectMode && !isReadOnly && (
              <span className="text-xs text-purple-600 font-medium">
                Multi-Select Mode
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Node Edit Modal - Hide in read-only mode */}
      {!isReadOnly && (
        <>
          <NodeEditModal
            node={mapState.editingNode}
            onUpdate={nodeHandlers.handleNodeModalUpdate}
            onDelete={nodeHandlers.handleNodeDelete}
            onClose={() => {
              mapState.setSelectedNode(null)
              mapState.setEditingNode(null)
            }}
          />

          {/* Custom Node Types Modal */}
          <NodeTypesModal
            isOpen={mapState.showNodeTypesModal}
            onClose={() => mapState.setShowNodeTypesModal(false)}
            onNodeTypesUpdate={mapState.handleNodeTypesUpdate}
          />
        </>
      )}
    </div>
  )
})

export default ProjectMap