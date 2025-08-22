'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import NewTicketForm from './NewTicketForm'
import { MessageCircle, Plus, Clock, AlertCircle, CheckCircle, XCircle, User, Building } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SupportTicketsList() {
  const { user, profile, company, loading: authLoading } = useAuth()
  const router = useRouter()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [showNewTicketForm, setShowNewTicketForm] = useState(false)

  // Load tickets function (extracted to be reusable)
  const loadTickets = async () => {
    if (!profile) return
    
    try {
      setLoading(true)
      setError('')
      
      let query = supabase
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
        .order('last_message_at', { ascending: false })

      // Filter based on user role - add null checks
      if (profile?.role !== 'super_admin') {
        if (!company?.id) {
          console.warn('No company ID available for non-super-admin user')
          setTickets([])
          return
        }
        query = query.eq('company_id', company.id)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      setTickets(data || [])
    } catch (error) {
      console.error('Error loading support tickets:', error)
      setError('Failed to load support tickets')
    } finally {
      setLoading(false)
    }
  }

  // Load tickets based on user role
  useEffect(() => {
    if (authLoading || !profile) return
    
    // For non-super admins, also need company to be available
    if (profile?.role !== 'super_admin' && !company) return
    
    let isCancelled = false
    const loadTicketsIfNotCancelled = async () => {
      if (!isCancelled) {
        await loadTickets()
      }
    }

    loadTicketsIfNotCancelled()
    return () => { isCancelled = true }
  }, [profile, company, authLoading])

  // Handle new ticket creation
  const handleTicketCreated = async (newTicket) => {
    // Refresh the tickets list to include the new ticket
    await loadTickets()
  }

  // Filter tickets by status
  const filteredTickets = tickets.filter(ticket => {
    if (selectedStatus === 'all') return true
    return ticket.status === selectedStatus
  })

  // Get status badge styling
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

  // Get priority badge styling
  const getPriorityBadge = (priority) => {
    const styles = {
      low: 'bg-gray-100 text-gray-600',
      normal: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      urgent: 'bg-red-100 text-red-600'
    }
    
    return styles[priority] || styles.normal
  }

  // Get status icon
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

  // Format relative time
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    
    return date.toLocaleDateString()
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Handle authentication transition (sign out, etc.) gracefully
  if (!profile) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-gray-600 mt-1">
            {profile?.role === 'super_admin' 
              ? 'Manage support tickets from all companies' 
              : 'Get help from our support team'
            }
          </p>
        </div>
        
        {profile?.role !== 'super_admin' && (
          <button
            onClick={() => setShowNewTicketForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'all', label: 'All Tickets', count: tickets.length },
          { key: 'open', label: 'Open', count: tickets.filter(t => t.status === 'open').length },
          { key: 'in_progress', label: 'In Progress', count: tickets.filter(t => t.status === 'in_progress').length },
          { key: 'waiting_for_customer', label: 'Waiting', count: tickets.filter(t => t.status === 'waiting_for_customer').length },
          { key: 'resolved', label: 'Resolved', count: tickets.filter(t => t.status === 'resolved').length }
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setSelectedStatus(filter.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              selectedStatus === filter.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
            <p className="text-gray-600">
              {selectedStatus === 'all' 
                ? "You don't have any support tickets yet." 
                : `No tickets with status "${selectedStatus}".`
              }
            </p>
            {profile?.role !== 'super_admin' && selectedStatus === 'all' && (
              <button
                onClick={() => setShowNewTicketForm(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Create Your First Ticket
              </button>
            )}
          </div>
        ) : (
          filteredTickets.map(ticket => (
            <div
              key={ticket.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                const basePath = profile?.role === 'super_admin' ? '/admin/support' : '/company-dashboard/support'
                router.push(`${basePath}/${ticket.id}`)
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Title and Status */}
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {ticket.title}
                    </h3>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusBadge(ticket.status)}`}>
                      {getStatusIcon(ticket.status)}
                      {ticket.status.replace('_', ' ')}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(ticket.priority)}`}>
                      {ticket.priority}
                    </div>
                  </div>

                  {/* Description */}
                  {ticket.description && (
                    <p className="text-gray-600 mb-3 line-clamp-2">
                      {ticket.description}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {ticket.category}
                    </div>
                    
                    {profile?.role === 'super_admin' && (
                      <div className="flex items-center gap-1">
                        <Building className="w-4 h-4" />
                        {ticket.companies?.name || 'Unknown Company'}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {ticket.creator?.full_name || ticket.creator?.email || 'Unknown User'}
                    </div>
                    
                    {ticket.assignee && (
                      <div className="flex items-center gap-1">
                        <span>Assigned to:</span>
                        <span className="font-medium">{ticket.assignee.full_name || ticket.assignee.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <div className="text-sm text-gray-500 ml-4 text-right whitespace-nowrap">
                  <div>Updated {formatRelativeTime(ticket.last_message_at)}</div>
                  <div className="text-xs mt-1">
                    Created {formatRelativeTime(ticket.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Ticket Form Modal */}
      <NewTicketForm
        isOpen={showNewTicketForm}
        onClose={() => setShowNewTicketForm(false)}
        onTicketCreated={handleTicketCreated}
      />
    </div>
  )
}