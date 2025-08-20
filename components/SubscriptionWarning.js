'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { getSubscriptionStatus } from '@/lib/subscriptions'
import { 
  AlertTriangle,
  X,
  CreditCard,
  Clock
} from 'lucide-react'

export default function SubscriptionWarning() {
  const { user, profile, company } = useAuth()
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [showWarning, setShowWarning] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  
  // Track if warning has been shown this session
  const warningShownThisSession = useRef(false)
  const hasCheckedSubscription = useRef(false)

  useEffect(() => {
    const checkSubscription = async () => {
      // Skip if no user or company
      if (!user || !profile || !company?.id) return
      
      // Skip for super admins
      if (profile.role === 'super_admin') return
      
      // Skip if already checked this session
      if (hasCheckedSubscription.current) return
      
      // Skip if warning already shown this session
      if (warningShownThisSession.current) return
      
      // Check sessionStorage to see if dismissed this session
      const sessionDismissed = sessionStorage.getItem(`subscription-warning-dismissed-${company.id}`)
      if (sessionDismissed === 'true') {
        warningShownThisSession.current = true
        return
      }
      
      try {
        console.log('SubscriptionWarning: Checking subscription status (first time this session)')
        const status = await getSubscriptionStatus(company.id)
        setSubscriptionStatus(status)
        hasCheckedSubscription.current = true
        
        // Show warning if subscription expires in 7 days or less
        if (status && status.days_remaining !== null && status.days_remaining <= 7 && status.days_remaining > 0) {
          setShowWarning(true)
          warningShownThisSession.current = true
          console.log('SubscriptionWarning: Showing warning for', status.days_remaining, 'days remaining')
        } else {
          console.log('SubscriptionWarning: No warning needed, days remaining:', status?.days_remaining)
        }
      } catch (error) {
        console.error('Error checking subscription for warning:', error)
        hasCheckedSubscription.current = true
      }
    }
    
    checkSubscription()
  }, [user, profile, company]) // Removed 'dismissed' dependency

  const handleDismiss = () => {
    setDismissed(true)
    setShowWarning(false)
    warningShownThisSession.current = true
    
    // Store dismissal in sessionStorage so it persists for this session
    if (company?.id) {
      sessionStorage.setItem(`subscription-warning-dismissed-${company.id}`, 'true')
    }
    
    console.log('SubscriptionWarning: Dismissed for this session')
  }

  // Don't render if no warning needed
  if (!showWarning || dismissed) return null

  const daysRemaining = subscriptionStatus?.days_remaining || 0
  const isLastDay = daysRemaining === 1
  const isTrial = subscriptionStatus?.status === 'trialing'

  return (
    <div className={`
      fixed bottom-4 right-4 max-w-md w-full md:w-auto z-50
      ${isLastDay ? 'animate-pulse' : ''}
    `}>
      <div className={`
        rounded-lg shadow-lg p-4 border-2
        ${isLastDay 
          ? 'bg-red-50 border-red-300' 
          : daysRemaining <= 3 
            ? 'bg-orange-50 border-orange-300'
            : 'bg-yellow-50 border-yellow-300'
        }
      `}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertTriangle className={`
              w-6 h-6
              ${isLastDay 
                ? 'text-red-600' 
                : daysRemaining <= 3 
                  ? 'text-orange-600'
                  : 'text-yellow-600'
              }
            `} />
          </div>
          <div className="ml-3 flex-1">
            <h3 className={`
              text-sm font-semibold
              ${isLastDay 
                ? 'text-red-900' 
                : daysRemaining <= 3 
                  ? 'text-orange-900'
                  : 'text-yellow-900'
              }
            `}>
              {isTrial ? 'Trial Period' : 'Subscription'} Expiring Soon
            </h3>
            <div className={`
              mt-1 text-sm
              ${isLastDay 
                ? 'text-red-700' 
                : daysRemaining <= 3 
                  ? 'text-orange-700'
                  : 'text-yellow-700'
              }
            `}>
              <p className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {isLastDay 
                  ? `Expires today!` 
                  : `${daysRemaining} days remaining`
                }
              </p>
              <p className="mt-1">
                Your access will be blocked when it expires, but your credits will be preserved.
              </p>
            </div>
            <div className="mt-3">
              <Link
                href="/account/subscription"
                className={`
                  inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition
                  ${isLastDay 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : daysRemaining <= 3 
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-yellow-600 text-white hover:bg-yellow-700'
                  }
                `}
              >
                <CreditCard className="w-3 h-3 mr-1" />
                Renew Now
              </Link>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleDismiss}
              className={`
                rounded-md inline-flex focus:outline-none focus:ring-2 focus:ring-offset-2
                ${isLastDay 
                  ? 'text-red-400 hover:text-red-500 focus:ring-red-500' 
                  : daysRemaining <= 3 
                    ? 'text-orange-400 hover:text-orange-500 focus:ring-orange-500'
                    : 'text-yellow-400 hover:text-yellow-500 focus:ring-yellow-500'
                }
              `}
            >
              <span className="sr-only">Dismiss</span>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}