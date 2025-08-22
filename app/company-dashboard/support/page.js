'use client'

import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import SupportTicketsList from '@/components/SupportTicketsList'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function CompanySupportPage() {
  const { company } = useAuth()

  return (
    <ProtectedRoute allowedRoles={['company_admin', 'super_admin']}>
      <div className="min-h-screen bg-gray-50">
        {/* Breadcrumb Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Link 
                href="/company-dashboard" 
                className="flex items-center hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Company Dashboard
              </Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">Support Tickets</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="py-6">
          <SupportTicketsList />
        </div>
      </div>
    </ProtectedRoute>
  )
}