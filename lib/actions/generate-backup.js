'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

export async function generateBackupAction({ selectedProjectIds, userId, companyId, companyName }) {
  try {
    // Validate inputs
    if (!userId || !companyId || !selectedProjectIds || selectedProjectIds.length === 0) {
      return { success: false, error: 'Invalid request parameters' }
    }
    
    // Verify the user belongs to the company (security check)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('company_id, role')
      .eq('id', userId)
      .single()
    
    if (profileError || (profile.company_id !== companyId && profile.role !== 'super_admin')) {
      return { success: false, error: 'Unauthorized access' }
    }
    
    // Get company details
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()
    
    if (companyError) {
      return { success: false, error: 'Failed to load company details' }
    }
    
    // Initialize backup structure
    const backup = {
      backup_version: '1.0',
      generated_at: new Date().toISOString(),
      company: {
        id: company.id,
        name: company.name,
        email: company.main_contact_email
      },
      projects: [],
      metadata: {
        total_projects: 0,
        total_sections: 0,
        total_observations: 0,
        excluded_items: ['videos', 'images', 'media_files']
      }
    }
    
    // Get selected projects with all related data
    for (const projectId of selectedProjectIds) {
      // Get project
      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      
      if (projectError) {
        console.error(`Error loading project ${projectId}:`, projectError)
        continue
      }
      
      // Verify project belongs to company (extra security check)
      const { data: projectOwner } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', project.user_id)
        .single()
      
      if (projectOwner?.company_id !== companyId && profile.role !== 'super_admin') {
        console.error(`Project ${projectId} does not belong to company`)
        continue
      }
      
      // Get sections
      const { data: sections, error: sectionsError } = await supabaseAdmin
        .from('sections')
        .select('*')
        .eq('project_id', projectId)
        .order('section_number', { ascending: true })
      
      if (sectionsError) {
        console.error(`Error loading sections for project ${projectId}:`, sectionsError)
      }
      
      // Get observations for all sections
      let observations = []
      if (sections && sections.length > 0) {
        const sectionIds = sections.map(s => s.id)
        const { data: obs, error: obsError } = await supabaseAdmin
          .from('observations')
          .select('*')
          .in('section_id', sectionIds)
          .order('distance', { ascending: true })
        
        if (obsError) {
          console.error(`Error loading observations:`, obsError)
        } else {
          observations = obs || []
        }
      }
      
      // Get project map data
      const { data: projectMap, error: mapError } = await supabaseAdmin
        .from('project_maps')
        .select('*')
        .eq('project_id', projectId)
        .single()
      
      // Get map nodes
      const { data: nodes, error: nodesError } = await supabaseAdmin
        .from('map_nodes')
        .select('*')
        .eq('project_id', projectId)
      
      // Get map lines
      const { data: lines, error: linesError } = await supabaseAdmin
        .from('map_lines')
        .select('*')
        .eq('project_id', projectId)
      
      // Get map drawings
      const { data: drawings, error: drawingsError } = await supabaseAdmin
        .from('map_drawings')
        .select('*')
        .eq('project_id', projectId)
      
      // Add to backup
      const projectBackup = {
        project: {
          ...project,
          // Remove any sensitive fields if needed
          user_id: undefined // Remove user reference for privacy
        },
        sections: sections || [],
        observations: observations || [],
        map: projectMap || null,
        nodes: nodes || [],
        lines: lines || [],
        drawings: drawings || []
      }
      
      backup.projects.push(projectBackup)
      
      // Update metadata
      backup.metadata.total_projects++
      backup.metadata.total_sections += sections?.length || 0
      backup.metadata.total_observations += observations?.length || 0
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `backup-${company.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.json`
    
    // Create the JSON content
    const jsonContent = JSON.stringify(backup, null, 2)
    
    // Convert to base64 for download
    const base64Content = Buffer.from(jsonContent).toString('base64')
    
    return {
      success: true,
      filename,
      content: base64Content,
      stats: backup.metadata
    }
    
  } catch (error) {
    console.error('Backup generation error:', error)
    return {
      success: false,
      error: 'Failed to generate backup. Please try again.'
    }
  }
}