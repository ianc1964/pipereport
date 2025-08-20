'use client'
import { useState, useCallback, useEffect } from 'react'
import { 
  createMapNode, updateMapNode, deleteMapNode,
  createMapLine, updateMapLine, deleteMapLine,
  createMapDrawing, updateMapDrawing, deleteMapDrawing,
  updateProjectMap, getMapNodes
} from '@/lib/maps'

// Action types for undo/redo
export const ACTION_TYPES = {
  CREATE_NODE: 'CREATE_NODE',
  DELETE_NODE: 'DELETE_NODE',
  UPDATE_NODE: 'UPDATE_NODE',
  MOVE_NODE: 'MOVE_NODE',
  CREATE_LINE: 'CREATE_LINE',
  DELETE_LINE: 'DELETE_LINE',
  UPDATE_WAYPOINTS: 'UPDATE_WAYPOINTS',
  UPLOAD_BACKGROUND: 'UPLOAD_BACKGROUND',
  CREATE_DRAWING: 'CREATE_DRAWING',
  DELETE_DRAWING: 'DELETE_DRAWING',
  UPDATE_DRAWING: 'UPDATE_DRAWING'
}

// Maximum history size to prevent memory issues
const MAX_HISTORY_SIZE = 50

/**
 * Custom hook for managing undo/redo functionality
 * Handles: history tracking, undo/redo operations, keyboard shortcuts
 */
export const useUndoRedo = (projectId, mapData, setNodes, setLines, setDrawings, setMapData) => {
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isUndoingRedoing, setIsUndoingRedoing] = useState(false)
  
  // Helper functions for undo/redo
  const canUndo = historyIndex >= 0
  const canRedo = historyIndex < history.length - 1
  
  // Add action to history
  const addToHistory = useCallback((action) => {
    if (isUndoingRedoing) return // Don't add to history during undo/redo
    
    setHistory(prev => {
      // Remove any actions after current index (clear redo stack)
      const newHistory = prev.slice(0, historyIndex + 1)
      
      // Add new action
      newHistory.push(action)
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift()
        setHistoryIndex(newHistory.length - 1)
      } else {
        setHistoryIndex(newHistory.length - 1)
      }
      
      return newHistory
    })
  }, [historyIndex, isUndoingRedoing])
  
  // Undo action
  const undo = useCallback(async () => {
    if (!canUndo || isUndoingRedoing) return
    
    setIsUndoingRedoing(true)
    const action = history[historyIndex]
    
    try {
      switch (action.type) {
        case ACTION_TYPES.CREATE_NODE:
          // Delete the created node
          await deleteMapNode(action.data.node.id)
          setNodes(prev => prev.filter(n => n.id !== action.data.node.id))
          break
          
        case ACTION_TYPES.DELETE_NODE:
          // Recreate the deleted node
          const recreatedNode = await createMapNode({
            project_id: projectId,
            node_type_id: action.data.node.node_type_id,
            node_ref: action.data.node.node_ref,
            name: action.data.node.name,
            description: action.data.node.description,
            lat: action.data.node.lat,
            lng: action.data.node.lng,
            cover_level: action.data.node.cover_level,
            invert_level: action.data.node.invert_level
          })
          setNodes(prev => [...prev, recreatedNode])
          
          // Recreate any deleted lines
          if (action.data.deletedLines) {
            for (const line of action.data.deletedLines) {
              const recreatedLine = await createMapLine({
                project_id: projectId,
                start_node_id: line.start_node_id === action.data.node.id ? recreatedNode.id : line.start_node_id,
                end_node_id: line.end_node_id === action.data.node.id ? recreatedNode.id : line.end_node_id,
                line_type: line.line_type,
                section_id: line.section_id,
                waypoints: line.waypoints
              })
              setLines(prev => [...prev, recreatedLine])
            }
          }
          break
          
        case ACTION_TYPES.UPDATE_NODE:
          // Revert to previous state
          const revertedNode = await updateMapNode(action.data.nodeId, action.data.previousState)
          setNodes(prev => prev.map(n => n.id === action.data.nodeId ? revertedNode : n))
          break
          
        case ACTION_TYPES.MOVE_NODE:
          // Move back to previous position
          await updateMapNode(action.data.nodeId, {
            lat: action.data.previousPosition.lat,
            lng: action.data.previousPosition.lng
          })
          setNodes(prev => prev.map(n => 
            n.id === action.data.nodeId 
              ? { ...n, lat: action.data.previousPosition.lat, lng: action.data.previousPosition.lng }
              : n
          ))
          break
          
        case ACTION_TYPES.CREATE_LINE:
          // Delete the created line
          await deleteMapLine(action.data.line.id)
          setLines(prev => prev.filter(l => l.id !== action.data.line.id))
          
          // Revert node updates if any
          if (action.data.nodeUpdates) {
            for (const update of action.data.nodeUpdates) {
              const revertedNode = await updateMapNode(update.nodeId, update.previousState)
              setNodes(prev => prev.map(n => n.id === update.nodeId ? revertedNode : n))
            }
          }
          break
          
        case ACTION_TYPES.UPDATE_WAYPOINTS:
          // Revert waypoints to previous state
          await updateMapLine(action.data.lineId, {
            waypoints: action.data.previousWaypoints
          })
          setLines(prev => prev.map(line => 
            line.id === action.data.lineId 
              ? { ...line, waypoints: action.data.previousWaypoints }
              : line
          ))
          break
          
        case ACTION_TYPES.UPLOAD_BACKGROUND:
          // Revert to previous background
          const revertedMap = await updateProjectMap(mapData.id, {
            background_type: action.data.previousBackground.type,
            background_image_url: action.data.previousBackground.url
          })
          setMapData(revertedMap)
          break

        case ACTION_TYPES.CREATE_DRAWING:
          // Delete the created drawing
          await deleteMapDrawing(action.data.drawing.id)
          setDrawings(prev => prev.filter(d => d.id !== action.data.drawing.id))
          break

        case ACTION_TYPES.DELETE_DRAWING:
          // Recreate the deleted drawing
          const recreatedDrawing = await createMapDrawing(action.data.drawing)
          setDrawings(prev => [...prev, recreatedDrawing])
          break

        case ACTION_TYPES.UPDATE_DRAWING:
          // Revert to previous state
          const revertedDrawing = await updateMapDrawing(action.data.drawingId, action.data.previousState)
          setDrawings(prev => prev.map(d => d.id === action.data.drawingId ? revertedDrawing : d))
          break
      }
      
      setHistoryIndex(prev => prev - 1)
    } catch (error) {
      console.error('Error during undo:', error)
      alert('Failed to undo action')
    } finally {
      setIsUndoingRedoing(false)
    }
  }, [canUndo, history, historyIndex, isUndoingRedoing, mapData, projectId, setNodes, setLines, setDrawings, setMapData])
  
  // Redo action
  const redo = useCallback(async () => {
    if (!canRedo || isUndoingRedoing) return
    
    setIsUndoingRedoing(true)
    const action = history[historyIndex + 1]
    
    try {
      switch (action.type) {
        case ACTION_TYPES.CREATE_NODE:
          // Recreate the node
          const recreatedNode = await createMapNode({
            project_id: projectId,
            node_type_id: action.data.node.node_type_id,
            node_ref: action.data.node.node_ref,
            name: action.data.node.name,
            lat: action.data.node.lat,
            lng: action.data.node.lng
          })
          setNodes(prev => [...prev, recreatedNode])
          break
          
        case ACTION_TYPES.DELETE_NODE:
          // Delete the node again
          await deleteMapNode(action.data.node.id)
          setNodes(prev => prev.filter(n => n.id !== action.data.node.id))
          setLines(prev => prev.filter(l => 
            l.start_node_id !== action.data.node.id && l.end_node_id !== action.data.node.id
          ))
          break
          
        case ACTION_TYPES.UPDATE_NODE:
          // Apply the update again
          const updatedNode = await updateMapNode(action.data.nodeId, action.data.newState)
          setNodes(prev => prev.map(n => n.id === action.data.nodeId ? updatedNode : n))
          break
          
        case ACTION_TYPES.MOVE_NODE:
          // Move to new position again
          await updateMapNode(action.data.nodeId, {
            lat: action.data.newPosition.lat,
            lng: action.data.newPosition.lng
          })
          setNodes(prev => prev.map(n => 
            n.id === action.data.nodeId 
              ? { ...n, lat: action.data.newPosition.lat, lng: action.data.newPosition.lng }
              : n
          ))
          break
          
        case ACTION_TYPES.CREATE_LINE:
          // Recreate the line
          const recreatedLine = await createMapLine(action.data.lineData)
          setLines(prev => [...prev, recreatedLine])
          
          // Reapply node updates if any
          if (action.data.nodeUpdates) {
            for (const update of action.data.nodeUpdates) {
              const updatedNode = await updateMapNode(update.nodeId, update.newState)
              setNodes(prev => prev.map(n => n.id === update.nodeId ? updatedNode : n))
            }
          }
          break
          
        case ACTION_TYPES.UPDATE_WAYPOINTS:
          // Apply waypoints update again
          await updateMapLine(action.data.lineId, {
            waypoints: action.data.newWaypoints
          })
          setLines(prev => prev.map(line => 
            line.id === action.data.lineId 
              ? { ...line, waypoints: action.data.newWaypoints }
              : line
          ))
          break
          
        case ACTION_TYPES.UPLOAD_BACKGROUND:
          // Apply background update again
          const updatedMap = await updateProjectMap(mapData.id, {
            background_type: 'image',
            background_image_url: action.data.newBackground.url
          })
          setMapData(updatedMap)
          break

        case ACTION_TYPES.CREATE_DRAWING:
          // Recreate the drawing
          const recreatedDrawing = await createMapDrawing(action.data.drawing)
          setDrawings(prev => [...prev, recreatedDrawing])
          break

        case ACTION_TYPES.DELETE_DRAWING:
          // Delete the drawing again
          await deleteMapDrawing(action.data.drawing.id)
          setDrawings(prev => prev.filter(d => d.id !== action.data.drawing.id))
          break

        case ACTION_TYPES.UPDATE_DRAWING:
          // Apply the update again
          const updatedDrawing = await updateMapDrawing(action.data.drawingId, action.data.newState)
          setDrawings(prev => prev.map(d => d.id === action.data.drawingId ? updatedDrawing : d))
          break
      }
      
      setHistoryIndex(prev => prev + 1)
    } catch (error) {
      console.error('Error during redo:', error)
      alert('Failed to redo action')
    } finally {
      setIsUndoingRedoing(false)
    }
  }, [canRedo, history, historyIndex, isUndoingRedoing, mapData, projectId, setNodes, setLines, setDrawings, setMapData])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return {
    // State
    history,
    historyIndex,
    canUndo,
    canRedo,
    isUndoingRedoing,
    
    // Functions
    addToHistory,
    undo,
    redo
  }
}