'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function sendSupportMessage({ ticketId, message, userId }) {
  try {
    // Validate inputs
    if (!ticketId || !message?.trim() || !userId) {
      return { success: false, error: 'Missing required fields' }
    }

    // Get user profile to verify they exist and get company_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id, role')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return { success: false, error: 'User not found' }
    }

    // Verify user has access to this ticket
    let ticketQuery = supabaseAdmin
      .from('support_tickets')
      .select('id, company_id')
      .eq('id', ticketId)

    // Non-super admins can only access their company's tickets
    if (profile.role !== 'super_admin') {
      ticketQuery = ticketQuery.eq('company_id', profile.company_id)
    }

    const { data: ticket, error: ticketError } = await ticketQuery.single()

    if (ticketError || !ticket) {
      return { success: false, error: 'Ticket not found or access denied' }
    }

    // Insert the message
    const { data: newMessage, error: messageError } = await supabaseAdmin
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        message: message.trim(),
        user_id: userId,  // Changed from sender_id to user_id
        is_internal: false
      })
      .select(`
        id,
        message,
        created_at,
        user_id,
        is_internal,
        sender:profiles!user_id (
          full_name,
          email,
          role,
          company_id,
          company:companies!company_id (
            name
          )
        )
      `)
      .single()

    if (messageError) {
      throw messageError
    }

    // Update the ticket's last_message_at timestamp
    await supabaseAdmin
      .from('support_tickets')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)

    return { 
      success: true, 
      data: newMessage 
    }

  } catch (error) {
    console.error('Error sending support message:', error)
    return { 
      success: false, 
      error: 'Failed to send message. Please try again.' 
    }
  }
}