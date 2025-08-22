'use client'

import { useAuth } from '../../lib/auth-context'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function UnauthorizedPage() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Determine appropriate home page based on user role
  const getHomePage = () => {
    if (!profile) return '/auth/login'
    
    switch (profile.role) {
      case 'super_admin':
        return '/admin'
      case 'company_admin':
        return '/company-dashboard'
      case 'user':
        return '/'
      default:
        return '/'
    }
  }

  const homePage = getHomePage()
  const homePageName = profile?.role === 'super_admin' ? 'Admin Dashboard' 
                     : profile?.role === 'company_admin' ? 'Company Dashboard'
                     : 'Dashboard'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 rounded-full p-3">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. This area is restricted to authorized users only.
          </p>
          
          {profile && (
            <div className="bg-gray-50 rounded-lg p-3 mb-6 text-sm">
              <p className="text-gray-700">
                <span className="font-medium">Your role:</span> {profile.role?.replace('_', ' ')}
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <Link
              href={homePage}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to {homePageName}
            </Link>
            
            <Link
              href="/auth/login"
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
            >
              Sign in with different account
            </Link>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              If you believe this is an error, please contact your administrator or support team.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}