// components/ProjectMap/handlers/drawingHandlers.js

import { 
  createMapDrawing, 
  updateMapDrawing, 
  deleteMapDrawing 
} from '@/lib/maps'
import { ACTION_TYPES } from '../hooks/constants'

/**
 * Factory function that creates drawing-related event handlers
 * @param {Object} dependencies - All the dependencies needed by the handlers
 * @returns {Object} Object containing all drawing handler functions
 */
export const createDrawingHandlers = ({
  mapState,
  undoRedo,
  drawingToolsRef
}) => {
  
  /**
   * Handle drawing click - delegate to drawing tools
   */
  const handleDrawingClick = (latlng) => {
    if (drawingToolsRef.current && drawingToolsRef.current.startDrawing) {
      drawingToolsRef.current.startDrawing(latlng)
    }
  }

  /**
   * Handle drawing mouse move - delegate to drawing tools
   */
  const handleDrawingMouseMove = (latlng) => {
    if (drawingToolsRef.current && drawingToolsRef.current.updateDrawing) {
      drawingToolsRef.current.updateDrawing(latlng)
    }
  }

  /**
   * Handle drawing double click - delegate to drawing tools  
   */
  const handleDrawingDoubleClick = (latlng) => {
    if (drawingToolsRef.current && drawingToolsRef.current.handleDoubleClick) {
      drawingToolsRef.current.handleDoubleClick()
    }
  }

  /**
   * Handle drawing operations (create, update, delete)
   */
  const handleDrawingsUpdate = async (operation, drawingData) => {
    try {
      switch (operation) {
        case 'create':
          const newDrawing = await createMapDrawing(drawingData)
          mapState.setDrawings(prev => [...prev, newDrawing])
          undoRedo.addToHistory({
            type: ACTION_TYPES.CREATE_DRAWING,
            data: { drawing: newDrawing }
          })
          break
          
        case 'update':
          const { id, ...updates } = drawingData
          const updatedDrawing = await updateMapDrawing(id, updates)
          mapState.setDrawings(prev => prev.map(d => d.id === id ? updatedDrawing : d))
          
          const originalDrawing = mapState.drawings.find(d => d.id === id)
          undoRedo.addToHistory({
            type: ACTION_TYPES.UPDATE_DRAWING,
            data: { 
              drawingId: id, 
              previousState: originalDrawing,
              newState: updates
            }
          })
          break
          
        case 'delete':
          const drawingToDelete = mapState.drawings.find(d => d.id === drawingData.id)
          await deleteMapDrawing(drawingData.id)
          mapState.setDrawings(prev => prev.filter(d => d.id !== drawingData.id))
          
          undoRedo.addToHistory({
            type: ACTION_TYPES.DELETE_DRAWING,
            data: { drawing: drawingToDelete }
          })
          break
          
        default:
          throw new Error(`Unknown drawing operation: ${operation}`)
      }
    } catch (error) {
      console.error('Error handling drawing operation:', error)
      throw error
    }
  }

  // Return all handler functions
  return {
    handleDrawingClick,
    handleDrawingMouseMove,
    handleDrawingDoubleClick,
    handleDrawingsUpdate
  }
}