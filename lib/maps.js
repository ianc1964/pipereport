import { supabase } from './supabase'

// =====================================================
// PROJECT MAP MANAGEMENT
// =====================================================

export const getProjectMap = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('project_maps')
      .select('*')
      .eq('project_id', projectId)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Error fetching project map:', error)
    throw error
  }
}

export const createProjectMap = async (projectId, mapData = {}) => {
  try {
    const { data, error } = await supabase
      .from('project_maps')
      .insert({
        project_id: projectId,
        name: mapData.name || 'Site Map',
        background_type: mapData.background_type || 'image',
        background_image_url: mapData.background_image_url || null,
        bounds: mapData.bounds || null,
        default_zoom: mapData.default_zoom || 15,
        center_lat: mapData.center_lat || 0,
        center_lng: mapData.center_lng || 0
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating project map:', error)
    throw error
  }
}

export const updateProjectMap = async (mapId, updates) => {
  try {
    const { data, error } = await supabase
      .from('project_maps')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', mapId)
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating project map:', error)
    throw error
  }
}

// Upload map background image
// Updated uploadMapBackground function for lib/maps.js
// Replace the existing uploadMapBackground function with this one

export const uploadMapBackground = async (projectId, imageFile) => {
  try {
    // Check authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      console.error('Auth error:', userError)
      throw new Error(`Authentication failed: ${userError.message}`)
    }
    if (!user) throw new Error('User not authenticated')
    
    console.log('Uploading background for project:', projectId)
    console.log('File details:', {
      name: imageFile.name,
      size: imageFile.size,
      type: imageFile.type
    })
    
    // Validate file
    if (!imageFile.type.startsWith('image/')) {
      throw new Error('File must be an image')
    }
    
    // Check file size (e.g., 10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (imageFile.size > maxSize) {
      throw new Error('Image file too large. Maximum size is 10MB')
    }
    
    const fileExt = imageFile.name.split('.').pop().toLowerCase()
    const fileName = `${projectId}_${Date.now()}.${fileExt}`
    const filePath = `${user.id}/map-backgrounds/${fileName}`
    
    console.log('Upload path:', filePath)
    
    // Try to upload to the images bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, imageFile, {
        contentType: imageFile.type,
        cacheControl: '3600',
        upsert: true
      })
    
    if (uploadError) {
      console.error('Upload error details:', uploadError)
      
      // Check if it's a bucket/permission issue
      if (uploadError.message?.includes('not found') || uploadError.statusCode === 404) {
        throw new Error('Storage bucket "images" not found. Please check Supabase storage configuration.')
      } else if (uploadError.message?.includes('policy') || uploadError.statusCode === 403) {
        throw new Error('Permission denied. Please check storage bucket policies.')
      } else {
        throw new Error(`Upload failed: ${uploadError.message || 'Unknown error'}`)
      }
    }
    
    console.log('Upload successful:', uploadData)
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filePath)
    
    console.log('Public URL:', publicUrl)
    
    return publicUrl
  } catch (error) {
    console.error('Error in uploadMapBackground:', error)
    throw error
  }
}

// =====================================================
// NODE TYPE MANAGEMENT
// =====================================================

// Get only active node types (system + user's custom)
export const getNodeTypes = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('node_types')
      .select('*')
      .or(`is_system.eq.true,created_by.eq.${user.id}`)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching node types:', error)
    throw error
  }
}

// Get ALL node types including inactive (for admin/management interfaces)
export const getAllNodeTypes = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('node_types')
      .select('*')
      .or(`is_system.eq.true,created_by.eq.${user.id}`)
      .order('display_order', { ascending: true })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching all node types:', error)
    throw error
  }
}

// Create custom node type
export const createNodeType = async (nodeTypeData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    // Get max display order
    const { data: existingTypes } = await supabase
      .from('node_types')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
    
    const maxOrder = existingTypes?.[0]?.display_order || 0
    
    const { data, error } = await supabase
      .from('node_types')
      .insert({
        ...nodeTypeData,
        created_by: user.id,
        is_system: false,
        is_active: true,
        display_order: maxOrder + 1,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating node type:', error)
    throw error
  }
}

// Update custom node type
export const updateNodeType = async (nodeTypeId, updates) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('node_types')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', nodeTypeId)
      .eq('created_by', user.id) // Only allow updating own custom types
      .eq('is_system', false) // Can't update system types
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating node type:', error)
    throw error
  }
}

// Delete custom node type
export const deleteNodeType = async (nodeTypeId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    // Check if any nodes use this type
    const { data: nodesUsingType } = await supabase
      .from('map_nodes')
      .select('id')
      .eq('node_type_id', nodeTypeId)
      .limit(1)
    
    if (nodesUsingType?.length > 0) {
      throw new Error('Cannot delete node type that is in use')
    }
    
    const { error } = await supabase
      .from('node_types')
      .delete()
      .eq('id', nodeTypeId)
      .eq('created_by', user.id) // Only allow deleting own custom types
      .eq('is_system', false) // Can't delete system types
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting node type:', error)
    throw error
  }
}

// Toggle node type active status
export const toggleNodeTypeActive = async (nodeTypeId, isActive) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('node_types')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', nodeTypeId)
      .eq('created_by', user.id) // Only allow toggling own custom types
      .eq('is_system', false) // Can't toggle system types
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error toggling node type active status:', error)
    throw error
  }
}

// =====================================================
// MAP NODE MANAGEMENT
// =====================================================

export const getMapNodes = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('map_nodes')
      .select(`
        *,
        node_type:node_types(*)
      `)
      .eq('project_id', projectId)
      .order('node_ref', { ascending: true })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching map nodes:', error)
    throw error
  }
}

export const createMapNode = async (nodeData) => {
  try {
    const { data, error } = await supabase
      .from('map_nodes')
      .insert({
        ...nodeData,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        node_type:node_types(*)
      `)
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating map node:', error)
    throw error
  }
}

export const updateMapNode = async (nodeId, updates) => {
  try {
    const { data, error } = await supabase
      .from('map_nodes')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', nodeId)
      .select(`
        *,
        node_type:node_types(*)
      `)
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating map node:', error)
    throw error
  }
}

export const deleteMapNode = async (nodeId) => {
  try {
    const { error } = await supabase
      .from('map_nodes')
      .delete()
      .eq('id', nodeId)
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting map node:', error)
    throw error
  }
}

// Get nodes that match section start/finish refs
export const getNodesForSection = async (projectId, startRef, finishRef) => {
  try {
    const { data, error } = await supabase
      .from('map_nodes')
      .select('*')
      .eq('project_id', projectId)
      .in('node_ref', [startRef, finishRef].filter(Boolean))
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching nodes for section:', error)
    throw error
  }
}

// =====================================================
// MAP LINE MANAGEMENT
// =====================================================

export const getMapLines = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('map_lines')
      .select(`
        *,
        start_node:map_nodes!start_node_id(*),
        end_node:map_nodes!end_node_id(*),
        section:sections(*)
      `)
      .eq('project_id', projectId)
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching map lines:', error)
    throw error
  }
}

export const createMapLine = async (lineData) => {
  try {
    const { data, error } = await supabase
      .from('map_lines')
      .insert({
        ...lineData,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        start_node:map_nodes!start_node_id(*),
        end_node:map_nodes!end_node_id(*),
        section:sections(*)
      `)
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating map line:', error)
    throw error
  }
}

export const updateMapLine = async (lineId, updates) => {
  try {
    const { data, error } = await supabase
      .from('map_lines')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', lineId)
      .select(`
        *,
        start_node:map_nodes!start_node_id(*),
        end_node:map_nodes!end_node_id(*)
      `)
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating map line:', error)
    throw error
  }
}

export const deleteMapLine = async (lineId) => {
  try {
    const { error } = await supabase
      .from('map_lines')
      .delete()
      .eq('id', lineId)
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting map line:', error)
    throw error
  }
}

// =====================================================
// OBSERVATION MARKER MANAGEMENT
// =====================================================

export const getObservationMarkers = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('map_observation_markers')
      .select(`
        *,
        observation:observations(
          *,
          section:sections(*)
        ),
        line:map_lines(*)
      `)
      .eq('line.project_id', projectId)
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching observation markers:', error)
    throw error
  }
}

// =====================================================
// MAP ANNOTATION MANAGEMENT
// =====================================================

export const getMapAnnotations = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('map_annotations')
      .select('*')
      .eq('project_id', projectId)
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching map annotations:', error)
    throw error
  }
}

export const createMapAnnotation = async (annotationData) => {
  try {
    const { data, error } = await supabase
      .from('map_annotations')
      .insert({
        ...annotationData,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating map annotation:', error)
    throw error
  }
}

export const updateMapAnnotation = async (annotationId, updates) => {
  try {
    const { data, error } = await supabase
      .from('map_annotations')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', annotationId)
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating map annotation:', error)
    throw error
  }
}

export const deleteMapAnnotation = async (annotationId) => {
  try {
    const { error } = await supabase
      .from('map_annotations')
      .delete()
      .eq('id', annotationId)
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting map annotation:', error)
    throw error
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

// Calculate distance between two points (Haversine formula)
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  return R * c // Distance in meters
}

// Calculate point along a line at a given percentage
export const calculatePointOnLine = (startLat, startLng, endLat, endLng, percentage) => {
  const lat = startLat + (endLat - startLat) * (percentage / 100)
  const lng = startLng + (endLng - startLng) * (percentage / 100)
  return { lat, lng }
}

// Generate a unique node reference
export const generateNodeRef = (prefix = 'MH', existingRefs = []) => {
  let num = 1
  let ref = `${prefix}${num.toString().padStart(3, '0')}`
  
  while (existingRefs.includes(ref)) {
    num++
    ref = `${prefix}${num.toString().padStart(3, '0')}`
  }
  
  return ref
}

// Auto-create nodes from existing sections
export const createNodesFromSections = async (projectId) => {
  try {
    const { data, error } = await supabase
      .rpc('create_nodes_from_sections', { project_uuid: projectId })
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error creating nodes from sections:', error)
    throw error
  }
}

// =====================================================
// DRAWING TOOLS MANAGEMENT
// Add these functions to your existing lib/maps.js file
// =====================================================

// =====================================================
// DRAWINGS CRUD OPERATIONS
// =====================================================

export const getMapDrawings = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('map_drawings')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_visible', true)
      .order('z_index', { ascending: true })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching map drawings:', error)
    throw error
  }
}

export const createMapDrawing = async (drawingData) => {
  try {
    // Ensure context is included, default to 'map' if not provided
    const dataToInsert = {
      ...drawingData,
      context: drawingData.context || 'map', // ADD THIS LINE - ensures context is saved
      created_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('map_drawings')
      .insert(dataToInsert)
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating map drawing:', error)
    throw error
  }
}

export const updateMapDrawing = async (drawingId, updates) => {
  try {
    const { data, error } = await supabase
      .from('map_drawings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', drawingId)
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating map drawing:', error)
    throw error
  }
}

export const deleteMapDrawing = async (drawingId) => {
  try {
    const { error } = await supabase
      .from('map_drawings')
      .delete()
      .eq('id', drawingId)
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting map drawing:', error)
    throw error
  }
}

// Toggle drawing visibility
export const toggleDrawingVisibility = async (drawingId, isVisible) => {
  try {
    const { data, error } = await supabase
      .from('map_drawings')
      .update({ 
        is_visible: isVisible,
        updated_at: new Date().toISOString()
      })
      .eq('id', drawingId)
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error toggling drawing visibility:', error)
    throw error
  }
}

// Update drawing style
export const updateDrawingStyle = async (drawingId, style) => {
  try {
    const { data, error } = await supabase
      .from('map_drawings')
      .update({ 
        style: style,
        updated_at: new Date().toISOString()
      })
      .eq('id', drawingId)
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating drawing style:', error)
    throw error
  }
}

// =====================================================
// DRAWING LAYERS MANAGEMENT
// =====================================================

export const getDrawingLayers = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('drawing_layers')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching drawing layers:', error)
    throw error
  }
}

export const createDrawingLayer = async (layerData) => {
  try {
    const { data, error } = await supabase
      .from('drawing_layers')
      .insert({
        ...layerData,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating drawing layer:', error)
    throw error
  }
}

export const updateDrawingLayer = async (layerId, updates) => {
  try {
    const { data, error } = await supabase
      .from('drawing_layers')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', layerId)
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating drawing layer:', error)
    throw error
  }
}

export const deleteDrawingLayer = async (layerId) => {
  try {
    // First check if layer has drawings
    const { data: layerDrawings } = await supabase
      .from('map_drawings')
      .select('id')
      .eq('layer_name', layerId)
      .limit(1)
    
    if (layerDrawings?.length > 0) {
      throw new Error('Cannot delete layer that contains drawings')
    }
    
    const { error } = await supabase
      .from('drawing_layers')
      .delete()
      .eq('id', layerId)
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting drawing layer:', error)
    throw error
  }
}

// =====================================================
// DRAWING TEMPLATES MANAGEMENT
// =====================================================

export const getDrawingTemplates = async (category = null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    let query = supabase
      .from('drawing_templates')
      .select('*')
      .or(`user_id.eq.${user.id},is_shared.eq.true,user_id.is.null`)
      .order('name', { ascending: true })
    
    if (category) {
      query = query.eq('category', category)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching drawing templates:', error)
    throw error
  }
}

export const createDrawingTemplate = async (templateData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('drawing_templates')
      .insert({
        ...templateData,
        user_id: user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating drawing template:', error)
    throw error
  }
}

export const updateDrawingTemplate = async (templateId, updates) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('drawing_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .eq('user_id', user.id) // Only allow updating own templates
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating drawing template:', error)
    throw error
  }
}

export const deleteDrawingTemplate = async (templateId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { error } = await supabase
      .from('drawing_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', user.id) // Only allow deleting own templates
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting drawing template:', error)
    throw error
  }
}

// =====================================================
// DRAWING UTILITY FUNCTIONS
// =====================================================

// Create geometry object for different drawing types
export const createDrawingGeometry = (type, data) => {
  switch (type) {
    case 'rectangle':
      return {
        type: 'rectangle',
        bounds: data.bounds // { north, south, east, west }
      }
    
    case 'circle':
      return {
        type: 'circle',
        center: data.center, // { lat, lng }
        radius: data.radius // meters
      }
    
    case 'polygon':
      return {
        type: 'polygon',
        coordinates: data.coordinates // [[lat, lng], [lat, lng], ...]
      }
    
    case 'freehand':
      return {
        type: 'freehand',
        coordinates: data.coordinates // [[lat, lng], [lat, lng], ...]
      }
    
    case 'text':
      return {
        type: 'text',
        position: data.position // { lat, lng }
      }
    
    case 'line':
      return {
        type: 'line',
        coordinates: data.coordinates // [[lat, lng], [lat, lng]]
      }
    
    case 'building':
      return {
        type: 'building',
        coordinates: data.coordinates, // Building outline
        buildingType: data.buildingType || 'generic'
      }
    
    case 'boundary':
      return {
        type: 'boundary',
        coordinates: data.coordinates,
        boundaryType: data.boundaryType || 'property'
      }
    
    default:
      throw new Error(`Unknown drawing type: ${type}`)
  }
}

// Default styles for different drawing types
export const getDefaultDrawingStyle = (type) => {
  const styles = {
    rectangle: {
      color: '#3B82F6',
      fillColor: '#3B82F6',
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.3,
      dashArray: null
    },
    circle: {
      color: '#10B981',
      fillColor: '#10B981',
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.3,
      dashArray: null
    },
    polygon: {
      color: '#8B5CF6',
      fillColor: '#8B5CF6',
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.3,
      dashArray: null
    },
    freehand: {
      color: '#F59E0B',
      fillColor: 'transparent',
      weight: 3,
      opacity: 0.9,
      fillOpacity: 0,
      dashArray: null
    },
    line: {
      color: '#EF4444',
      fillColor: 'transparent',
      weight: 3,
      opacity: 0.9,
      fillOpacity: 0,
      dashArray: null
    },
    building: {
      color: '#8B4513',
      fillColor: '#D2B48C',
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.6,
      dashArray: null
    },
    boundary: {
      color: '#DC2626',
      fillColor: 'transparent',
      weight: 3,
      opacity: 0.8,
      fillOpacity: 0,
      dashArray: '10,5'
    },
    text: {
      color: '#000000',
      fillColor: 'transparent',
      weight: 0,
      opacity: 1,
      fillOpacity: 0,
      dashArray: null
    }
  }
  
  return styles[type] || styles.rectangle
}

// Default text styles
export const getDefaultTextStyle = () => {
  return {
    fontSize: 14,
    fontFamily: 'Arial',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'center',
    textColor: '#000000'
  }
}

// Validate drawing geometry
export const validateDrawingGeometry = (type, geometry) => {
  try {
    switch (type) {
      case 'rectangle':
        if (!geometry.bounds || typeof geometry.bounds !== 'object') {
          throw new Error('Rectangle must have bounds object')
        }
        const { north, south, east, west } = geometry.bounds
        if (typeof north !== 'number' || typeof south !== 'number' ||
            typeof east !== 'number' || typeof west !== 'number') {
          throw new Error('Rectangle bounds must be numbers')
        }
        if (north <= south || east <= west) {
          throw new Error('Invalid rectangle bounds')
        }
        break
      
      case 'circle':
        if (!geometry.center || typeof geometry.center !== 'object') {
          throw new Error('Circle must have center object')
        }
        if (typeof geometry.center.lat !== 'number' || typeof geometry.center.lng !== 'number') {
          throw new Error('Circle center must have lat/lng numbers')
        }
        if (typeof geometry.radius !== 'number' || geometry.radius <= 0) {
          throw new Error('Circle radius must be a positive number')
        }
        break
      
      case 'polygon':
      case 'freehand':
        if (!Array.isArray(geometry.coordinates)) {
          throw new Error(`${type} must have coordinates array`)
        }
        if (geometry.coordinates.length < 3) {
          throw new Error(`${type} must have at least 3 points`)
        }
        geometry.coordinates.forEach((coord, i) => {
          if (!Array.isArray(coord) || coord.length !== 2) {
            throw new Error(`${type} coordinate ${i} must be [lat, lng] array`)
          }
          if (typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
            throw new Error(`${type} coordinate ${i} must contain numbers`)
          }
        })
        break
      
      case 'line':
        if (!Array.isArray(geometry.coordinates)) {
          throw new Error('Line must have coordinates array')
        }
        if (geometry.coordinates.length < 2) {
          throw new Error('Line must have at least 2 points')
        }
        geometry.coordinates.forEach((coord, i) => {
          if (!Array.isArray(coord) || coord.length !== 2) {
            throw new Error(`Line coordinate ${i} must be [lat, lng] array`)
          }
          if (typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
            throw new Error(`Line coordinate ${i} must contain numbers`)
          }
        })
        break
      
      case 'text':
        if (!geometry.position || typeof geometry.position !== 'object') {
          throw new Error('Text must have position object')
        }
        if (typeof geometry.position.lat !== 'number' || typeof geometry.position.lng !== 'number') {
          throw new Error('Text position must have lat/lng numbers')
        }
        break
      
      default:
        throw new Error(`Unknown drawing type: ${type}`)
    }
    
    return true
  } catch (error) {
    console.error('Drawing geometry validation error:', error)
    throw error
  }
}

// Calculate drawing bounds for viewport fitting
export const calculateDrawingBounds = (drawing) => {
  const { geometry } = drawing
  
  switch (geometry.type) {
    case 'rectangle':
      return [
        [geometry.bounds.south, geometry.bounds.west],
        [geometry.bounds.north, geometry.bounds.east]
      ]
    
    case 'circle':
      const latOffset = geometry.radius / 111320 // Rough lat degree conversion
      const lngOffset = geometry.radius / (111320 * Math.cos(geometry.center.lat * Math.PI / 180))
      return [
        [geometry.center.lat - latOffset, geometry.center.lng - lngOffset],
        [geometry.center.lat + latOffset, geometry.center.lng + lngOffset]
      ]
    
    case 'polygon':
    case 'freehand':
    case 'line':
    case 'building':
    case 'boundary':
      const lats = geometry.coordinates.map(coord => coord[0])
      const lngs = geometry.coordinates.map(coord => coord[1])
      return [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ]
    
    case 'text':
      const buffer = 0.001 // Small buffer around text point
      return [
        [geometry.position.lat - buffer, geometry.position.lng - buffer],
        [geometry.position.lat + buffer, geometry.position.lng + buffer]
      ]
    
    default:
      return null
  }
}

// Generate unique drawing name
export const generateDrawingName = (type, existingNames = []) => {
  const typeNames = {
    rectangle: 'Rectangle',
    circle: 'Circle',
    polygon: 'Polygon',
    freehand: 'Freehand',
    line: 'Line',
    text: 'Text',
    building: 'Building',
    boundary: 'Boundary'
  }
  
  const baseName = typeNames[type] || 'Drawing'
  let num = 1
  let name = `${baseName} ${num}`
  
  while (existingNames.includes(name)) {
    num++
    name = `${baseName} ${num}`
  }
  
  return name
}