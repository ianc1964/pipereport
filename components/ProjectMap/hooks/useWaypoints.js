// components/ProjectMap/hooks/useWaypoints.js

import { useState, useCallback } from 'react'

/**
 * Custom hook for managing waypoint editing state and UI logic
 * @param {Object} lineHandlers - Line handlers for waypoint operations
 * @returns {Object} Waypoint state, UI helpers, and control components
 */
export const useWaypoints = (lineHandlers) => {
  // Waypoint editing state
  const [editingWaypoints, setEditingWaypoints] = useState(null)
  
  /**
   * Check if waypoint editing is currently active
   */
  const isEditingWaypoints = useCallback(() => {
    return editingWaypoints !== null
  }, [editingWaypoints])
  
  /**
   * Get waypoint editing status text for map stats
   */
  const getWaypointStatusText = useCallback(() => {
    if (!editingWaypoints) return null
    return 'Waypoint positions update after dragging • Remember to save changes!'
  }, [editingWaypoints])
  
  /**
   * Start waypoint editing for a line
   */
  const startWaypointEdit = useCallback((lineId, waypoints, originalWaypoints) => {
    setEditingWaypoints({
      lineId,
      waypoints,
      originalWaypoints
    })
  }, [])
  
  /**
   * Cancel waypoint editing
   */
  const cancelWaypointEdit = useCallback(() => {
    setEditingWaypoints(null)
  }, [])
  
  /**
   * Handle waypoint save completion
   */
  const onWaypointsSaved = useCallback(() => {
    setEditingWaypoints(null)
  }, [])
  
  /**
   * Update waypoints during editing (for real-time updates)
   */
  const updateEditingWaypoints = useCallback((updates) => {
    if (!editingWaypoints) return
    
    setEditingWaypoints(prev => ({
      ...prev,
      ...updates
    }))
  }, [editingWaypoints])
  
  /**
   * Enhanced line handlers with waypoint state integration
   */
  const enhancedLineHandlers = {
    ...lineHandlers,
    handleLineClick: (line, event) => {
      // Call original handler
      const result = lineHandlers.handleLineClick(line, event)
      
      // Update local waypoint state
      const latlng = event.latlng
      const currentWaypoints = line.waypoints || []
      const newWaypoints = [...currentWaypoints]
      newWaypoints.push([latlng.lat, latlng.lng])
      
      setEditingWaypoints({
        lineId: line.id,
        waypoints: newWaypoints,
        originalWaypoints: currentWaypoints
      })
      
      return result
    },
    
    handleWaypointDelete: (lineId, waypointIndex) => {
      // Call original handler
      const result = lineHandlers.handleWaypointDelete(lineId, waypointIndex)
      
      // Update local state
      if (editingWaypoints && editingWaypoints.lineId === lineId) {
        const newWaypoints = editingWaypoints.waypoints.filter((_, index) => index !== waypointIndex)
        setEditingWaypoints({
          ...editingWaypoints,
          waypoints: newWaypoints
        })
      }
      
      return result
    },
    
    saveWaypoints: async () => {
      try {
        const result = await lineHandlers.saveWaypoints()
        setEditingWaypoints(null) // Clear editing state on successful save
        return result
      } catch (error) {
        throw error // Re-throw for error handling in UI
      }
    },
    
    cancelWaypointEdit: () => {
      setEditingWaypoints(null)
      return lineHandlers.cancelWaypointEdit()
    }
  }
  
  /**
   * Waypoint Editing Controls Component
   * This extracts the waypoint editing UI from the main component
   */
  const WaypointEditingControls = () => {
    if (!editingWaypoints) return null
    
    return (
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-blue-700 font-medium">Editing waypoints</span>
          <span className="text-blue-600">• Click line to add waypoint</span>
          <span className="text-blue-600">• Drag waypoints to adjust</span>
          <span className="text-blue-600">• Right-click waypoint to delete</span>
          <span className="text-orange-600 font-medium">• Changes are not saved until you click "Save Waypoints"</span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={enhancedLineHandlers.cancelWaypointEdit}
            className="px-3 py-1 text-sm bg-white text-gray-600 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={enhancedLineHandlers.saveWaypoints}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium animate-pulse"
          >
            Save Waypoints
          </button>
        </div>
      </div>
    )
  }
  
  return {
    // State
    editingWaypoints,
    setEditingWaypoints,
    
    // Status helpers
    isEditingWaypoints,
    getWaypointStatusText,
    
    // Control functions
    startWaypointEdit,
    cancelWaypointEdit,
    onWaypointsSaved,
    updateEditingWaypoints,
    
    // Enhanced handlers
    lineHandlers: enhancedLineHandlers,
    
    // UI Components
    WaypointEditingControls
  }
}