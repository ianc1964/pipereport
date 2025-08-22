'use server'

import { createClient } from '@supabase/supabase-js'

// Archive a project with company-based authorization
export async function archiveProject(projectId, context, reason = null) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    console.log('🔒 Archiving project with company authorization:', { projectId, context })

    // Validate context
    if (!context?.user_id) {
      return { 
        success: false, 
        error: 'User authentication required' 
      }
    }

    // 🔒 SECURITY: Verify the project belongs to the user's company
    let projectQuery = supabase
      .from('projects')
      .select(`
        id,
        user_id,
        company_id,
        name,
        companies (
          id,
          name
        )
      `)
      .eq('id', projectId)

    // Apply company filtering for non-super admins
    if (!context.is_super_admin && context.company_id) {
      console.log('🔒 Applying company filter for archive:', context.company_id)
      projectQuery = projectQuery.eq('company_id', context.company_id)
    }

    const { data: project, error: fetchError } = await projectQuery.single()

    if (fetchError || !project) {
      console.error('❌ Project not found or access denied:', fetchError)
      return { 
        success: false, 
        error: 'Project not found or you do not have permission to archive it' 
      }
    }

    console.log('✅ Project access authorized for archiving')

    // Archive the project
    const { data, error } = await supabase
      .from('projects')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        archived_by: context.user_id,
        archive_reason: reason
      })
      .eq('id', projectId)
      .select()
      .single()

    if (error) {
      console.error('❌ Archive error:', error)
      return { 
        success: false, 
        error: error.message 
      }
    }

    console.log('✅ Project archived successfully')
    return { 
      success: true, 
      data 
    }
  } catch (error) {
    console.error('❌ Archive error:', error)
    return { 
      success: false, 
      error: 'Failed to archive project' 
    }
  }
}

// Restore an archived project with company-based authorization
export async function restoreProject(projectId, context, newStatus = 'in_progress') {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    console.log('🔒 Restoring project with company authorization:', { projectId, context })

    // Validate context
    if (!context?.user_id) {
      return { 
        success: false, 
        error: 'User authentication required' 
      }
    }

    // 🔒 SECURITY: Verify the project belongs to the user's company
    let projectQuery = supabase
      .from('projects')
      .select(`
        id,
        user_id,
        company_id,
        name,
        companies (
          id,
          name
        )
      `)
      .eq('id', projectId)

    // Apply company filtering for non-super admins
    if (!context.is_super_admin && context.company_id) {
      console.log('🔒 Applying company filter for restore:', context.company_id)
      projectQuery = projectQuery.eq('company_id', context.company_id)
    }

    const { data: project, error: fetchError } = await projectQuery.single()

    if (fetchError || !project) {
      console.error('❌ Project not found or access denied:', fetchError)
      return { 
        success: false, 
        error: 'Project not found or you do not have permission to restore it' 
      }
    }

    console.log('✅ Project access authorized for restoration')

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
      console.error('❌ Restore error:', error)
      return { 
        success: false, 
        error: error.message 
      }
    }

    console.log('✅ Project restored successfully')
    return { 
      success: true, 
      data 
    }
  } catch (error) {
    console.error('❌ Restore error:', error)
    return { 
      success: false, 
      error: 'Failed to restore project' 
    }
  }
}

// Get all archived projects with company-based authorization
export async function getArchivedProjects(context) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    console.log('🔒 Loading archived projects with company authorization:', context)

    // Validate context
    if (!context?.user_id) {
      return { 
        success: false, 
        error: 'User authentication required' 
      }
    }

    // 🔒 SECURITY: Build query based on user role and company
    let query = supabase
      .from('projects')
      .select(`
        *,
        companies (
          id,
          name
        ),
        profiles!projects_user_id_fkey (
          id,
          full_name,
          email
        ),
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
      .eq('status', 'archived')

    // Apply company filtering based on user role
    if (context.is_super_admin) {
      // Super admins see ALL archived projects across all companies
      console.log('🔒 Loading ALL archived projects for super admin')
    } else if (context.company_id) {
      // Company users see only their company's archived projects
      console.log('🔒 Loading archived projects for company:', context.company_id)
      query = query.eq('company_id', context.company_id)
    } else {
      // User has no company - shouldn't happen but handle gracefully
      console.warn('❌ User has no company, returning no archived projects')
      return { 
        success: true, 
        data: [] 
      }
    }

    const { data, error } = await query.order('archived_at', { ascending: false })

    if (error) {
      console.error('❌ Fetch archived projects error:', error)
      return { 
        success: false, 
        error: error.message 
      }
    }

    console.log(`✅ Loaded ${data?.length || 0} archived projects`)
    return { 
      success: true, 
      data: data || [] 
    }
  } catch (error) {
    console.error('❌ Fetch archived projects error:', error)
    return { 
      success: false, 
      error: 'Failed to fetch archived projects' 
    }
  }
}

// Legacy function for backward compatibility (deprecated - use context version above)
export async function archiveProjectLegacy(projectId, userId, reason = null) {
  console.warn('⚠️ Using deprecated archiveProject with userId. Please update to use context-based version.')
  return archiveProject(projectId, { user_id: userId, is_super_admin: false }, reason)
}

// Legacy function for backward compatibility (deprecated - use context version above)
export async function restoreProjectLegacy(projectId, userId, newStatus = 'in_progress') {
  console.warn('⚠️ Using deprecated restoreProject with userId. Please update to use context-based version.')
  return restoreProject(projectId, { user_id: userId, is_super_admin: false }, newStatus)
}

// Legacy function for backward compatibility (deprecated - use context version above)
export async function getArchivedProjectsLegacy(userId) {
  console.warn('⚠️ Using deprecated getArchivedProjects with userId. Please update to use context-based version.')
  return getArchivedProjects({ user_id: userId, is_super_admin: false })
}