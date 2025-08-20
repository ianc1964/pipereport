'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { 
  Home, 
  FileVideo, 
  Shield, 
  Building2, 
  CreditCard, 
  LogOut,
  Menu,
  X,
  User,
  DollarSign
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, company, isAuthenticated, isSuperAdmin, isCompanyAdmin, signOut, creditsBalance, user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [companyDetails, setCompanyDetails] = useState(null)
  
  // Use a ref to track logout timeout
  const logoutTimeoutRef = useRef(null)

  // Load company details including logo
  useEffect(() => {
    if (user && company) {
      loadCompanyDetails()
    }
  }, [user, company])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current)
      }
    }
  }, [])

  const loadCompanyDetails = async () => {
      try {
        // Query the companies table directly since that's where the logo is stored
        const { data, error } = await supabase
          .from('companies')
          .select('name, logo_url')
          .eq('id', company.id)
          .single()

        if (data) {
          setCompanyDetails({
            name: data.name,
            logo_url: data.logo_url
          })
        } else {
          // Fallback to company data from auth context
          setCompanyDetails({
            name: company.name,
            logo_url: null
          })
        }
      } catch (error) {
        console.error('Error loading company details:', error)
        setCompanyDetails({
          name: company.name,
          logo_url: null
        })
      }
    }

  const handleSignOut = async () => {
    console.log('Logout button clicked')
    
    // Prevent multiple clicks
    if (isLoggingOut) {
      console.log('Already logging out, ignoring click')
      return
    }
    
    setIsLoggingOut(true)
    
    // Clear any existing timeout
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current)
    }
    
    // Set a timeout to reset the state after 5 seconds
    logoutTimeoutRef.current = setTimeout(() => {
      console.log('Logout timeout - resetting state and forcing redirect')
      setIsLoggingOut(false)
      // Force redirect if we're still on the same page
      if (window.location.pathname !== '/auth/login') {
        window.location.href = '/auth/login'
      }
    }, 5000)
    
    try {
      // Try the auth context signOut first
      if (signOut) {
        console.log('Calling auth context signOut')
        await signOut()
      } else {
        console.log('No signOut function, calling Supabase directly')
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        window.location.href = '/auth/login'
      }
      
    } catch (error) {
      console.error('Logout error:', error)
      
      // Clear the timeout
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current)
      }
      
      // Reset state
      setIsLoggingOut(false)
      
      // Try direct Supabase logout as fallback
      try {
        console.log('Attempting direct Supabase logout')
        await supabase.auth.signOut()
      } catch (e) {
        console.error('Direct logout also failed:', e)
      }
      
      // Force redirect regardless
      window.location.href = '/auth/login'
    }
  }

  // Get company initials for fallback
  const getCompanyInitials = (name) => {
    if (!name) return 'CO'
    const words = name.split(' ')
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Don't show navigation on auth pages
  if (pathname?.startsWith('/auth/')) {
    return null
  }

  // If not authenticated, show minimal nav
  if (!isAuthenticated) {
    return (
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-900">
                CCTV Inspection Reporting
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/auth/login" 
                className="text-gray-600 hover:text-gray-900"
              >
                Sign In
              </Link>
              <Link 
                href="/auth/signup" 
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  const navigation = [
    { name: 'Projects', href: '/', icon: Home, show: true },
    { name: 'Company', href: '/company-dashboard', icon: Building2, show: isCompanyAdmin },
    { name: 'Admin', href: '/admin', icon: Shield, show: isSuperAdmin },
    { name: 'Pricing', href: '/admin/pricing', icon: DollarSign, show: isSuperAdmin },
  ]

  // Show credits, handling the case where company might not be loaded yet
  const displayCredits = company?.user_credits?.balance ?? creditsBalance ?? 0
  const displayCompanyName = companyDetails?.name || company?.name || 'CCTV Inspection Reporting'

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          {/* Logo and main nav */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center space-x-3">
                {/* Company Logo or Initials */}
                {companyDetails?.logo_url ? (
                  <img 
                    src={companyDetails.logo_url} 
                    alt={displayCompanyName}
                    className="h-10 w-auto max-w-[128px] object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                
                {/* Fallback initials (hidden if logo loads) */}
                <div 
                  className={`h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold ${companyDetails?.logo_url ? 'hidden' : 'flex'}`}
                  style={{ display: companyDetails?.logo_url ? 'none' : 'flex' }}
                >
                  {getCompanyInitials(displayCompanyName)}
                </div>
                
                {/* Company Name */}
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-gray-900">{displayCompanyName}</span>
                  {company && (
                    <span className="text-xs text-gray-500">CCTV Inspection Reporting</span>
                  )}
                </div>
              </Link>
            </div>
            
            <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
              {navigation.filter(item => item.show).map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || 
                  (item.href === '/' && pathname === '/') ||
                  (item.href !== '/' && pathname?.startsWith(item.href))
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive
                        ? 'border-blue-600 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right side - User info */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            {/* Credits display */}
            {company && (
              <div className="flex items-center px-3 py-1 bg-gray-100 rounded-md">
                <CreditCard className="w-4 h-4 mr-2 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {displayCredits.toFixed(0)} Credits
                </span>
              </div>
            )}

            {/* User menu */}
            <div className="relative">
              <button className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">{profile?.full_name || profile?.email}</p>
                    <p className="text-xs text-gray-500">
                      {isSuperAdmin ? 'Super Admin' : isCompanyAdmin ? 'Company Admin' : 'User'}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
              </button>
            </div>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className={`text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors ${
                isLoggingOut ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
              title={isLoggingOut ? "Logging out..." : "Sign out"}
            >
              {isLoggingOut ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500"></div>
              ) : (
                <LogOut className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.filter(item => item.show).map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || 
                (item.href === '/' && pathname === '/') ||
                (item.href !== '/' && pathname?.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive
                      ? 'bg-blue-50 border-blue-600 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center">
                    <Icon className="w-4 h-4 mr-3" />
                    {item.name}
                  </div>
                </Link>
              )
            })}
          </div>
          
          <div className="pt-4 pb-3 border-t border-gray-200">
            {/* Company branding in mobile menu */}
            {company && (
              <div className="px-4 pb-3 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  {companyDetails?.logo_url ? (
                    <img 
                      src={companyDetails.logo_url} 
                      alt={displayCompanyName}
                      className="h-8 w-auto max-w-[100px] object-contain"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {getCompanyInitials(displayCompanyName)}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-800">{displayCompanyName}</div>
                    <div className="text-xs text-gray-500">CCTV Inspection Reporting</div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center px-4 pt-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <User className="h-6 w-6 text-gray-600" />
                </div>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-gray-800">
                  {profile?.full_name || profile?.email}
                </div>
                <div className="text-sm font-medium text-gray-500">
                  {isSuperAdmin ? 'Super Admin' : isCompanyAdmin ? 'Company Admin' : 'User'}
                </div>
              </div>
            </div>
            
            {company && (
              <div className="mt-3 px-4">
                <div className="flex items-center text-sm text-gray-600">
                  <CreditCard className="w-4 h-4 mr-2" />
                  {displayCredits.toFixed(0)} Credits
                </div>
              </div>
            )}
            
            <div className="mt-3 px-4">
              <button
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className={`flex items-center text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 ${
                  isLoggingOut ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {isLoggingOut ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                    Signing out...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}