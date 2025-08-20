'use client'
import { useState, useCallback } from 'react'
import { 
  getProjectMap, createProjectMap, 
  getAllNodeTypes, getMapNodes, getMapLines, getMapDrawings 
} from '@/lib/maps'

/**
 * Custom hook for managing all map data state and loading
 * Handles: map configuration, nodes, lines, drawings, node types
 */
export const useMapData = (projectId) => {
  // Core data state
  const [loading, setLoading] = useState(true)
  const [mapData, setMapData] = useState(null)
  const [nodeTypes, setNodeTypes] = useState([])
  const [nodes, setNodes] = useState([])
  const [lines, setLines] = useState([])
  const [drawings, setDrawings] = useState([])
  
  // UI state
  const [selectedNodeType, setSelectedNodeType] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [editingNode, setEditingNode] = useState(null)
  const [drawingLine, setDrawingLine] = useState(null)
  const [selectedSectionId, setSelectedSectionId] = useState(null)
  
  // Layer visibility state
  const [showNodes, setShowNodes] = useState(true)
  const [showLines, setShowLines] = useState(true)
  const [showObservations, setShowObservations] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [showDrawings, setShowDrawings] = useState(true)
  
  // Upload state
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [showNodeTypesModal, setShowNodeTypesModal] = useState(false)
  
  // Waypoint editing state
  const [editingWaypoints, setEditingWaypoints] = useState(null)

  // Load initial data function
  const loadMapData = useCallback(async () => {
    let isCancelled = false
    
    try {
      setLoading(true)
      
      // Load node types
      const types = await getAllNodeTypes()
      if (!isCancelled) {
        setNodeTypes(types)
        setSelectedNodeType(types[0]?.id || null)
      }
      
      // Load or create project map
      let map = await getProjectMap(projectId)
      if (!map && !isCancelled) {
        map = await createProjectMap(projectId)
      }
      if (!isCancelled) setMapData(map)
      
      // Load nodes, lines, and drawings
      const [nodesData, linesData, drawingsData] = await Promise.all([
        getMapNodes(projectId),
        getMapLines(projectId),
        getMapDrawings(projectId)
      ])
      
      if (!isCancelled) {
        setNodes(nodesData)
        setLines(linesData)
        setDrawings(drawingsData)
      }
      
    } catch (error) {
      console.error('Error loading map data:', error)
    } finally {
      if (!isCancelled) setLoading(false)
    }
    
    return () => { isCancelled = true }
  }, [projectId])

  // Update node types (for modal updates)
  const handleNodeTypesUpdate = async () => {
    try {
      const types = await getAllNodeTypes()
      setNodeTypes(types)
      
      // Update selected type if current one no longer exists
      if (selectedNodeType && !types.find(t => t.id === selectedNodeType)) {
        setSelectedNodeType(types[0]?.id || null)
      }
    } catch (error) {
      console.error('Error reloading node types:', error)
    }
  }

  // Helper function to get node type by ID
  const getNodeType = useCallback((typeId) => {
    return nodeTypes.find(t => t.id === typeId)
  }, [nodeTypes])

  return {
    // Data state
    loading,
    mapData,
    setMapData,
    nodeTypes,
    nodes,
    setNodes,
    lines,
    setLines,
    drawings,
    setDrawings,
    
    // UI state
    selectedNodeType,
    setSelectedNodeType,
    selectedNode,
    setSelectedNode,
    editingNode,
    setEditingNode,
    drawingLine,
    setDrawingLine,
    selectedSectionId,
    setSelectedSectionId,
    
    // Layer visibility
    showNodes,
    setShowNodes,
    showLines,
    setShowLines,
    showObservations,
    setShowObservations,
    showLabels,
    setShowLabels,
    showDrawings,
    setShowDrawings,
    
    // Upload state
    uploadingBackground,
    setUploadingBackground,
    showNodeTypesModal,
    setShowNodeTypesModal,
    
    // Waypoint editing
    editingWaypoints,
    setEditingWaypoints,
    
    // Functions
    loadMapData,
    handleNodeTypesUpdate,
    getNodeType
  }
}