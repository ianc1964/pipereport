'use client'

import { useAuth } from '../../../../lib/auth-context'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import TicketChatView from '../../../../components/TicketChatView'

export default function AdminSupportTicketPage({ params }) {
  const { user, profile, loading } = useAuth()

  // Debug info - remove this after testing
  console.log('Admin Support Ticket Page - Auth Debug:', {
    user: !!user,
    profile: profile,
    loading: loading,
    role: profile?.role,
    ticketId: params.ticketId
  })

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <div className="min-h-screen bg-gray-50">
        <div className="pt-6">
          <nav className="mb-4 px-6">
            <ol className="flex items-center space-x-2 text-sm text-gray-500">
              <li>
                <a href="/admin" className="hover:text-gray-700">
                  Admin Dashboard
                </a>
              </li>
              <li>
                <span className="mx-2">/</span>
                <a href="/admin/support" className="hover:text-gray-700">
                  Support Tickets
                </a>
              </li>
              <li>
                <span className="mx-2">/</span>
                <span className="text-gray-900">Ticket Details</span>
              </li>
            </ol>
          </nav>
          
          <TicketChatView ticketId={params.ticketId} />
        </div>
      </div>
    </ProtectedRoute>
  )
}