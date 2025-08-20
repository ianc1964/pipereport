'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSubscriptionStatus } from '@/lib/subscriptions'

const AuthContext = createContext({})

// Retry helper function
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      console.log(`Retry ${i + 1}/${maxRetries} failed:`, error.message)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))) // Exponential backoff
      }
    }
  }
  throw lastError
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authInitialized, setAuthInitialized] = useState(false)
  const router = useRouter()
  
  // Track if we're in the process of signing out
  const isSigningOut = useRef(false)
  // Track if we're currently checking user to prevent duplicate calls
  const checkingUser = useRef(false)
  // Track if subscription warning has been shown this session
  const subscriptionWarningShown = useRef(false)

  const checkUser = useCallback(async (showLoading = true, isInitialSignIn = false) => {
    // Prevent concurrent checks
    if (checkingUser.current) {
      console.log('Check already in progress, skipping...')
      return
    }
    
    // Don't check if we're signing out
    if (isSigningOut.current) {
      console.log('Sign out in progress, skipping check...')
      return
    }
    
    checkingUser.current = true
    
    try {
      if (showLoading) {
        setLoading(true)
      }
      
      // Get user with longer timeout and retry
      const getUserWithRetry = async () => {
        return await retryOperation(async () => {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('getUser timeout')), 15000) // Increased to 15 seconds
          )
          
          const result = await Promise.race([
            supabase.auth.getUser(),
            timeoutPromise
          ])
          
          if (result.error) throw result.error
          return result
        }, 3, 2000) // 3 retries with 2 second initial delay
      }
      
      let authData
      try {
        authData = await getUserWithRetry()
      } catch (error) {
        console.error('Failed to get user after retries:', error)
        // Try session as fallback
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          console.log('Using session user as fallback')
          authData = { data: { user: session.user }, error: null }
        } else {
          throw error
        }
      }
      
      const currentUser = authData.data?.user
      
      if (!currentUser) {
        console.log('No authenticated user found')
        setUser(null)
        setProfile(null)
        setCompany(null)
        setSubscriptionStatus(null)
        return
      }
      
      setUser(currentUser)
      
      // Get profile with retry - FIXED to use maybeSingle
      const profileData = await retryOperation(async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle()  // Changed from .single() to .maybeSingle()
        
        if (error) throw error
        
        // If no profile exists, create a basic one for super admin
        if (!data && currentUser.email === 'ian@viewline.tv') {
          console.log('Creating basic profile for super admin...')
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: currentUser.id,
              email: currentUser.email,
              full_name: 'Ian',
              role: 'super_admin',
              is_active: true
            })
            .select()
            .single()
          
          if (insertError) {
            console.error('Failed to create profile:', insertError)
            return null
          }
          
          return newProfile
        }
        
        return data
      }, 3, 1000)
      
      if (!profileData) {
        console.error('Could not load profile after retries')
        return
      }
      
      setProfile(profileData)
      
      // Get company if user has one
      if (profileData.company_id) {
        try {
          // Try to get company with credits using retry
          const companyData = await retryOperation(async () => {
            const { data, error } = await supabase
              .from('companies')
              .select('*, user_credits(balance)')
              .eq('id', profileData.company_id)
              .maybeSingle()  // Also changed to maybeSingle for safety
            
            if (error) {
              // Fallback: get company without credits
              console.log('Trying fallback for company...')
              const { data: companyBasic, error: basicError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', profileData.company_id)
                .maybeSingle()
              
              if (basicError) throw basicError
              
              // Try to get credits separately
              const { data: credits } = await supabase
                .from('user_credits')
                .select('balance')
                .eq('company_id', profileData.company_id)
                .maybeSingle()
              
              if (credits) {
                companyBasic.user_credits = credits
              }
              
              return companyBasic
            }
            
            return data
          }, 2, 1000)
          
          setCompany(companyData)
          
          // Only check subscription status on initial sign-in
          if (isInitialSignIn && !subscriptionWarningShown.current) {
            console.log('Checking subscription status (initial sign-in)')
            try {
              const status = await retryOperation(
                () => getSubscriptionStatus(profileData.company_id),
                2, 
                1000
              )
              setSubscriptionStatus(status)
              subscriptionWarningShown.current = true
            } catch (error) {
              console.error('Error checking subscription status:', error)
              setSubscriptionStatus(null)
            }
          } else {
            console.log('Skipping subscription check (not initial sign-in or already shown)')
          }
          
        } catch (error) {
          console.error('Error loading company after retries:', error)
          setCompany(null)
          setSubscriptionStatus(null)
        }
      } else {
        setCompany(null)
        setSubscriptionStatus(null)
      }
      
    } catch (error) {
      console.error('Error in checkUser:', error)
      // Don't clear user data on error, keep what we have
    } finally {
      checkingUser.current = false
      setLoading(false)
      setAuthInitialized(true)
    }
  }, [])

  // Create a stable signOut function
  const signOut = useCallback(async () => {
    console.log('[Auth Context] SignOut called')
    
    if (isSigningOut.current) {
      console.log('[Auth Context] Already signing out, ignoring...')
      return
    }
    
    isSigningOut.current = true
    checkingUser.current = false // Cancel any ongoing checks
    
    try {
      // Clear local state immediately
      setUser(null)
      setProfile(null)
      setCompany(null)
      setSubscriptionStatus(null)
      setLoading(false)
      setAuthInitialized(false)
      
      // Reset subscription warning flag for next session
      subscriptionWarningShown.current = false
      
      console.log('[Auth Context] Calling supabase.auth.signOut()')
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('[Auth Context] Supabase signOut error:', error)
      } else {
        console.log('[Auth Context] Supabase signOut successful')
      }
      
      // Use window.location for most reliable redirect
      console.log('[Auth Context] Redirecting to login page')
      window.location.href = '/auth/login'
      
    } catch (error) {
      console.error('[Auth Context] Error during signOut:', error)
      // Force redirect even on error
      window.location.href = '/auth/login'
    } finally {
      setTimeout(() => {
        isSigningOut.current = false
      }, 2000)
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    let mounted = true
    let authStateSubscription = null

    const initializeAuth = async () => {
      console.log('=== Initializing Auth ===')
      
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user && mounted && !isSigningOut.current) {
          await checkUser(true, true) // Force loading and mark as initial sign-in
        } else if (mounted) {
          setLoading(false)
          setAuthInitialized(true)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setLoading(false)
          setAuthInitialized(true)
        }
      }

      // Set up auth state change listener only after initial check
      if (mounted) {
        const { data } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Auth state changed:', event)
            
            // Skip if we're in the process of signing out or component unmounted
            if (isSigningOut.current || !mounted) {
              console.log('Ignoring auth change')
              return
            }
            
            // Handle different auth events
            switch (event) {
              case 'SIGNED_OUT':
                console.log('User signed out')
                if (!isSigningOut.current) {
                  setUser(null)
                  setProfile(null)
                  setCompany(null)
                  setSubscriptionStatus(null)
                  setLoading(false)
                }
                break
                
              case 'SIGNED_IN':
                console.log('User signed in')
                // Small delay to let auth settle
                setTimeout(() => {
                  if (mounted && !isSigningOut.current) {
                    checkUser(true, true) // Force loading and mark as initial sign-in
                  }
                }, 500)
                break
                
              case 'TOKEN_REFRESHED':
                console.log('Token refreshed')
                // Only refresh if we have a user, but don't check subscription
                if (session?.user && mounted && !checkingUser.current) {
                  checkUser(false, false) // Don't show loading, not initial sign-in
                }
                break
                
              case 'USER_UPDATED':
                console.log('User updated')
                if (mounted && !checkingUser.current) {
                  checkUser(false, false) // Not initial sign-in
                }
                break
            }
          }
        )
        
        authStateSubscription = data
      }
    }

    initializeAuth()

    // Handle visibility change (tab switching) - but without subscription checks
    let visibilityTimeout = null
    const handleVisibilityChange = () => {
      if (visibilityTimeout) clearTimeout(visibilityTimeout)
      
      if (!document.hidden && mounted && !isSigningOut.current && authInitialized) {
        // Only refresh user/profile data, no subscription check
        visibilityTimeout = setTimeout(() => {
          if (mounted && !checkingUser.current) {
            console.log('Tab became visible, refreshing auth (no subscription check)')
            // Never check subscription on tab focus
            checkUser(false, false)
          }
        }, 2000) // 2 second delay
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      // Safely unsubscribe - check if the method exists
      if (authStateSubscription) {
        if (typeof authStateSubscription.unsubscribe === 'function') {
          authStateSubscription.unsubscribe()
        } else if (authStateSubscription.subscription && typeof authStateSubscription.subscription.unsubscribe === 'function') {
          authStateSubscription.subscription.unsubscribe()
        }
      }
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout)
      }
    
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkUser])

  // Create refresh functions
  const refreshProfile = useCallback(async () => {
    if (!checkingUser.current) {
      await checkUser(false, false) // Don't show loading, not initial sign-in
    }
  }, [checkUser])

  const refreshSubscription = useCallback(async () => {
    if (company?.id) {
      try {
        const status = await retryOperation(
          () => getSubscriptionStatus(company.id),
          2,
          1000
        )
        setSubscriptionStatus(status)
        // Reset warning flag so it can be shown again if needed
        subscriptionWarningShown.current = false
      } catch (error) {
        console.error('Error refreshing subscription status:', error)
      }
    }
  }, [company?.id])

  // Memoize the context value
  const value = useMemo(() => ({
    user,
    profile,
    company,
    subscriptionStatus,
    loading,
    authLoading: loading, // Alias for compatibility
    signOut,
    refreshProfile,
    refreshSubscription,
    isAuthenticated: !!user,
    isSuperAdmin: profile?.role === 'super_admin',
    isCompanyAdmin: profile?.role === 'company_admin',
    isUser: profile?.role === 'user',
    hasCredits: company?.user_credits?.balance > 0 || false,
    creditsBalance: company?.user_credits?.balance || 0,
    isSubscriptionActive: subscriptionStatus?.status === 'active' || subscriptionStatus?.status === 'trialing',
    subscriptionDaysRemaining: subscriptionStatus?.days_remaining || 0
  }), [user, profile, company, subscriptionStatus, loading, signOut, refreshProfile, refreshSubscription])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}