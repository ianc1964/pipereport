// components/ProjectMap/handlers/lineHandlers.js

import { updateMapLine } from '@/lib/maps'
import { ACTION_TYPES } from '../hooks/constants'

/**
 * Factory function that creates line-related event handlers
 * @param {Object} dependencies - All the dependencies needed by the handlers
 * @returns {Object} Object containing all line handler functions
 */
export const createLineHandlers = ({
  mapState,
  undoRedo
}) => {
  
  /**
   * Handle line click - start editing waypoints
   */
  const handleLineClick = (line, event) => {
    const latlng = event.latlng
    const currentWaypoints = line.waypoints || []
    
    // Calculate insertion point for new waypoint (simplified logic)
    const newWaypoints = [...currentWaypoints]
    newWaypoints.push([latlng.lat, latlng.lng])
    
    mapState.setEditingWaypoints({
      lineId: line.id,
      waypoints: newWaypoints,
      originalWaypoints: currentWaypoints
    })
  }
  
  /**
   * Handle waypoint delete
   */
  const handleWaypointDelete = (lineId, waypointIndex) => {
    if (!mapState.editingWaypoints || mapState.editingWaypoints.lineId !== lineId) return
    
    const newWaypoints = mapState.editingWaypoints.waypoints.filter((_, index) => index !== waypointIndex)
    
    mapState.setEditingWaypoints({
      ...mapState.editingWaypoints,
      waypoints: newWaypoints
    })
  }
  
  /**
   * Save waypoints to database
   */
  const saveWaypoints = async () => {
    if (!mapState.editingWaypoints) return
    
    try {
      await updateMapLine(mapState.editingWaypoints.lineId, {
        waypoints: mapState.editingWaypoints.waypoints
      })
      
      mapState.setLines(mapState.lines.map(line => 
        line.id === mapState.editingWaypoints.lineId 
          ? { ...line, waypoints: mapState.editingWaypoints.waypoints }
          : line
      ))
      
      undoRedo.addToHistory({
        type: ACTION_TYPES.UPDATE_WAYPOINTS,
        data: {
          lineId: mapState.editingWaypoints.lineId,
          previousWaypoints: mapState.editingWaypoints.originalWaypoints,
          newWaypoints: mapState.editingWaypoints.waypoints
        }
      })
      
      mapState.setEditingWaypoints(null)
      alert('Waypoints saved successfully!')
    } catch (error) {
      console.error('Error saving waypoints:', error)
      alert('Failed to save waypoints')
    }
  }
  
  /**
   * Cancel waypoint editing
   */
  const cancelWaypointEdit = () => {
    mapState.setEditingWaypoints(null)
  }

  // Return all handler functions
  return {
    handleLineClick,
    handleWaypointDelete,
    saveWaypoints,
    cancelWaypointEdit
  }
}