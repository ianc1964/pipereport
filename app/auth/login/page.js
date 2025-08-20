'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { AlertCircle, CheckCircle, Shield } from 'lucide-react'
import { trackLogin } from '@/lib/actions/ip-tracking'
import { recordFingerprint } from '@/lib/actions/fingerprint-tracking'
import DeviceFingerprint from '@/lib/device-fingerprint'

export default function LoginPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading, isSuperAdmin, isCompanyAdmin, isUser } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const [fingerprintData, setFingerprintData] = useState(null)
  const [generatingFingerprint, setGeneratingFingerprint] = useState(false)
  const hasRedirected = useRef(false)
  const fingerprintGenerated = useRef(false)
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  // Generate device fingerprint on page load
  useEffect(() => {
    if (!fingerprintGenerated.current) {
      fingerprintGenerated.current = true
      generateFingerprint()
    }
  }, [])

  // Check for error parameters in URL hash
  useEffect(() => {
    // Check URL hash for Supabase errors
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const errorCode = params.get('error_code')
      const errorDescription = params.get('error_description')
      
      if (errorCode === 'otp_expired') {
        setError('Your email confirmation link has expired. Please sign up again or contact support if you need assistance.')
      } else if (errorCode) {
        setError(errorDescription || 'An authentication error occurred. Please try again.')
      }
      
      // Clean up the URL
      window.history.replaceState(null, '', window.location.pathname)
    }

    // Check URL search params for success messages
    const searchParams = new URLSearchParams(window.location.search)
    const message = searchParams.get('message')
    if (message === 'password_reset') {
      setSuccess('Check your email for a password reset link.')
      // Clean up the URL
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Redirect if already logged in and profile is loaded
  useEffect(() => {
    // Prevent multiple redirects
    if (hasRedirected.current || redirecting) {
      return
    }

    // Only redirect if auth is not loading and we have both user and profile
    if (!authLoading && user && profile) {
      hasRedirected.current = true
      setRedirecting(true)
      
      console.log('Redirecting user:', user.email, 'Role:', profile.role)
      
      // Small delay to ensure auth context is fully settled
      setTimeout(() => {
        if (isSuperAdmin) {
          router.push('/admin')
        } else if (isCompanyAdmin) {
          router.push('/company-dashboard')
        } else {
          router.push('/')
        }
      }, 100)
    }
  }, [user, profile, authLoading, isSuperAdmin, isCompanyAdmin, router, redirecting])

  async function generateFingerprint() {
    try {
      setGeneratingFingerprint(true)
      
      // Generate device fingerprint
      const fingerprinter = new DeviceFingerprint()
      const fingerprint = await fingerprinter.generate()
      
      console.log('Device fingerprint generated for login with confidence:', fingerprint.confidence)
      setFingerprintData(fingerprint)
    } catch (error) {
      console.error('Error generating fingerprint:', error)
      // Don't block login if fingerprinting fails
    } finally {
      setGeneratingFingerprint(false)
    }
  }

  async function handleSignIn(e) {
    e.preventDefault()
    
    // Don't submit if already submitting or redirecting
    if (submitting || redirecting) {
      return
    }
    
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email.trim().toLowerCase(), // Normalize email
        password: formData.password
      })

      if (error) throw error

      console.log('Login successful')
      
      // Track the login with IP address
      if (data?.user?.id) {
        trackLogin(data.user.id, 'login').then(result => {
          if (result.success) {
            console.log('Login tracked from IP:', result.ip)
          }
        }).catch(err => {
          console.error('Failed to track login:', err)
          // Don't block login if tracking fails
        })
      }

      // Record device fingerprint after successful login
      if (fingerprintData && data?.user?.id) {
        try {
          // First, get the user's profile to get company_id
          const { data: profileData } = await supabase
            .from('profiles')
            .select('company_id, role')
            .eq('id', data.user.id)
            .single()

          // Only record fingerprint if user has a company (skip for super_admins)
          if (profileData?.company_id) {
            await recordFingerprint({
              fingerprintHash: fingerprintData.hash,
              fingerprintData: fingerprintData.components,
              confidence: fingerprintData.confidence,
              userId: data.user.id,
              companyId: profileData.company_id,
              loginType: 'login'
            })
            console.log('Device fingerprint recorded for login')
          } else if (profileData?.role === 'super_admin') {
            console.log('Skipping fingerprint recording for super admin (no company)')
          }
        } catch (fpError) {
          console.error('Failed to record fingerprint:', fpError)
          // Don't block login if fingerprint recording fails
        }
      }

      setSuccess('Login successful! Redirecting...')
      
      // Wait a moment for auth context to update
      // The useEffect above will handle the actual redirect
      setTimeout(() => {
        // If still not redirected after 3 seconds, try manual redirect
        if (!hasRedirected.current) {
          console.log('Manual redirect fallback')
          window.location.href = '/'
        }
      }, 3000)
      
    } catch (error) {
      console.error('Login error:', error)
      
      // Provide more specific error messages
      if (error.message === 'Invalid login credentials') {
        setError('Invalid email or password. Please check your credentials and try again.')
      } else if (error.message === 'Email not confirmed') {
        setError('Please confirm your email address before logging in. Check your inbox for the confirmation link.')
      } else if (error.message?.includes('rate limit')) {
        setError('Too many login attempts. Please wait a few minutes and try again.')
      } else if (error.message?.includes('network')) {
        setError('Network error. Please check your connection and try again.')
      } else {
        setError(error.message || 'An error occurred during login. Please try again.')
      }
      
      setSubmitting(false)
    }
  }

  // Show loading state while auth is initializing
  if (authLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-500 mb-2">Loading...</div>
          <div className="text-sm text-gray-400">Please wait while we check your authentication status</div>
        </div>
      </div>
    )
  }

  // Show redirecting state
  if (redirecting || (user && profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-500 mb-2">Redirecting...</div>
          <div className="text-sm text-gray-400">Taking you to your dashboard</div>
        </div>
      </div>
    )
  }

  const isLoading = submitting

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        {/* Device fingerprint status - subtle indicator */}
        {generatingFingerprint && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-center text-sm text-gray-600">
              <Shield className="w-4 h-4 mr-2 animate-pulse" />
              <span>Securing connection...</span>
            </div>
          </div>
        )}

        {fingerprintData && !generatingFingerprint && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-center text-sm text-green-700">
              <Shield className="w-4 h-4 mr-2" />
              <span>Secure connection established</span>
            </div>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md text-sm flex items-start">
              <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link 
                  href="/auth/reset-password" 
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center space-y-2">
            <Link href="/auth/signup" className="block text-sm text-blue-600 hover:text-blue-500">
              Don't have an account? Sign up
            </Link>
            <div className="text-xs text-gray-500 mt-4">
              Having trouble? Contact support at support@example.com
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}