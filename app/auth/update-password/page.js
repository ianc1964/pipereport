'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)
  const [checkingToken, setCheckingToken] = useState(true)

  // Check if we have a valid recovery token
  useEffect(() => {
    const checkRecoveryToken = async () => {
      try {
        // Check URL hash for error parameters
        const hash = window.location.hash
        if (hash) {
          const params = new URLSearchParams(hash.substring(1))
          const errorCode = params.get('error_code')
          const errorDescription = params.get('error_description')
          
          if (errorCode) {
            if (errorCode === 'otp_expired') {
              setError('This password reset link has expired. Please request a new one.')
            } else {
              setError(errorDescription || 'Invalid or expired reset link. Please request a new one.')
            }
            setCheckingToken(false)
            return
          }
        }

        // Get the current session to check if we're in recovery mode
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setError('Unable to verify reset link. Please try again.')
          setCheckingToken(false)
          return
        }

        // Check if we're in recovery mode (user clicked reset link)
        if (session?.user?.recovery_token || session?.user?.email) {
          setIsValidToken(true)
        } else {
          setError('No valid password reset token found. Please request a new reset link.')
        }
      } catch (err) {
        console.error('Token check error:', err)
        setError('An error occurred. Please request a new password reset.')
      } finally {
        setCheckingToken(false)
      }
    }

    checkRecoveryToken()
  }, [])

  async function handleUpdatePassword(e) {
    e.preventDefault()
    
    // Reset errors
    setError(null)
    
    // Validate passwords
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setSuccess(true)
      
      // Sign out the user to ensure clean state
      await supabase.auth.signOut()
      
      // Redirect to login page after 3 seconds
      setTimeout(() => {
        router.push('/auth/login')
      }, 3000)
      
    } catch (error) {
      console.error('Password update error:', error)
      
      // Provide user-friendly error messages
      if (error.message.includes('same as the old')) {
        setError('New password must be different from your current password.')
      } else if (error.message.includes('weak')) {
        setError('Password is too weak. Please choose a stronger password.')
      } else {
        setError('Unable to update password. Please try again or contact support.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Show loading state while checking token
  if (checkingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Verifying reset link...</div>
      </div>
    )
  }

  // Show error state if token is invalid
  if (!isValidToken && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-red-50 border border-red-200 p-6 rounded-md text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-red-900 mb-2">
              Invalid Reset Link
            </h3>
            <p className="text-sm text-red-700 mb-4">
              {error || 'This password reset link is invalid or has expired.'}
            </p>
            <Link 
              href="/auth/reset-password" 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              Request new reset link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Set new password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please enter your new password below.
          </p>
        </div>
        
        {!success ? (
          <form className="mt-8 space-y-6" onSubmit={handleUpdatePassword}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter new password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Confirm new password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-8">
            <div className="bg-green-50 border border-green-200 p-6 rounded-md text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-green-900 mb-2">
                Password updated successfully!
              </h3>
              <p className="text-sm text-green-700 mb-4">
                Your password has been changed. You will be redirected to the login page.
              </p>
              <Link 
                href="/auth/login" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                Go to login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}