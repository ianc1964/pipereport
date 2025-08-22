'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import RefreshButton from '@/components/RefreshButton'
import { supabase } from '@/lib/supabase'
import { 
  Shield, 
  Users, 
  Building2, 
  CreditCard, 
  FileText,
  Settings,
  TrendingUp,
  Home,
  Brain,
  FolderOpen,
  Package,
  Fingerprint,
  AlertTriangle,
  Loader2,
  MessageCircle
} from 'lucide-react'

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalUsers: 0,
    creditsConsumedToday: 0,
    totalProjects: 0,
    activeTrials: 0,
    totalCreditsIssued: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadStatistics = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch all statistics in parallel
      const [
        companiesResult,
        usersResult,
        projectsResult,
        creditsResult,
        transactionsResult
      ] = await Promise.all([
        // Total companies
        supabase
          .from('companies')
          .select('id', { count: 'exact' }),
        
        // Total users
        supabase
          .from('profiles')
          .select('id', { count: 'exact' }),
        
        // Total projects
        supabase
          .from('projects')
          .select('id', { count: 'exact' }),
        
        // Total credits issued
        supabase
          .from('user_credits')
          .select('balance')
          .then(result => {
            if (result.error) throw result.error
            const totalCredits = result.data?.reduce((sum, company) => sum + (company.balance || 0), 0) || 0
            return { data: totalCredits, error: null }
          }),
        
        // Credits consumed today
        supabase
          .from('credit_transactions')
          .select('amount')
          .gte('created_at', new Date().toISOString().split('T')[0])
          .lt('amount', 0) // Only negative transactions (consumption)
          .then(result => {
            if (result.error) throw result.error
            const todayConsumption = result.data?.reduce((sum, transaction) => sum + Math.abs(transaction.amount || 0), 0) || 0
            return { data: todayConsumption, error: null }
          })
      ])

      // Check for errors
      const errors = [
        companiesResult.error,
        usersResult.error,
        projectsResult.error,
        creditsResult.error,
        transactionsResult.error
      ].filter(Boolean)

      if (errors.length > 0) {
        console.error('Statistics loading errors:', errors)
        throw new Error('Failed to load some statistics')
      }

      // Count active trials
      const trialsResult = await supabase
        .from('companies')
        .select('subscription_status', { count: 'exact' })
        .eq('subscription_status', 'trial')

      setStats({
        totalCompanies: companiesResult.count || 0,
        totalUsers: usersResult.count || 0,
        totalProjects: projectsResult.count || 0,
        totalCreditsIssued: creditsResult.data || 0,
        creditsConsumedToday: transactionsResult.data || 0,
        activeTrials: trialsResult.count || 0
      })

    } catch (error) {
      console.error('Error loading statistics:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatistics()
  }, [])

  const adminCards = [
    {
      title: 'Manage Companies',
      description: 'View and manage all companies in the system',
      href: '/admin/companies',
      icon: Building2,
      color: 'bg-blue-500',
      implemented: true
    },
    {
      title: 'Support Tickets',
      description: 'Manage support tickets from all companies',
      href: '/admin/support',
      icon: MessageCircle,
      color: 'bg-orange-500',
      implemented: true
    },
    {
      title: 'Subscriptions & Credits',
      description: 'Configure subscription plans and credit packs',
      href: '/admin/subscriptions',
      icon: Package,
      color: 'bg-purple-500',
      implemented: true
    },
    {
      title: 'Manage Users',
      description: 'View all users across companies and manage roles',
      href: '/admin/users',
      icon: Users,
      color: 'bg-green-500',
      implemented: true
    },
    {
      title: 'Suspicious IPs',
      description: 'Monitor IP addresses for potential trial account abuse',
      href: '/admin/suspicious-ips',
      icon: AlertTriangle,
      color: 'bg-orange-500',
      implemented: true
    },
    {
      title: 'Device Fingerprints',
      description: 'Monitor device fingerprints for trial abuse prevention',
      href: '/admin/device-fingerprints',
      icon: Fingerprint,
      color: 'bg-purple-500',
      implemented: true
    },
    {
      title: 'Credit Management',
      description: 'Monitor system-wide credit usage and transactions',
      href: '/admin/credits',
      icon: CreditCard,
      color: 'bg-indigo-500',
      implemented: true
    },
    {
      title: 'Pricing Rules',
      description: 'Configure credit consumption rates for all operations',
      href: '/admin/pricing',
      icon: TrendingUp,
      color: 'bg-yellow-500',
      implemented: true
    },
    {
      title: 'Observation Codes',
      description: 'Manage observation code templates and categories',
      href: '/admin/observation-codes',
      icon: FileText,
      color: 'bg-red-500',
      implemented: true
    },
    {
      title: 'AI Object Mapping',
      description: 'Configure AI detection to observation code mappings',
      href: '/admin/ai-mappings',
      icon: Brain,
      color: 'bg-teal-500',
      implemented: true
    },
    {
      title: 'All Projects',
      description: 'View all projects across all users and companies',
      href: '/admin/projects',
      icon: FolderOpen,
      color: 'bg-gray-500',
      implemented: true
    }
  ]

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
                <p className="text-gray-600">Welcome back, {profile?.full_name || profile?.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={loadStatistics}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                <span>Refresh Stats</span>
              </button>
              <RefreshButton />
            </div>
          </div>
        </div>

        {/* System Overview with Real Statistics */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">System Overview</h2>
            {loading && (
              <div className="flex items-center space-x-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">
                Error loading statistics: {error}
                <button 
                  onClick={loadStatistics}
                  className="ml-2 underline hover:no-underline"
                >
                  Retry
                </button>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {loading ? '...' : formatNumber(stats.totalCompanies)}
              </p>
              <p className="text-sm text-gray-600">Total Companies</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {loading ? '...' : formatNumber(stats.totalUsers)}
              </p>
              <p className="text-sm text-gray-600">Total Users</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {loading ? '...' : formatNumber(stats.creditsConsumedToday)}
              </p>
              <p className="text-sm text-gray-600">Credits Used Today</p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-600">
                {loading ? '...' : formatNumber(stats.totalProjects)}
              </p>
              <p className="text-sm text-gray-600">Total Projects</p>
            </div>

            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">
                {loading ? '...' : formatNumber(stats.activeTrials)}
              </p>
              <p className="text-sm text-gray-600">Active Trials</p>
            </div>

            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <p className="text-2xl font-bold text-indigo-600">
                {loading ? '...' : formatNumber(stats.totalCreditsIssued)}
              </p>
              <p className="text-sm text-gray-600">Credits Issued</p>
            </div>
          </div>
        </div>

        {/* Admin Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.href}
                href={card.href}
                className="block group"
              >
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative">
                  {!card.implemented && (
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                  )}
                  <div className="flex items-start space-x-4">
                    <div className={`${card.color} rounded-lg p-3 text-white`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                        {card.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </ProtectedRoute>
  )
}