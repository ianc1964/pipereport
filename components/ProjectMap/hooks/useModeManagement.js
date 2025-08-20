// components/ProjectMap/hooks/useModeManagement.js

import { useState, useCallback, useMemo, useEffect } from 'react'
import { MAP_MODES } from './constants'

/**
 * Custom hook for managing map interaction modes and related UI logic
 * @param {Object} dependencies - Dependencies needed for mode management
 * @returns {Object} Mode state, controls, and UI helpers
 */
export const useModeManagement = ({ 
  mapState, 
  waypointsHook 
}) => {
  
  // Mode state
  const [mode, setMode] = useState(MAP_MODES.VIEW)
  
  /**
   * Get the appropriate cursor style for the current mode
   */
  const getCursorStyle = useCallback(() => {
    switch (mode) {
      case MAP_MODES.ADD_NODE:
      case MAP_MODES.DRAWING:
        return 'crosshair'
      default:
        return 'grab'
    }
  }, [mode])
  
  /**
   * Get status text for the current mode and state
   */
  const getStatusText = useCallback(() => {
    // Priority order: waypoints > drawing > mode-specific
    if (waypointsHook.isEditingWaypoints()) {
      return waypointsHook.getWaypointStatusText()
    }
    
    switch (mode) {
      case MAP_MODES.DRAWING:
        return 'Drawing mode active - select a drawing tool and click on the map'
      case MAP_MODES.ADD_NODE:
        return 'Click on map to add node'
      case MAP_MODES.DRAW_LINE:
        return 'Click nodes to connect'
      case MAP_MODES.VIEW:
      default:
        return 'Click elements for details • Drag nodes to reposition'
    }
  }, [mode, waypointsHook])
  
  /**
   * Safe mode transition with validation
   */
  const changeMode = useCallback((newMode) => {
    console.log(`🔄 Mode changing from "${mode}" to "${newMode}"`) // 🔍 DEBUG
    
    // Validate mode exists
    const validModes = Object.values(MAP_MODES)
    if (!validModes.includes(newMode)) {
      console.warn(`Invalid mode: ${newMode}. Valid modes:`, validModes)
      return false
    }
    
    // Handle mode-specific cleanup
    switch (mode) {
      case MAP_MODES.DRAW_LINE:
        // Clear any active line drawing state
        if (mapState.drawingLine) {
          mapState.setDrawingLine(null)
        }
        if (mapState.selectedSectionId) {
          mapState.setSelectedSectionId(null)
        }
        break
        
      case MAP_MODES.ADD_NODE:
        // Clear selected node type when leaving add node mode
        if (mapState.selectedNodeType && newMode !== MAP_MODES.ADD_NODE) {
          // Keep node type selected for potential return to add mode
        }
        break
        
      case MAP_MODES.DRAWING:
        // Drawing mode cleanup handled by drawing tools
        break
        
      default:
        break
    }
    
    // Set the new mode
    setMode(newMode)
    console.log(`✅ Mode changed to "${newMode}"`) // 🔍 DEBUG
    return true
  }, [mode, mapState])
  
  /**
   * Quick mode checks
   */
  const isViewMode = useMemo(() => mode === MAP_MODES.VIEW, [mode])
  const isAddNodeMode = useMemo(() => mode === MAP_MODES.ADD_NODE, [mode])
  const isDrawLineMode = useMemo(() => mode === MAP_MODES.DRAW_LINE, [mode])
  const isDrawingMode = useMemo(() => mode === MAP_MODES.DRAWING, [mode])
  
  /**
   * Mode-specific event handling
   */
  const handleModeSpecificMapClick = useCallback((latlng, handlers) => {
    console.log(`🎯 handleModeSpecificMapClick called - Mode: "${mode}", LatLng:`, latlng) // 🔍 DEBUG
    
    switch (mode) {
      case MAP_MODES.ADD_NODE:
        console.log('🔍 Routing to nodeHandlers.handleMapClick') // 🔍 DEBUG
        return handlers.nodeHandlers.handleMapClick(latlng)
        
      case MAP_MODES.DRAWING:
        console.log('🔍 Routing to drawingHandlers.handleDrawingClick') // 🔍 DEBUG
        // 🎯 CRITICAL: Call drawing handler and prevent default map behavior
        if (handlers.drawingHandlers) {
          console.log('✅ Calling drawingHandlers.handleDrawingClick') // 🔍 DEBUG
          handlers.drawingHandlers.handleDrawingClick(latlng)
          return true // Indicate event was handled
        } else {
          console.log('❌ No drawingHandlers found!') // 🔍 DEBUG
        }
        return false
        
      default:
        console.log(`🔍 No handler for mode: "${mode}"`) // 🔍 DEBUG
        // No action for other modes on map click
        return false
    }
  }, [mode])
  
  const handleModeSpecificMouseMove = useCallback((latlng, handlers) => {
    switch (mode) {
      case MAP_MODES.DRAWING:
        if (handlers.drawingHandlers) {
          handlers.drawingHandlers.handleDrawingMouseMove(latlng)
          return true // Indicate event was handled
        }
        return false
        
      default:
        // No action for other modes on mouse move
        return false
    }
  }, [mode])
  
  const handleModeSpecificDoubleClick = useCallback((latlng, handlers) => {
    switch (mode) {
      case MAP_MODES.DRAWING:
        if (handlers.drawingHandlers) {
          handlers.drawingHandlers.handleDrawingDoubleClick(latlng)
          return true // Indicate event was handled
        }
        return false
        
      default:
        // No action for other modes on double click
        return false
    }
  }, [mode])
  
  /**
   * Enhanced Map Events Component with mode-specific handling and map interaction control
   */
  const MapEventsComponent = ({ handlers }) => {
    if (typeof window === 'undefined') return null
    const { useMapEvents } = require('react-leaflet')
    
    // 🔍 DEBUG: Log when MapEventsComponent renders
    console.log(`🗺️ MapEventsComponent rendered with mode: "${mode}"`, { handlers })
    
    const map = useMapEvents({
      click: (e) => {
        console.log(`🖱️ Map click detected - Current mode: "${mode}"`) // 🔍 DEBUG
        
        // 🎯 CRITICAL FIX: Prevent default map behavior in drawing mode
        const handled = handleModeSpecificMapClick(e.latlng, handlers)
        console.log(`🔍 Click handled: ${handled}`) // 🔍 DEBUG
        
        if (handled && mode === MAP_MODES.DRAWING) {
          console.log('🚫 Preventing default map behavior') // 🔍 DEBUG
          e.originalEvent?.preventDefault()
          e.originalEvent?.stopPropagation()
        }
      },
      
      mousemove: (e) => {
        const handled = handleModeSpecificMouseMove(e.latlng, handlers)
        if (handled && mode === MAP_MODES.DRAWING) {
          e.originalEvent?.preventDefault()
          e.originalEvent?.stopPropagation()
        }
      },
      
      dblclick: (e) => {
        const handled = handleModeSpecificDoubleClick(e.latlng, handlers)
        if (handled && mode === MAP_MODES.DRAWING) {
          e.originalEvent?.preventDefault()
          e.originalEvent?.stopPropagation()
        }
      },
      
      // 🎯 NEW: Disable map dragging in drawing and add node modes
      dragstart: (e) => {
        if (mode === MAP_MODES.DRAWING || mode === MAP_MODES.ADD_NODE) {
          e.originalEvent?.preventDefault()
          e.originalEvent?.stopPropagation()
          return false
        }
      },
      
      drag: (e) => {
        if (mode === MAP_MODES.DRAWING || mode === MAP_MODES.ADD_NODE) {
          e.originalEvent?.preventDefault()
          e.originalEvent?.stopPropagation()
          return false
        }
      },
      
      // 🎯 NEW: Handle mousedown to prevent map panning in drawing mode
      mousedown: (e) => {
        if (mode === MAP_MODES.DRAWING || mode === MAP_MODES.ADD_NODE) {
          // Disable map dragging by preventing the default behavior
          if (e.originalEvent) {
            e.originalEvent.preventDefault()
          }
        }
      }
    })
    
    // 🎯 NEW: Effect to control map dragging based on mode
    useEffect(() => {
      if (!map) return
      
      console.log(`🗺️ Map interaction effect - Mode: "${mode}"`) // 🔍 DEBUG
      
      if (mode === MAP_MODES.DRAWING || mode === MAP_MODES.ADD_NODE) {
        console.log('🚫 Disabling map interactions') // 🔍 DEBUG
        // Disable map dragging and double click zoom
        map.dragging.disable()
        map.doubleClickZoom.disable()
        map.scrollWheelZoom.disable()
        map.boxZoom.disable()
        map.keyboard.disable()
        
        // Add a class to the map container for CSS styling
        const container = map.getContainer()
        container.classList.add('drawing-mode-active')
      } else {
        console.log('✅ Enabling map interactions') // 🔍 DEBUG
        // Re-enable map interactions
        map.dragging.enable()
        map.doubleClickZoom.enable() 
        map.scrollWheelZoom.enable()
        map.boxZoom.enable()
        map.keyboard.enable()
        
        // Remove the drawing mode class
        const container = map.getContainer()
        container.classList.remove('drawing-mode-active')
      }
      
      // Cleanup function
      return () => {
        if (map && !map._removed) {
          try {
            // Ensure map interactions are restored
            map.dragging.enable()
            map.doubleClickZoom.enable()
            map.scrollWheelZoom.enable()
            map.boxZoom.enable()
            map.keyboard.enable()
            
            const container = map.getContainer()
            if (container) {
              container.classList.remove('drawing-mode-active')
            }
          } catch (error) {
            console.warn('Error cleaning up map interactions:', error)
          }
        }
      }
    }, [map, mode])
    
    return null
  }
  
  /**
   * Mode-specific validation
   */
  const canEnterMode = useCallback((targetMode) => {
    switch (targetMode) {
      case MAP_MODES.ADD_NODE:
        // Can only add nodes if a node type is selected
        return mapState.selectedNodeType !== null
        
      case MAP_MODES.DRAW_LINE:
        // Can draw lines if there are nodes available
        return mapState.nodes.length >= 2
        
      case MAP_MODES.DRAWING:
        // Drawing mode always available
        return true
        
      case MAP_MODES.VIEW:
        // View mode always available
        return true
        
      default:
        return false
    }
  }, [mapState.selectedNodeType, mapState.nodes.length])
  
  /**
   * Get mode-specific instructions for UI
   */
  const getModeInstructions = useCallback(() => {
    switch (mode) {
      case MAP_MODES.ADD_NODE:
        return mapState.selectedNodeType 
          ? "Click anywhere on the map to place a new node"
          : "Select a node type first"
          
      case MAP_MODES.DRAW_LINE:
        return mapState.drawingLine 
          ? "Click on another node to complete the line"
          : "Click on a node to start drawing a line"
          
      case MAP_MODES.DRAWING:
        return "Select a drawing tool, then click on the map to start drawing"
        
      case MAP_MODES.VIEW:
      default:
        return "Click on map elements to view details and edit properties"
    }
  }, [mode, mapState.selectedNodeType, mapState.drawingLine])
  
  return {
    // Mode state
    mode,
    setMode: changeMode, // Use the enhanced version
    
    // Mode checks
    isViewMode,
    isAddNodeMode,
    isDrawLineMode,
    isDrawingMode,
    
    // UI helpers
    getCursorStyle,
    getStatusText,
    getModeInstructions,
    
    // Validation
    canEnterMode,
    
    // Event handling
    handleModeSpecificMapClick,
    handleModeSpecificMouseMove,
    handleModeSpecificDoubleClick,
    
    // Components
    MapEventsComponent,
    
    // Constants for external use
    MODES: MAP_MODES
  }
}