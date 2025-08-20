'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export async function inviteUserAction(formData) {
  try {
    const email = formData.get('email')
    const fullName = formData.get('fullName')
    const role = formData.get('role')
    const companyId = formData.get('companyId')

    // Validate required fields
    if (!email || !fullName || !role || !companyId) {
      return {
        success: false,
        error: 'All fields are required'
      }
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single()

    if (existingUser) {
      return {
        success: false,
        error: 'A user with this email already exists'
      }
    }

    // Send invitation email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: fullName,
          role: role,
          company_id: companyId
        },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/accept-invitation`
      }
    )

    if (authError) {
      console.error('Auth invitation error:', authError)
      return {
        success: false,
        error: `Failed to send invitation: ${authError.message}`
      }
    }

    // Handle profile creation - either create new or update existing
    // The trigger might have already created a profile, so we need to handle both cases
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .eq('id', authData.user.id)
      .single()

    if (existingProfile) {
      // Profile exists (created by trigger), update it with company info
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: fullName,
          role: role,
          company_id: companyId,
          is_active: false // Keep inactive until they accept invitation
        })
        .eq('id', authData.user.id)

      if (updateError) {
        console.error('Profile update error:', updateError)
        return {
          success: false,
          error: `Failed to update user profile: ${updateError.message}`
        }
      }
    } else {
      // Profile doesn't exist, create it
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          full_name: fullName,
          role: role,
          company_id: companyId,
          is_active: false // Inactive until they accept invitation and set password
        })

      if (insertError) {
        console.error('Profile creation error:', insertError)
        return {
          success: false,
          error: `Failed to create user profile: ${insertError.message}`
        }
      }
    }

    return {
      success: true,
      message: 'Invitation sent successfully!'
    }

  } catch (error) {
    console.error('Invitation error:', error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error.message}`
    }
  }
}

export async function updateUserRoleAction(formData) {
  try {
    const userId = formData.get('userId')
    const newRole = formData.get('newRole')
    const companyId = formData.get('companyId')

    if (!userId || !newRole || !companyId) {
      return {
        success: false,
        error: 'Missing required parameters'
      }
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .eq('company_id', companyId) // Ensure they're in the right company

    if (error) {
      return {
        success: false,
        error: `Failed to update role: ${error.message}`
      }
    }

    return {
      success: true,
      message: 'User role updated successfully'
    }

  } catch (error) {
    console.error('Role update error:', error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error.message}`
    }
  }
}

export async function updateUserStatusAction(formData) {
  try {
    const userId = formData.get('userId')
    const isActive = formData.get('isActive') === 'true'
    const companyId = formData.get('companyId')

    if (!userId || !companyId) {
      return {
        success: false,
        error: 'Missing required parameters'
      }
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: !isActive })
      .eq('id', userId)
      .eq('company_id', companyId)

    if (error) {
      return {
        success: false,
        error: `Failed to update status: ${error.message}`
      }
    }

    return {
      success: true,
      message: 'User status updated successfully'
    }

  } catch (error) {
    console.error('Status update error:', error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error.message}`
    }
  }
}

export async function deleteUserAction(formData) {
  try {
    const userId = formData.get('userId')
    const companyId = formData.get('companyId')
    const currentUserId = formData.get('currentUserId')

    if (!userId || !companyId || !currentUserId) {
      return {
        success: false,
        error: 'Missing required parameters'
      }
    }

    // Prevent self-deletion
    if (userId === currentUserId) {
      return {
        success: false,
        error: 'You cannot delete your own account'
      }
    }

    // Get the user to be deleted
    const { data: userToDelete, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('id', userId)
      .single()

    if (fetchError || !userToDelete) {
      return {
        success: false,
        error: 'User not found'
      }
    }

    // Ensure user belongs to the same company
    if (userToDelete.company_id !== companyId) {
      return {
        success: false,
        error: 'You can only delete users from your own company'
      }
    }

    // Prevent deletion of company admins
    if (userToDelete.role === 'company_admin') {
      return {
        success: false,
        error: 'You cannot delete other company admins'
      }
    }

    // Delete the user from auth (this will cascade to profiles via trigger or RLS)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('Auth deletion error:', authDeleteError)
      
      // If auth deletion fails, try to at least remove from profiles
      const { error: profileDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)
        .eq('company_id', companyId)

      if (profileDeleteError) {
        return {
          success: false,
          error: `Failed to delete user: ${authDeleteError.message}`
        }
      }
    }

    return {
      success: true,
      message: 'User deleted successfully'
    }

  } catch (error) {
    console.error('User deletion error:', error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error.message}`
    }
  }
}