'use server'

import { createClient } from '@supabase/supabase-js'

// Archive a project
export async function archiveProject(projectId, userId, reason = null) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Verify the user owns the project first
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single()

    if (fetchError || !project) {
      return { 
        success: false, 
        error: 'Project not found' 
      }
    }

    if (project.user_id !== userId) {
      return { 
        success: false, 
        error: 'Unauthorized to archive this project' 
      }
    }

    // Archive the project
    const { data, error } = await supabase
      .from('projects')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_reason: reason
      })
      .eq('id', projectId)
      .select()
      .single()

    if (error) {
      console.error('Archive error:', error)
      return { 
        success: false, 
        error: error.message 
      }
    }

    return { 
      success: true, 
      data 
    }
  } catch (error) {
    console.error('Archive error:', error)
    return { 
      success: false, 
      error: 'Failed to archive project' 
    }
  }
}

// Restore an archived project
export async function restoreProject(projectId, userId, newStatus = 'in_progress') {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Verify the user owns the project first
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single()

    if (fetchError || !project) {
      return { 
        success: false, 
        error: 'Project not found' 
      }
    }

    if (project.user_id !== userId) {
      return { 
        success: false, 
        error: 'Unauthorized to restore this project' 
      }
    }

    // Restore the project
    const { data, error } = await supabase
      .from('projects')
      .update({
        status: newStatus,
        archived_at: null,
        archived_by: null,
        archive_reason: null
      })
      .eq('id', projectId)
      .select()
      .single()

    if (error) {
      console.error('Restore error:', error)
      return { 
        success: false, 
        error: error.message 
      }
    }

    return { 
      success: true, 
      data 
    }
  } catch (error) {
    console.error('Restore error:', error)
    return { 
      success: false, 
      error: 'Failed to restore project' 
    }
  }
}

// Get all archived projects for a specific user
export async function getArchivedProjects(userId) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    if (!userId) {
      return { 
        success: false, 
        error: 'User ID required' 
      }
    }

    // Get archived projects with archive details
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        archived_by_profile:profiles!archived_by(
          full_name,
          email
        ),
        sections (
          id,
          name,
          video_url,
          observations (
            id,
            severity,
            code
          )
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'archived')
      .order('archived_at', { ascending: false })

    if (error) {
      console.error('Fetch archived projects error:', error)
      return { 
        success: false, 
        error: error.message 
      }
    }

    return { 
      success: true, 
      data: data || [] 
    }
  } catch (error) {
    console.error('Fetch archived projects error:', error)
    return { 
      success: false, 
      error: 'Failed to fetch archived projects' 
    }
  }
}