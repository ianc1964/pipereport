'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AlertCircle, CheckCircle, Mail, CreditCard, Calendar, Shield, AlertTriangle } from 'lucide-react'
import { trackLogin } from '@/lib/actions/ip-tracking'
import SimpleDeviceFingerprint from '@/lib/device-fingerprint-simple'
import { checkFingerprintForTrial, recordFingerprint } from '@/lib/actions/fingerprint-tracking'

export default function SignUpPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showResendEmail, setShowResendEmail] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [trialPlan, setTrialPlan] = useState(null)
  const [fingerprintData, setFingerprintData] = useState(null)
  const [fingerprintWarning, setFingerprintWarning] = useState(null)
  const [checkingDevice, setCheckingDevice] = useState(true)
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    companyName: '',
    acceptTerms: false
  })

  // Load trial plan details and generate device fingerprint
  useEffect(() => {
    loadTrialPlan()
    generateFingerprint()
  }, [])

  // Check for error parameters in URL
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const errorCode = params.get('error_code')
      const errorDescription = params.get('error_description')
      
      if (errorCode === 'otp_expired') {
        setError('Your email confirmation link has expired. Please sign up again or use the form below to resend the confirmation email.')
        setShowResendEmail(true)
      } else if (errorCode) {
        setError(errorDescription || 'An error occurred. Please try again.')
      }
      
      // Clean up the URL
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function loadTrialPlan() {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .ilike('name', 'trial')
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading trial plan:', error)
      }

      setTrialPlan(data)
    } catch (error) {
      console.error('Error loading trial plan:', error)
    }
  }

  async function generateFingerprint() {
    try {
      setCheckingDevice(true)
      console.log('Starting device fingerprint generation...')
      
      // Use the correct DeviceFingerprint class
      const fingerprinter = new SimpleDeviceFingerprint() // FIXED: Use correct class name
      const fingerprint = await fingerprinter.generate()
      
      console.log('Device fingerprint generated successfully!')
      console.log('Fingerprint hash:', fingerprint.hash)
      console.log('Confidence score:', fingerprint.confidence)
      
      setFingerprintData(fingerprint)

      // Check if this device has been used for a trial before
      try {
        const fingerprintCheck = await checkFingerprintForTrial(fingerprint.hash)
        console.log('Fingerprint check result:', fingerprintCheck)
        
        if (fingerprintCheck.success) {
          if (fingerprintCheck.isBlocked) {
            setFingerprintWarning({
              type: 'blocked',
              message: 'This device has been blocked from creating new trial accounts.',
              canProceed: false
            })
          } else if (fingerprintCheck.trialCount > 0) {
            setFingerprintWarning({
              type: 'warning',
              message: 'A trial account has already been created from this device.',
              canProceed: false,
              existingCompanies: fingerprintCheck.existingCompanies || []
            })
          } else {
            console.log('Device fingerprint is clean - no existing trials')
          }
        }
      } catch (checkError) {
        console.error('Error checking fingerprint:', checkError)
        // Don't block signup if check fails
      }
    } catch (error) {
      console.error('Error generating fingerprint:', error)
      // Don't block signup if fingerprinting fails completely
      setFingerprintData({ 
        hash: 'fallback-' + Date.now(), 
        components: {}, 
        confidence: 0 
      })
    } finally {
      setCheckingDevice(false)
    }
  }

  async function handleResendConfirmation(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setResendLoading(true)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail,
      })

      if (error) throw error

      setSuccess('Confirmation email sent! Please check your inbox.')
      setShowResendEmail(false)
      setResendEmail('')
    } catch (error) {
      console.error('Resend error:', error)
      setError('Unable to resend confirmation email. Please try signing up again.')
    } finally {
      setResendLoading(false)
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (!formData.acceptTerms) {
      setError('Please accept the terms and conditions')
      return
    }

    if (!formData.companyName.trim()) {
      setError('Company name is required')
      return
    }

    // Check if device fingerprint blocks signup
    if (fingerprintWarning && !fingerprintWarning.canProceed) {
      setError(
        <div>
          <p className="font-semibold mb-2">Trial Account Already Exists</p>
          <p className="text-sm mb-3">{fingerprintWarning.message}</p>
          {fingerprintWarning.existingCompanies && fingerprintWarning.existingCompanies.length > 0 && (
            <div className="mt-3 p-3 bg-red-100 rounded">
              <p className="text-xs font-semibold mb-1">Existing trial accounts from this device:</p>
              {fingerprintWarning.existingCompanies.map((company, idx) => (
                <p key={idx} className="text-xs">
                  • {company.name || 'Company'} {company.user_email ? `(${company.user_email})` : ''}
                </p>
              ))}
            </div>
          )}
          <p className="text-sm mt-3">
            Please <Link href="/auth/login" className="text-blue-600 underline">log in</Link> to your existing account.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Each device is limited to one trial account. If you believe this is an error, please contact support.
          </p>
        </div>
      )
      return
    }

    setLoading(true)
    
    let user = null
    let companyId = null

    try {
      console.log('Starting signup process...')
      
      // 1. Sign up user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName
          }
        }
      })

      if (signUpError) throw signUpError
      if (!authData?.user) throw new Error('No user returned from signup')
      
      user = authData.user
      console.log('User created:', user.id)
      
      // Track the signup with IP address (for additional monitoring)
      if (user?.id) {
        trackLogin(user.id, 'signup').catch(err => {
          console.error('Failed to track signup:', err)
        })
      }

      // 2. Wait a moment for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 3. Update the profile
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          email: user.email || formData.email,
          full_name: formData.fullName,
          is_active: true
        })
        .eq('id', user.id)
      
      if (profileUpdateError) {
        console.warn('Could not update profile:', profileUpdateError)
      }

      // 4. Create company with trial credits
      console.log('Creating company with trial plan...')
      
      try {
        const { data: companyData, error: companyError } = await supabase
          .rpc('create_company_with_trial', {
            company_name: formData.companyName.trim(),
            company_email: formData.email
          })
        
        if (companyError) {
          console.error('Company creation error:', companyError)
          throw new Error(`Failed to create company: ${companyError.message || 'Unknown error'}`)
        }
        
        if (!companyData) {
          throw new Error('Company creation returned no data')
        }
        
        companyId = companyData
        console.log('Company created with ID:', companyId)
        
      } catch (companyError) {
        console.error('Company creation failed:', companyError)
        throw new Error(`Failed to create company: ${companyError.message}`)
      }

      // 5. Record device fingerprint after successful signup
      if (fingerprintData && user?.id && companyId) {
        try {
          console.log('Recording device fingerprint...')
          await recordFingerprint({
            fingerprintHash: fingerprintData.hash,
            fingerprintData: fingerprintData.components,
            confidence: fingerprintData.confidence,
            userId: user.id,
            companyId: companyId,
            loginType: 'signup'
          })
          console.log('Device fingerprint recorded successfully')
        } catch (fpError) {
          console.error('Failed to record fingerprint:', fpError)
          // Don't fail signup if fingerprint recording fails
        }
      }

      // 6. Success message
      const trialCredits = trialPlan?.credits || 100
      const trialDays = (trialPlan?.duration_months || 1) * 30

      setSuccess(
        <div className="space-y-3">
          <p className="font-semibold text-lg">Registration successful!</p>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Account created for {formData.email}
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Company "{formData.companyName}" created
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {trialCredits} trial credits added
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {trialDays}-day trial period activated
            </p>
            <p className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              Device registered for this trial
            </p>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-gray-600">
              Please check your email to confirm your account, then{' '}
              <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
                log in
              </Link>
              {' '}to get started.
            </p>
          </div>
        </div>
      )

      // Clear form
      setFormData({
        email: '',
        password: '',
        fullName: '',
        companyName: '',
        acceptTerms: false
      })

    } catch (error) {
      console.error('Signup error:', error)
      
      if (error.message?.includes('already registered')) {
        setError('This email is already registered. Please log in instead.')
      } else {
        setError(error.message || 'An error occurred during signup')
      }
    } finally {
      setLoading(false)
    }
  }

  const getTrialDurationText = (months) => {
    if (months === 1) return '1 month'
    if (months < 1) return `${Math.round(months * 30)} days`
    return `${months} months`
  }

  const isSignupDisabled = loading || checkingDevice || (fingerprintWarning && !fingerprintWarning.canProceed)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join to start managing your inspection projects
          </p>
          
          {/* Trial Benefits */}
          {trialPlan && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                Free Trial Includes:
              </h3>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-blue-700">
                  <CreditCard className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{trialPlan.credits} credits to get started</span>
                </div>
                <div className="flex items-center text-sm text-blue-700">
                  <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{getTrialDurationText(trialPlan.duration_months)} free trial</span>
                </div>
                <div className="flex items-center text-sm text-blue-700">
                  <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>No credit card required</span>
                </div>
              </div>
            </div>
          )}

          {/* Device Check Status */}
          {checkingDevice && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center text-sm text-gray-600">
                <Shield className="w-4 h-4 mr-2 animate-pulse" />
                <span>Verifying device eligibility for trial...</span>
              </div>
            </div>
          )}

          {/* Device has been verified and is clean */}
          {!checkingDevice && fingerprintData && !fingerprintWarning && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center text-sm text-green-700">
                <Shield className="w-4 h-4 mr-2" />
                <span>Device verified - eligible for trial</span>
              </div>
            </div>
          )}

          {/* Fingerprint Warning - Device already used for trial */}
          {fingerprintWarning && !checkingDevice && (
            <div className={`mt-4 rounded-lg p-4 border ${
              fingerprintWarning.type === 'blocked' 
                ? 'bg-red-50 border-red-300' 
                : 'bg-orange-50 border-orange-300'
            }`}>
              <div className="flex items-start">
                <AlertTriangle className={`w-5 h-5 mr-2 flex-shrink-0 mt-0.5 ${
                  fingerprintWarning.type === 'blocked' 
                    ? 'text-red-600' 
                    : 'text-orange-600'
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    fingerprintWarning.type === 'blocked' 
                      ? 'text-red-900' 
                      : 'text-orange-900'
                  }`}>
                    Device Already Used for Trial
                  </p>
                  <p className={`text-sm mt-1 ${
                    fingerprintWarning.type === 'blocked' 
                      ? 'text-red-700' 
                      : 'text-orange-700'
                  }`}>
                    {fingerprintWarning.message}
                  </p>
                  {fingerprintWarning.existingCompanies && fingerprintWarning.existingCompanies.length > 0 && (
                    <div className="mt-2 text-xs">
                      <p className="font-semibold">Existing trial account:</p>
                      {fingerprintWarning.existingCompanies.map((company, idx) => (
                        <p key={idx}>• {company.name || 'Trial Account'}</p>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <Link href="/auth/login" className="text-sm text-blue-600 hover:text-blue-700 underline">
                      Go to login page →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Resend email form */}
        {showResendEmail && !success && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Resend confirmation email
            </h3>
            <form onSubmit={handleResendConfirmation} className="space-y-3">
              <div>
                <input
                  type="email"
                  required
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Enter your email"
                  disabled={resendLoading}
                />
              </div>
              <button
                type="submit"
                disabled={resendLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendLoading ? 'Sending...' : 'Resend confirmation email'}
              </button>
            </form>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
          {error && !showResendEmail && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <div>{error}</div>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md">
              <div>{success}</div>
            </div>
          )}
          
          {!success && (
            <>
              <div className="space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSignupDisabled}
                  />
                </div>

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
                    disabled={isSignupDisabled}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSignupDisabled}
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
                </div>

                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your company name"
                    disabled={isSignupDisabled}
                  />
                  {trialPlan && (
                    <p className="mt-1 text-xs text-gray-500">
                      You'll get {trialPlan.credits} free trial credits for {getTrialDurationText(trialPlan.duration_months)}
                    </p>
                  )}
                </div>

                <div className="flex items-start">
                  <input
                    id="acceptTerms"
                    type="checkbox"
                    checked={formData.acceptTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, acceptTerms: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    disabled={isSignupDisabled}
                  />
                  <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-900">
                    I accept the terms and conditions
                  </label>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSignupDisabled}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkingDevice ? 'Verifying device...' : loading ? 'Creating account...' : 'Sign up'}
                </button>
              </div>
            </>
          )}

          <div className="text-center">
            <Link href="/auth/login" className="text-sm text-blue-600 hover:text-blue-500">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}