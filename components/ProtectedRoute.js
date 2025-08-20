'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function ProtectedRoute({ children, allowedRoles = [], requireCredits = false }) {
  const { user, profile, loading, hasCredits } = useAuth()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const hasCheckedAuth = useRef(false)

  useEffect(() => {
    // If we've already checked and user exists, fast-track authorization
    if (hasCheckedAuth.current && user && profile) {
      // Quick re-check of authorization without showing loading
      if (allowedRoles.length === 0 || allowedRoles.includes(profile.role)) {
        setIsAuthorized(true)
        setIsChecking(false)
        return
      }
    }

    // Skip checks while auth context is loading
    if (loading) {
      return
    }

    // Mark that we've done the initial auth check
    hasCheckedAuth.current = true

    // Not authenticated
    if (!user) {
      setIsChecking(false)
      router.push('/auth/login')
      return
    }

    // Wait for profile to load
    if (!profile) {
      // Profile might still be loading even if auth loading is false
      return
    }

    // Check role requirements
    if (allowedRoles.length > 0) {
      if (!allowedRoles.includes(profile.role)) {
        setIsChecking(false)
        router.push('/unauthorized')
        return
      }
    }

    // Check credit requirements
    if (requireCredits && !hasCredits) {
      setIsChecking(false)
      router.push('/no-credits')
      return
    }

    // All checks passed
    setIsAuthorized(true)
    setIsChecking(false)
  }, [loading, user, profile, hasCredits, router, allowedRoles, requireCredits])

  // Show loading only during initial auth check
  if (loading || (isChecking && !hasCheckedAuth.current)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  // Still checking but we've done initial auth (waiting for profile)
  if (isChecking && !isAuthorized) {
    // Don't show spinner, just wait
    return null
  }

  // Not authorized
  if (!isAuthorized) {
    return null
  }

  // Authorized - render children
  return children
}