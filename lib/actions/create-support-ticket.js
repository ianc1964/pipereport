// lib/actions/create-support-ticket.js
'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Create a new support ticket
 * @param {Object} params - Ticket creation parameters
 * @returns {Promise<Object>} Creation result
 */
export async function createSupportTicket(params) {
  try {
    const { ticketData, userId } = params
    
    console.log('=== CREATE SUPPORT TICKET START ===')
    console.log('User ID:', userId)
    console.log('Ticket Data:', ticketData)
    
    // Verify user is authenticated
    if (!userId) {
      throw new Error('User not authenticated')
    }
    
    // Get user profile to verify company and permissions (matches video-upload pattern)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id, role, full_name, email')
      .eq('id', userId)
      .single()
    
    console.log('Profile lookup result:', { profile, profileError })
    
    if (profileError || !profile) {
      throw new Error('User profile not found')
    }
    
    if (!profile.company_id && profile.role !== 'super_admin') {
      throw new Error('No company associated with user')
    }
    
    // Validate ticket data
    if (!ticketData.title?.trim()) {
      throw new Error('Title is required')
    }
    
    if (!ticketData.category) {
      throw new Error('Category is required')
    }
    
    if (!ticketData.priority) {
      throw new Error('Priority is required')
    }
    
    // Prepare ticket data
    const newTicket = {
      company_id: profile.company_id,
      created_by: profile.id,
      title: ticketData.title.trim(),
      description: ticketData.description?.trim() || null,
      priority: ticketData.priority,
      category: ticketData.category,
      status: 'open',
      last_message_by: profile.id
    }
    
    console.log('Creating ticket with data:', newTicket)
    
    // Create the support ticket
    const { data: ticket, error: createError } = await supabaseAdmin
      .from('support_tickets')
      .insert(newTicket)
      .select(`
        id,
        title,
        description,
        priority,
        status,
        category,
        created_at
      `)
      .single()
    
    console.log('Ticket creation result:', { ticket, createError })
    
    if (createError) {
      throw new Error(`Failed to create support ticket: ${createError.message}`)
    }
    
    // Create initial message if description is provided
    if (ticketData.description?.trim()) {
      console.log('Creating initial message for ticket:', ticket.id)
      
      const { error: messageError } = await supabaseAdmin
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          user_id: profile.id,
          message: ticketData.description.trim(),
          message_type: 'message'
        })
      
      console.log('Message creation result:', { messageError })
      
      if (messageError) {
        console.error('Error creating initial message:', messageError)
        // Don't fail the whole operation, just log the error
      }
    }
    
    console.log('=== TICKET CREATION SUCCESSFUL ===')
    
    return {
      success: true,
      data: ticket,
      message: 'Support ticket created successfully'
    }
    
  } catch (error) {
    console.error('=== SUPPORT TICKET CREATION ERROR ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    
    return {
      success: false,
      error: error.message
    }
  }
}