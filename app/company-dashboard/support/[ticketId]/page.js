import ProtectedRoute from '../../../../components/ProtectedRoute'
import TicketChatView from '../../../../components/TicketChatView'

export default function CompanySupportTicketPage({ params }) {
  return (
    <ProtectedRoute allowedRoles={['company_admin', 'user']}>
      <div className="min-h-screen bg-gray-50">
        <div className="pt-6">
          <nav className="mb-4 px-6">
            <ol className="flex items-center space-x-2 text-sm text-gray-500">
              <li>
                <a href="/company-dashboard" className="hover:text-gray-700">
                  Company Dashboard
                </a>
              </li>
              <li>
                <span className="mx-2">/</span>
                <a href="/company-dashboard/support" className="hover:text-gray-700">
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