'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { getSubscriptionStatus } from '@/lib/subscriptions'
import { 
  AlertCircle, 
  CreditCard, 
  Coins,
  Clock,
  Phone,
  Mail,
  Loader2,
  LogOut
} from 'lucide-react'

export default function SubscriptionGate({ children }) {
  const { user, profile, company, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timedOut, setTimedOut] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const checkSubscription = async () => {
      // Skip check if auth is still loading
      if (authLoading) {
        return
      }
      
      // Mark that we've done a check
      setHasChecked(true)
      
      // Skip check if user is not logged in
      if (!user || !profile) {
        setLoading(false)
        return
      }
      
      // Super admins bypass all subscription checks
      if (profile.role === 'super_admin') {
        setLoading(false)
        return
      }
      
      // If user has no company, block access (except super admins)
      if (!company?.id) {
        setLoading(false)
        return
      }
      
      try {
        // Get subscription status
        const status = await getSubscriptionStatus(company.id)
        setSubscriptionStatus(status)
      } catch (error) {
        console.error('SubscriptionGate: Error checking subscription:', error)
      } finally {
        setLoading(false)
      }
    }
    
    checkSubscription()
  }, [user, profile, company, authLoading])

  // Set loading to false once auth completes, even if subscription check hasn't run
  useEffect(() => {
    if (!authLoading && hasChecked) {
      setLoading(false)
    }
  }, [authLoading, hasChecked])

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.error('SubscriptionGate: Loading timeout - forcing completion')
        setTimedOut(true)
        setLoading(false)
      }
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeout)
  }, [loading])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Error logging out:', error)
      setLoggingOut(false)
    }
  }

  // Show loading state
  if ((loading || authLoading) && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Checking subscription status...</p>
        </div>
      </div>
    )
  }
  
  // Show timeout error
  if (timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Error</h2>
            <p className="text-gray-600 mb-6">
              The application took too long to load. This might be a temporary issue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Not logged in - let auth routes handle this
  if (!user || !profile) {
    return children
  }
  
  // Super admin - always allow
  if (profile.role === 'super_admin') {
    return children
  }
  
  // No company assigned
  if (!company?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Company Assigned</h2>
            <p className="text-gray-600 mb-4">
              Your account is not associated with any company. Please contact your administrator.
            </p>
            
            {/* Show user info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Email:</span> {user?.email}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Role:</span> {profile?.role}
              </p>
            </div>
            
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loggingOut ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-5 h-5 mr-2" />
                  Sign Out
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Check if subscription is expired
  const isExpired = subscriptionStatus?.status === 'expired' || 
                    subscriptionStatus?.status === 'cancelled'
  const isTrial = subscriptionStatus?.status === 'trialing'
  
  // Block access if expired
  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mb-6">
              <Clock className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isTrial ? 'Trial Period Ended' : 'Subscription Expired'}
              </h2>
              <p className="text-gray-600">
                Your {isTrial ? 'trial period' : 'subscription'} has ended. 
                Please renew to continue using the application.
              </p>
            </div>
            
            {/* Show current credit balance */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Coins className="w-6 h-6 text-blue-600" />
                <span className="text-lg font-semibold text-blue-900">Your Credit Balance</span>
              </div>
              <p className="text-3xl font-bold text-blue-700">
                {company?.user_credits?.balance?.toLocaleString() || 0} credits
              </p>
              <p className="text-sm text-blue-600 mt-2">
                Your credits will be preserved and available when you resubscribe
              </p>
            </div>
            
            {/* Actions */}
            <div className="space-y-3">
              <Link
                href="/account/subscription"
                className="block w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <CreditCard className="w-5 h-5 inline mr-2" />
                View Subscription Options
              </Link>
              
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="block w-full px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loggingOut ? (
                  <Loader2 className="w-5 h-5 inline animate-spin" />
                ) : (
                  'Sign Out'
                )}
              </button>
            </div>
            
            {/* Support info */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-3">Need help? Contact us:</p>
              <div className="flex justify-center space-x-6 text-sm">
                <a href="mailto:support@example.com" className="flex items-center text-blue-600 hover:text-blue-700">
                  <Mail className="w-4 h-4 mr-1" />
                  support@example.com
                </a>
                <a href="tel:+442012345678" className="flex items-center text-blue-600 hover:text-blue-700">
                  <Phone className="w-4 h-4 mr-1" />
                  +44 20 1234 5678
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // Subscription is active - allow access
  return children
}