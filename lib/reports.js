// lib/reports.js
// API functions for the reporting system - SIMPLIFIED (No templates)

import { supabase } from './supabase'

// =====================================================
// BRANDING PROFILES
// =====================================================

/**
 * Get all branding profiles for the current user
 */
export const getBrandingProfiles = async () => {
  const { data, error } = await supabase
    .from('report_branding_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching branding profiles:', error)
    throw error
  }

  return data
}

/**
 * Get a single branding profile
 */
export const getBrandingProfile = async (profileId) => {
  const { data, error } = await supabase
    .from('report_branding_profiles')
    .select('*')
    .eq('id', profileId)
    .single()

  if (error) {
    console.error('Error fetching branding profile:', error)
    throw error
  }

  return data
}

/**
 * Get the default branding profile for the current user
 */
export const getDefaultBrandingProfile = async () => {
  const { data, error } = await supabase
    .from('report_branding_profiles')
    .select('*')
    .eq('is_default', true)
    .single()

  if (error && error.code !== 'PGRST116') { // Not found is ok
    console.error('Error fetching default branding profile:', error)
  }

  return data
}

/**
 * Create a new branding profile
 */
export const createBrandingProfile = async (profileData) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // If setting as default, unset other defaults first
  if (profileData.is_default) {
    await supabase
      .from('report_branding_profiles')
      .update({ is_default: false })
      .eq('user_id', user.id)
  }

  const { data, error } = await supabase
    .from('report_branding_profiles')
    .insert({
      user_id: user.id,
      ...profileData
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating branding profile:', error)
    throw error
  }

  return data
}

/**
 * Update a branding profile
 */
export const updateBrandingProfile = async (profileId, updates) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // If setting as default, unset other defaults first
  if (updates.is_default) {
    await supabase
      .from('report_branding_profiles')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .neq('id', profileId)
  }

  const { data, error } = await supabase
    .from('report_branding_profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single()

  if (error) {
    console.error('Error updating branding profile:', error)
    throw error
  }

  return data
}

/**
 * Delete a branding profile
 */
export const deleteBrandingProfile = async (profileId) => {
  const { error } = await supabase
    .from('report_branding_profiles')
    .delete()
    .eq('id', profileId)

  if (error) {
    console.error('Error deleting branding profile:', error)
    throw error
  }
}

// =====================================================
// REPORT GENERATION - SIMPLIFIED
// =====================================================

/**
 * Create a new comprehensive report with complete data snapshot
 */
export const createReport = async (projectId, options = {}) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get complete project data for snapshot
  const projectData = await getCompleteProjectData(projectId)
  
  // Generate report number
  const { data: reportNumber } = await supabase
    .rpc('generate_report_number')

  // Calculate statistics
  const stats = calculateReportStats(projectData)

  // Create the report - simplified options
  const { data, error } = await supabase
    .from('reports')
    .insert({
      project_id: projectId,
      created_by: user.id,
      report_number: reportNumber,
      title: options.title || `Inspection Report - ${projectData.project.name}`,
      
      // Snapshots
      project_snapshot: projectData.project,
      sections_snapshot: projectData.sections,
      observations_snapshot: projectData.observations,
      maps_snapshot: projectData.maps,
      nodes_snapshot: projectData.nodes,
      lines_snapshot: projectData.lines,
      drawings_snapshot: projectData.drawings,
      
      // Simplified options - no template selection
      branding_profile_id: options.brandingProfileId,
      report_template: 'standard', // Fixed value for backwards compatibility
      weather_conditions: options.weatherConditions,
      
      // Statistics
      stats
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating report:', error)
    throw error
  }

  return data
}

/**
 * Get complete project data for snapshot
 */
const getCompleteProjectData = async (projectId) => {
  // Get project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (projectError) throw projectError

  // Get sections with observations
  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select('*')
    .eq('project_id', projectId)
    .order('section_number')

  if (sectionsError) throw sectionsError

  // Get all observations
  const sectionIds = sections.map(s => s.id)
  const { data: observations, error: obsError } = await supabase
    .from('observations')
    .select('*')
    .in('section_id', sectionIds)
    .order('distance')

  if (obsError) throw obsError

  // Get map data
  const { data: maps } = await supabase
    .from('project_maps')
    .select('*')
    .eq('project_id', projectId)
    .single()

  // Get nodes
  const { data: nodes } = await supabase
    .from('map_nodes')
    .select('*')
    .eq('project_id', projectId)

  // Get lines
  const { data: lines } = await supabase
    .from('map_lines')
    .select('*')
    .eq('project_id', projectId)

  // Get drawings
  const { data: drawings } = await supabase
    .from('map_drawings')
    .select('*')
    .eq('project_id', projectId)

  return {
    project,
    sections: sections || [],
    observations: observations || [],
    maps,
    nodes: nodes || [],
    lines: lines || [],
    drawings: drawings || []
  }
}

/**
 * Calculate report statistics
 */
const calculateReportStats = (projectData) => {
  const { sections, observations } = projectData
  
  const criticalObservations = observations.filter(o => o.severity >= 4).length
  const highObservations = observations.filter(o => o.severity === 3).length
  const mediumObservations = observations.filter(o => o.severity === 2).length
  const lowObservations = observations.filter(o => o.severity === 1).length
  
  // Calculate total inspected length
  const totalLength = sections.reduce((sum, section) => {
    const start = section.start_depth || 0
    const finish = section.finish_depth || 0
    return sum + Math.abs(finish - start)
  }, 0)

  return {
    total_observations: observations.length,
    critical_observations: criticalObservations,
    high_observations: highObservations,
    medium_observations: mediumObservations,
    low_observations: lowObservations,
    total_sections: sections.length,
    total_length: totalLength,
    severity_distribution: {
      critical: criticalObservations,
      high: highObservations,
      medium: mediumObservations,
      low: lowObservations
    }
  }
}

// =====================================================
// REPORT MANAGEMENT
// =====================================================

/**
 * Get all reports for a project
 */
export const getProjectReports = async (projectId) => {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      created_by_profile:profiles!reports_created_by_fkey(full_name),
      branding_profile:report_branding_profiles(*)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching project reports:', error)
    throw error
  }

  return data
}

/**
 * Get a single report
 */
export const getReport = async (reportId) => {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      created_by_profile:profiles!reports_created_by_fkey(full_name),
      branding_profile:report_branding_profiles(*),
      recommendations:report_recommendations(*)
    `)
    .eq('id', reportId)
    .single()

  if (error) {
    console.error('Error fetching report:', error)
    throw error
  }

  // Sort recommendations by position
  if (data.recommendations) {
    data.recommendations.sort((a, b) => a.position - b.position)
  }

  return data
}

/**
 * Update a report (only if draft)
 */
export const updateReport = async (reportId, updates) => {
  const { data, error } = await supabase
    .from('reports')
    .update(updates)
    .eq('id', reportId)
    .eq('status', 'draft') // Only update draft reports
    .select()
    .single()

  if (error) {
    console.error('Error updating report:', error)
    throw error
  }

  return data
}

/**
 * Finalize a report (make it immutable)
 */
export const finalizeReport = async (reportId) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('reports')
    .update({
      status: 'final',
      is_final: true,
      finalized_at: new Date().toISOString(),
      finalized_by: user.id
    })
    .eq('id', reportId)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    console.error('Error finalizing report:', error)
    throw error
  }

  return data
}

/**
 * Delete a report (only if draft)
 */
export const deleteReport = async (reportId) => {
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', reportId)
    .eq('status', 'draft') // Only delete draft reports

  if (error) {
    console.error('Error deleting report:', error)
    throw error
  }
}

// =====================================================
// RECOMMENDATIONS
// =====================================================

/**
 * Create a recommendation
 */
export const createRecommendation = async (reportId, recommendation) => {
  // Get the next position
  const { data: existing } = await supabase
    .from('report_recommendations')
    .select('position')
    .eq('report_id', reportId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing?.[0]?.position ? existing[0].position + 1 : 0

  const { data, error } = await supabase
    .from('report_recommendations')
    .insert({
      report_id: reportId,
      position: nextPosition,
      ...recommendation
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating recommendation:', error)
    throw error
  }

  return data
}

/**
 * Update a recommendation
 */
export const updateRecommendation = async (recommendationId, updates) => {
  const { data, error } = await supabase
    .from('report_recommendations')
    .update(updates)
    .eq('id', recommendationId)
    .select()
    .single()

  if (error) {
    console.error('Error updating recommendation:', error)
    throw error
  }

  return data
}

/**
 * Delete a recommendation
 */
export const deleteRecommendation = async (recommendationId) => {
  const { error } = await supabase
    .from('report_recommendations')
    .delete()
    .eq('id', recommendationId)

  if (error) {
    console.error('Error deleting recommendation:', error)
    throw error
  }
}

/**
 * Reorder recommendations
 */
export const reorderRecommendations = async (reportId, recommendationIds) => {
  const updates = recommendationIds.map((id, index) => ({
    id,
    position: index
  }))

  const { error } = await supabase
    .from('report_recommendations')
    .upsert(updates)

  if (error) {
    console.error('Error reordering recommendations:', error)
    throw error
  }
}

// =====================================================
// REPORT SHARING
// =====================================================

/**
 * Create a share link for a report
 */
export const createReportShare = async (reportId, options = {}) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('report_shares')
    .insert({
      report_id: reportId,
      created_by: user.id,
      ...options
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating report share:', error)
    throw error
  }

  return data
}

/**
 * Get all shares for a report
 */
export const getReportShares = async (reportId) => {
  const { data, error } = await supabase
    .from('report_shares')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching report shares:', error)
    throw error
  }

  return data
}

/**
 * Update a share
 */
export const updateReportShare = async (shareId, updates) => {
  const { data, error } = await supabase
    .from('report_shares')
    .update(updates)
    .eq('id', shareId)
    .select()
    .single()

  if (error) {
    console.error('Error updating report share:', error)
    throw error
  }

  return data
}

/**
 * Delete a share
 */
export const deleteReportShare = async (shareId) => {
  const { error } = await supabase
    .from('report_shares')
    .delete()
    .eq('id', shareId)

  if (error) {
    console.error('Error deleting report share:', error)
    throw error
  }
}

/**
 * Get report by share token (for public viewing)
 */
export const getReportByShareToken = async (shareToken) => {
  try {
    // Use the stored procedure that bypasses RLS
    const { data, error } = await supabase
      .rpc('get_public_report', { p_share_token: shareToken })
      .single()

    if (error) {
      console.error('RPC error:', error)
      throw new Error(error.message || 'Failed to load report')
    }

    if (!data || !data.report) {
      throw new Error('Report not found')
    }

    // Parse the JSON data
    const report = typeof data.report === 'string' ? JSON.parse(data.report) : data.report
    const share = typeof data.share === 'string' ? JSON.parse(data.share) : data.share

    return { report, share }
  } catch (error) {
    console.error('Error in getReportByShareToken:', error)
    throw error
  }
}