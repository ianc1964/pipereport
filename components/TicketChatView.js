'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { ArrowLeft, Send, User, Building, Clock, AlertCircle, CheckCircle, XCircle, MessageCircle } from 'lucide-react'

export default function TicketChatView({ ticketId }) {
  const { user, profile, company, loading: authLoading } = useAuth()
  const router = useRouter()
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load ticket and messages
  const loadTicketData = async () => {
    if (!profile || !ticketId) return
    
    try {
      setLoading(true)
      setError('')

      // Load ticket details
      let ticketQuery = supabase
        .from('support_tickets')
        .select(`
          id,
          title,
          description,
          priority,
          status,
          category,
          created_at,
          updated_at,
          last_message_at,
          company_id,
          created_by,
          assigned_to,
          companies (
            name
          ),
          creator:profiles!created_by (
            full_name,
            email
          ),
          assignee:profiles!assigned_to (
            full_name,
            email
          )
        `)
        .eq('id', ticketId)

      // Filter based on user role
      if (profile?.role !== 'super_admin') {
        if (!company?.id) {
          setError('Access denied: No company information available')
          return
        }
        ticketQuery = ticketQuery.eq('company_id', company.id)
      }

      const { data: ticketData, error: ticketError } = await ticketQuery.single()

      if (ticketError) {
        if (ticketError.code === 'PGRST116') {
          setError('Ticket not found or access denied')
        } else {
          throw ticketError
        }
        return
      }

      setTicket(ticketData)

      // Load messages for this ticket
      const { data: messagesData, error: messagesError } = await supabase
        .from('support_messages')
        .select(`
          id,
          message,
          created_at,
          user_id,
          is_internal,
          sender:profiles!user_id (
            full_name,
            email,
            role
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError

      setMessages(messagesData || [])

      // Mark messages as read for this user
      if (messagesData && messagesData.length > 0) {
        await markMessagesAsRead()
      }

    } catch (error) {
      console.error('Error loading ticket data:', error)
      setError('Failed to load ticket details')
    } finally {
      setLoading(false)
    }
  }

  // Mark messages as read
  const markMessagesAsRead = async () => {
    try {
      const { error } = await supabase
        .from('support_message_reads')
        .upsert(
          {
            ticket_id: ticketId,
            user_id: user.id,
            last_read_at: new Date().toISOString()
          },
          {
            onConflict: 'ticket_id,user_id',
            ignoreDuplicates: false
          }
        )

      if (error) {
        console.error('Error marking messages as read:', error)
      }
    } catch (error) {
      console.error('Error in markMessagesAsRead:', error)
    }
  }

  // Send new message
  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !user) return

    try {
      setSending(true)
      
      // Import the server action
      const { sendSupportMessage } = await import('../lib/actions/send-support-message')
      
      const result = await sendSupportMessage({
        ticketId: ticketId,
        message: newMessage.trim(),
        userId: user.id
      })

      if (!result.success) {
        setError(result.error || 'Failed to send message')
        return
      }

      setNewMessage('')
      // Messages will be updated via real-time subscription
      
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Handle Enter key for sending messages
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!ticketId) return

    const messagesSubscription = supabase
      .channel(`messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        async (payload) => {
          // Fetch the complete message with sender info
          const { data: newMessage, error } = await supabase
            .from('support_messages')
            .select(`
              id,
              message,
              created_at,
              user_id,
              is_internal,
              sender:profiles!user_id (
                full_name,
                email,
                role
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (!error && newMessage) {
            setMessages(prev => [...prev, newMessage])
            // Mark as read if it's not from current user
            if (newMessage.user_id !== user.id) {
              await markMessagesAsRead()
            }
          }
        }
      )
      .subscribe()

    return () => {
      messagesSubscription.unsubscribe()
    }
  }, [ticketId, user])

  // Load data when component mounts
  useEffect(() => {
    if (authLoading || !profile) return
    
    if (profile?.role !== 'super_admin' && !company) return
    
    let isCancelled = false
    const loadDataIfNotCancelled = async () => {
      if (!isCancelled) {
        await loadTicketData()
      }
    }

    loadDataIfNotCancelled()
    return () => { isCancelled = true }
  }, [profile, company, authLoading, ticketId])

  // Helper functions for UI
  const getStatusBadge = (status) => {
    const styles = {
      open: 'bg-red-100 text-red-800 border-red-200',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
      waiting_for_customer: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      resolved: 'bg-green-100 text-green-800 border-green-200',
      closed: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return styles[status] || styles.open
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-4 h-4" />
      case 'in_progress':
        return <Clock className="w-4 h-4" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />
      case 'closed':
        return <XCircle className="w-4 h-4" />
      default:
        return <MessageCircle className="w-4 h-4" />
    }
  }

  const getPriorityBadge = (priority) => {
    const styles = {
      low: 'bg-gray-100 text-gray-600',
      normal: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      urgent: 'bg-red-100 text-red-600'
    }
    return styles[priority] || styles.normal
  }

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleBack = () => {
    if (profile?.role === 'super_admin') {
      router.push('/admin/support')
    } else {
      router.push('/company-dashboard/support')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button
            onClick={handleBack}
            className="mt-3 text-sm underline hover:no-underline"
          >
            ← Back to Support Tickets
          </button>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ticket not found</h3>
          <p className="text-gray-600 mb-4">
            The ticket you're looking for doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={handleBack}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            ← Back to Support Tickets
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <div className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusBadge(ticket.status)}`}>
              {getStatusIcon(ticket.status)}
              {ticket.status.replace('_', ' ')}
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(ticket.priority)}`}>
              {ticket.priority}
            </div>
            <span className="text-sm text-gray-500">
              {ticket.category}
            </span>
          </div>
        </div>
      </div>

      {/* Ticket Info */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-900">Created by:</span>
            <div className="flex items-center gap-1 mt-1">
              <User className="w-4 h-4 text-gray-500" />
              <span>{ticket.creator?.full_name || ticket.creator?.email || 'Unknown User'}</span>
            </div>
          </div>
          
          {profile?.role === 'super_admin' && (
            <div>
              <span className="font-medium text-gray-900">Company:</span>
              <div className="flex items-center gap-1 mt-1">
                <Building className="w-4 h-4 text-gray-500" />
                <span>{ticket.companies?.name || 'Unknown Company'}</span>
              </div>
            </div>
          )}
          
          {ticket.assignee && (
            <div>
              <span className="font-medium text-gray-900">Assigned to:</span>
              <div className="flex items-center gap-1 mt-1">
                <User className="w-4 h-4 text-gray-500" />
                <span>{ticket.assignee.full_name || ticket.assignee.email}</span>
              </div>
            </div>
          )}
          
          <div>
            <span className="font-medium text-gray-900">Created:</span>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>{formatMessageTime(ticket.created_at)}</span>
            </div>
          </div>
        </div>
        
        {ticket.description && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <span className="font-medium text-gray-900">Description:</span>
            <p className="mt-1 text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Conversation</h2>
        </div>
        
        <div className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No messages yet. Start the conversation below.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.user_id === user.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.user_id === user.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {message.user_id === user.id 
                        ? 'You' 
                        : message.sender?.full_name || message.sender?.email || 'Unknown User'
                      }
                    </span>
                    {message.sender?.role === 'super_admin' && (
                      <span className="text-xs bg-red-100 text-red-800 px-1 rounded">
                        Support
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  <div className={`text-xs mt-1 ${
                    message.user_id === user.id ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatMessageTime(message.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}