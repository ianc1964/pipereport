'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle, AlertCircle, Building2 } from 'lucide-react'

export default function AcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [invitationValid, setInvitationValid] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    // Check if this is an invitation acceptance
    const checkInvitation = async () => {
      try {
        setVerifying(true)
        
        // Get the session from the URL fragments (Supabase puts auth data there)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setError('Invalid invitation link. Please contact your administrator.')
          return
        }

        if (!session) {
          setError('No valid invitation found. Please use the link from your invitation email.')
          return
        }

        // Get user info
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          setError('Unable to verify invitation. Please contact your administrator.')
          return
        }

        // Get profile info to show company details
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            *,
            companies (
              id,
              name
            )
          `)
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Profile error:', profileError)
          setError('Unable to load user information. Please contact your administrator.')
          return
        }

        // Check if user already has a password set
        if (user.app_metadata?.provider === 'email' && !user.user_metadata?.invitation_accepted) {
          setUserInfo({
            email: user.email,
            fullName: profile.full_name,
            role: profile.role,
            companyName: profile.companies?.name
          })
          setInvitationValid(true)
        } else if (user.user_metadata?.invitation_accepted) {
          // User has already accepted invitation
          setSuccess('Invitation already accepted! Redirecting to login...')
          setTimeout(() => router.push('/auth/login'), 2000)
        } else {
          setError('This invitation link is not valid or has already been used.')
        }

      } catch (error) {
        console.error('Invitation verification error:', error)
        setError('An error occurred while verifying your invitation.')
      } finally {
        setVerifying(false)
      }
    }

    checkInvitation()
  }, [router])

  const handleAcceptInvitation = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate passwords
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long')
        return
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match')
        return
      }

      // Update the user's password and mark invitation as accepted
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.password,
        data: {
          invitation_accepted: true
        }
      })

      if (updateError) {
        setError('Failed to set password: ' + updateError.message)
        return
      }

      // Activate the user's profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', (await supabase.auth.getUser()).data.user?.id)

      if (profileError) {
        console.error('Profile activation error:', profileError)
        // Don't fail the whole process for this
      }

      setSuccess('Password set successfully! You can now access your account.')
      
      // Redirect to the main app after a brief delay
      setTimeout(() => {
        router.push('/')
      }, 2000)

    } catch (error) {
      console.error('Password setup error:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <p className="mt-4 text-center text-gray-600">Verifying invitation...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !invitationValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-center text-2xl font-bold text-gray-900 mb-4">
              Invitation Error
            </h2>
            <p className="text-center text-red-600 mb-6">{error}</p>
            <div className="text-center">
              <Link
                href="/auth/login"
                className="text-blue-600 hover:text-blue-500"
              >
                Go to Login →
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="text-center text-2xl font-bold text-gray-900 mb-4">
              Welcome!
            </h2>
            <p className="text-center text-green-600 mb-6">{success}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center mb-6">
          <Building2 className="h-12 w-12 text-blue-600" />
        </div>
        <h2 className="text-center text-3xl font-bold text-gray-900">
          Complete Your Account
        </h2>
        <p className="mt-2 text-center text-gray-600">
          You've been invited to join {userInfo?.companyName}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* User Info */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Account Details</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <div><strong>Email:</strong> {userInfo?.email}</div>
              <div><strong>Name:</strong> {userInfo?.fullName}</div>
              <div><strong>Role:</strong> {userInfo?.role === 'company_admin' ? 'Company Admin' : 'User'}</div>
              <div><strong>Company:</strong> {userInfo?.companyName}</div>
            </div>
          </div>

          <form onSubmit={handleAcceptInvitation} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Create Password
              </label>
              <div className="mt-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Minimum 6 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="mt-1 relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm your password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Setting up account...' : 'Complete Setup'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              After completing setup, you can log in with your email and password.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}