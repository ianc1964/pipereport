// lib/observations.js - Enhanced version with new fields support and fixed validation

import { supabase } from './supabase.js'

// Fetch all active observation codes
export const getObservationCodes = async () => {
  try {
    const { data, error } = await supabase
      .from('observation_codes')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('code', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching observation codes:', error)
    throw error
  }
}

// Get specific code details
export const getCodeDetails = async (code) => {
  try {
    const { data, error } = await supabase
      .from('observation_codes')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching code details:', error)
    throw error
  }
}

// Create new observation
export const createObservation = async (sectionId, observationData) => {
  try {
    const { data, error } = await supabase
      .from('observations')
      .insert([{
        section_id: sectionId,
        ...observationData,
        created_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating observation:', error)
    throw error
  }
}

// Update observation
export const updateObservation = async (observationId, updates) => {
  try {
    const { data, error } = await supabase
      .from('observations')
      .update(updates)
      .eq('id', observationId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating observation:', error)
    throw error
  }
}

// Delete observation
export const deleteObservation = async (observationId) => {
  try {
    // First get the observation to check for image
    const { data: observation, error: fetchError } = await supabase
      .from('observations')
      .select('image_url')
      .eq('id', observationId)
      .single()

    if (fetchError) throw fetchError

    // Delete image from storage if it exists
    if (observation?.image_url) {
      const imagePath = observation.image_url.split('/').pop()
      await supabase.storage
        .from('images')
        .remove([imagePath])
    }

    // Delete observation record
    const { error } = await supabase
      .from('observations')
      .delete()
      .eq('id', observationId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting observation:', error)
    throw error
  }
}

// Get observations for a section
export const getObservations = async (sectionId, sortBy = 'distance', sortOrder = 'asc') => {
  try {
    const { data, error } = await supabase
      .from('observations')
      .select('*')
      .eq('section_id', sectionId)
      .order(sortBy, { ascending: sortOrder === 'asc' })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching observations:', error)
    throw error
  }
}

// Upload observation image
export const uploadObservationImage = async (file, userId, observationId) => {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${observationId}_${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('images')
      .upload(fileName, file)

    if (error) throw error

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(fileName)

    return publicUrl
  } catch (error) {
    console.error('Error uploading observation image:', error)
    throw error
  }
}

// FIXED: Simplified validation - only Distance and Code are required, all others are optional
export const validateObservation = (observation, codeDetails) => {
  const errors = []

  // Distance is required and can be 0.00 or greater
  if (observation.distance === null || observation.distance === undefined || observation.distance === '') {
    errors.push('Distance is required')
  } else if (isNaN(observation.distance) || observation.distance < 0) {
    errors.push('Distance must be 0 or greater')
  }

  // Code is required
  if (!observation.code) {
    errors.push('Code is required')
  }

  // Name validation is relaxed - it will be auto-generated if missing
  if (observation.name !== undefined && observation.name !== null && observation.name.trim() === '') {
    errors.push('Observation name cannot be empty (leave blank for auto-generation)')
  }

  // REMOVED: All the "required" validations for optional fields
  // The user specifically requested these to be optional:
  // - Band selection (optional)
  // - Material selection (optional) 
  // - Joint indicator (optional)
  // - Loss percentage (optional)
  // - Clock references (optional)
  // - Dimensions (optional)
  // - Continuous defect fields (optional)

  // VALUE VALIDATION: Only validate format/range when values are provided
  
  // Loss percentage range validation (only when provided)
  if (observation.loss_percentage !== null && observation.loss_percentage !== undefined && observation.loss_percentage !== '') {
    const lossValue = parseFloat(observation.loss_percentage)
    if (isNaN(lossValue) || lossValue < 0 || lossValue > 100) {
      errors.push('Loss percentage must be between 0 and 100')
    }
  }

  // Dimension validation (only when provided)
  if (observation.dimension_1 !== null && observation.dimension_1 !== undefined && observation.dimension_1 !== '') {
    const dim1Value = parseFloat(observation.dimension_1)
    if (isNaN(dim1Value) || dim1Value <= 0) {
      errors.push('Dimension 1 must be greater than 0')
    }
  }
  
  if (observation.dimension_2 !== null && observation.dimension_2 !== undefined && observation.dimension_2 !== '') {
    const dim2Value = parseFloat(observation.dimension_2)
    if (isNaN(dim2Value) || dim2Value <= 0) {
      errors.push('Dimension 2 must be greater than 0')
    }
  }

  // Severity validation (only when provided and code details available)
  if (observation.severity && codeDetails?.default_severity) {
    const severityValue = parseInt(observation.severity)
    if (isNaN(severityValue) || severityValue < 1 || severityValue > 5) {
      errors.push('Severity must be between 1 and 5')
    }
  }

  // Remarks length validation (only when provided)
  if (observation.remarks && observation.remarks.length > 50) {
    errors.push('Remarks must be 50 characters or less')
  }

  return errors
}

// Enhanced format observation for display with all new fields
export const formatObservationDisplay = (observation) => {
  // Build comprehensive display name
  const buildDisplayName = () => {
    const parts = [observation.code || 'Unknown']
    
    if (observation.distance !== null && observation.distance !== undefined) {
      parts.push(`at ${observation.distance}m`)
    }
    
    // Add descriptive elements
    const descriptors = []
    if (observation.band) descriptors.push(`Band ${observation.band}`)
    if (observation.material) descriptors.push(observation.material)
    if (observation.type) descriptors.push(observation.type) // NEW: Type field
    if (observation.is_at_joint) descriptors.push('at Joint')
    if (observation.loss_percentage) descriptors.push(`${observation.loss_percentage}% loss`)
    
    if (descriptors.length > 0) {
      parts.push(`(${descriptors.join(', ')})`)
    }
    
    return parts.join(' ')
  }

  return {
    ...observation,
    nameDisplay: observation.name || buildDisplayName(),
    distanceDisplay: observation.distance ? `${observation.distance}m` : 'No distance',
    severityDisplay: observation.severity ? `${observation.severity}/5` : 'Not set',
    lossDisplay: observation.loss_percentage ? `${observation.loss_percentage}%` : 'N/A',
    dimensionDisplay: observation.dimension_2 
      ? `${observation.dimension_1} × ${observation.dimension_2}` 
      : observation.dimension_1 ? `${observation.dimension_1}` : 'Not set',
    clockDisplay: observation.clock_ref_2 
      ? `${observation.clock_ref_1}, ${observation.clock_ref_2}`
      : observation.clock_ref_1 || 'Not set',
    bandDisplay: observation.band || 'Not specified',
    materialDisplay: observation.material || 'Not specified',
    typeDisplay: observation.type || 'Not specified', // NEW: Type display
    jointDisplay: observation.is_at_joint ? 'At Joint' : 'Not at Joint',
    
    // NEW: Continuous defect displays
    continuousDefectStartsDisplay: observation.continuous_defect_starts ? 'Starts' : 'No',
    continuousDefectEndsDisplay: observation.continuous_defect_ends ? 'Ends' : 'No',
    
    // Comprehensive details for display
    fullDetails: {
      basic: {
        code: observation.code,
        distance: observation.distance,
        description: observation.description,
        name: observation.name || buildDisplayName()
      },
      specifications: {
        band: observation.band,
        material: observation.material,
        type: observation.type, // NEW: Type field
        isAtJoint: observation.is_at_joint,
        lossPercentage: observation.loss_percentage,
        clockReferences: [observation.clock_ref_1, observation.clock_ref_2].filter(Boolean),
        dimensions: [observation.dimension_1, observation.dimension_2].filter(Boolean),
        continuousDefectStarts: observation.continuous_defect_starts, // NEW
        continuousDefectEnds: observation.continuous_defect_ends       // NEW
      },
      assessment: {
        severity: observation.severity,
        remarks: observation.remarks,
        continuousDefect: observation.cont_def // Keep legacy field for compatibility
      },
      metadata: {
        videoTimestamp: observation.video_timestamp,
        videoRef: observation.video_ref,
        photoRef: observation.photo_ref,
        imageUrl: observation.image_url,
        createdAt: observation.created_at
      }
    }
  }
}