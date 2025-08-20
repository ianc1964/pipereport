// components/ProjectMap/handlers/nodeHandlers.js

import { 
  createMapNode, 
  updateMapNode, 
  deleteMapNode, 
  generateNodeRef,
  getMapNodes 
} from '@/lib/maps'
import { ACTION_TYPES } from '../hooks/constants'

/**
 * Factory function that creates node-related event handlers
 * @param {Object} dependencies - All the dependencies needed by the handlers
 * @returns {Object} Object containing all node handler functions
 */
export const createNodeHandlers = ({
  projectId,
  sections,
  mapState,
  undoRedo,
  setMode
}) => {
  
  /**
   * Handle map click for adding nodes
   */
  const handleMapClick = async (latlng) => {
    if (!mapState.selectedNodeType) return
    
    try {
      const existingRefs = mapState.nodes.map(n => n.node_ref)
      const nodeRef = generateNodeRef('MH', existingRefs)
      
      const newNode = await createMapNode({
        project_id: projectId,
        node_type_id: mapState.selectedNodeType,
        node_ref: nodeRef,
        name: nodeRef,
        lat: latlng.lat,
        lng: latlng.lng
      })
      
      mapState.setNodes([...mapState.nodes, newNode])
      
      undoRedo.addToHistory({
        type: ACTION_TYPES.CREATE_NODE,
        data: { node: newNode }
      })
      
      setMode('view')
      
    } catch (error) {
      console.error('Error creating node:', error)
      alert('Failed to create node')
    }
  }

  /**
   * Handle node click - either for drawing lines or editing in view mode
   */
  const handleNodeClick = async (node, mode) => {
    if (mode === 'draw_line') {
      if (!mapState.drawingLine) {
        mapState.setDrawingLine({ startNode: node })
      } else if (mapState.drawingLine.startNode.id !== node.id) {
        // This will be handled by line handlers - just return the line data
        return {
          startNode: mapState.drawingLine.startNode,
          endNode: node,
          selectedSectionId: mapState.selectedSectionId
        }
      }
    } else if (mode === 'view') {
      mapState.setSelectedNode(node)
      mapState.setEditingNode({...node})
    }
  }

  /**
   * Handle node drag end - update position in database
   */
  const handleNodeDragEnd = async (nodeId, previousPosition, newPosition) => {
    try {
      await updateMapNode(nodeId, {
        lat: newPosition.lat,
        lng: newPosition.lng
      })
      
      mapState.setNodes(prevNodes => 
        prevNodes.map(n => 
          n.id === nodeId 
            ? { ...n, lat: newPosition.lat, lng: newPosition.lng }
            : n
        )
      )
      
      undoRedo.addToHistory({
        type: ACTION_TYPES.MOVE_NODE,
        data: {
          nodeId,
          previousPosition,
          newPosition
        }
      })
    } catch (error) {
      console.error('Error updating node position:', error)
      alert('Failed to save node position')
      
      // Reload nodes from database on error
      try {
        const nodesData = await getMapNodes(projectId)
        mapState.setNodes(nodesData)
      } catch (reloadError) {
        console.error('Error reloading nodes:', reloadError)
      }
    }
  }
  
  /**
   * Handle node update from modal - delegates to handleNodeUpdate or just updates editing state
   */
  const handleNodeModalUpdate = (updatedNode, shouldSave) => {
    if (shouldSave) {
      handleNodeUpdate(updatedNode.id, updatedNode)
    } else {
      mapState.setEditingNode(updatedNode)
    }
  }
  
  /**
   * Handle node update - save changes to database
   */
  const handleNodeUpdate = async (nodeId, updates) => {
    try {
      const currentNode = mapState.nodes.find(n => n.id === nodeId)
      const previousState = { ...currentNode }
      
      const updatedNode = await updateMapNode(nodeId, updates)
      mapState.setNodes(mapState.nodes.map(n => n.id === nodeId ? updatedNode : n))
      
      undoRedo.addToHistory({
        type: ACTION_TYPES.UPDATE_NODE,
        data: {
          nodeId,
          previousState,
          newState: updates
        }
      })
      
      mapState.setSelectedNode(null)
      mapState.setEditingNode(null)
    } catch (error) {
      console.error('Error updating node:', error)
      alert('Failed to update node')
    }
  }
  
  /**
   * Handle node delete - remove node and connected lines
   */
  const handleNodeDelete = async (nodeId) => {
    try {
      const nodeToDelete = mapState.nodes.find(n => n.id === nodeId)
      const connectedLines = mapState.lines.filter(l => 
        l.start_node_id === nodeId || l.end_node_id === nodeId
      )
      
      await deleteMapNode(nodeId)
      mapState.setNodes(mapState.nodes.filter(n => n.id !== nodeId))
      mapState.setLines(mapState.lines.filter(l => l.start_node_id !== nodeId && l.end_node_id !== nodeId))
      
      undoRedo.addToHistory({
        type: ACTION_TYPES.DELETE_NODE,
        data: {
          node: nodeToDelete,
          deletedLines: connectedLines
        }
      })
      
      mapState.setSelectedNode(null)
      mapState.setEditingNode(null)
    } catch (error) {
      console.error('Error deleting node:', error)
      alert('Failed to delete node')
    }
  }

  // Return all handler functions
  return {
    handleMapClick,
    handleNodeClick,
    handleNodeDragEnd,
    handleNodeModalUpdate,
    handleNodeUpdate,
    handleNodeDelete
  }
}