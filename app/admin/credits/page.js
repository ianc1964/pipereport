'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import { 
  CreditCard, 
  ChevronLeft, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Building2,
  Calendar,
  Download,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react'

export default function CreditManagementPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCreditsInSystem: 0,
    totalCreditsConsumed: 0,
    totalCreditsPurchased: 0,
    activeCompanies: 0,
    transactionsToday: 0,
    creditsConsumedToday: 0
  })
  const [recentTransactions, setRecentTransactions] = useState([])
  const [topConsumers, setTopConsumers] = useState([])
  const [consumptionByType, setConsumptionByType] = useState([])
  const [dateRange, setDateRange] = useState('7days')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  
  useEffect(() => {
    loadCreditData()
  }, [dateRange])

  const loadCreditData = async () => {
    try {
      setLoading(true)
      
      // Load overall statistics
      await loadStats()
      
      // Load recent transactions
      await loadRecentTransactions()
      
      // Load top consumers
      await loadTopConsumers()
      
      // Load consumption by type
      await loadConsumptionByType()
      
    } catch (error) {
      console.error('Error loading credit data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      // Get total credits in system
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('balance, total_purchased, total_consumed')
      
      if (creditsError) throw creditsError

      const totalCreditsInSystem = creditsData.reduce((sum, c) => sum + (c.balance || 0), 0)
      const totalCreditsPurchased = creditsData.reduce((sum, c) => sum + (c.total_purchased || 0), 0)
      const totalCreditsConsumed = creditsData.reduce((sum, c) => sum + (c.total_consumed || 0), 0)

      // Get active companies count
      const { count: activeCompanies } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'active')

      // Get today's transactions
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { data: todayTransactions, error: todayError } = await supabase
        .from('credit_transactions')
        .select('amount')
        .gte('created_at', today.toISOString())
        .eq('type', 'consumption')

      if (todayError) throw todayError

      const transactionsToday = todayTransactions?.length || 0
      const creditsConsumedToday = todayTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0

      setStats({
        totalCreditsInSystem,
        totalCreditsPurchased,
        totalCreditsConsumed,
        activeCompanies: activeCompanies || 0,
        transactionsToday,
        creditsConsumedToday
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadRecentTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select(`
          *,
          companies (name),
          profiles (full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setRecentTransactions(data || [])
    } catch (error) {
      console.error('Error loading transactions:', error)
    }
  }

  const loadTopConsumers = async () => {
    try {
      const startDate = getStartDate()
      
      const { data, error } = await supabase
        .from('credit_transactions')
        .select(`
          company_id,
          amount,
          companies (name)
        `)
        .eq('type', 'consumption')
        .gte('created_at', startDate.toISOString())

      if (error) throw error

      // Group by company and sum consumption
      const consumptionByCompany = {}
      data?.forEach(transaction => {
        const companyId = transaction.company_id
        const companyName = transaction.companies?.name || 'Unknown'
        
        if (!consumptionByCompany[companyId]) {
          consumptionByCompany[companyId] = {
            company_id: companyId,
            company_name: companyName,
            total_consumed: 0
          }
        }
        
        consumptionByCompany[companyId].total_consumed += Math.abs(transaction.amount)
      })

      // Convert to array and sort
      const topConsumersList = Object.values(consumptionByCompany)
        .sort((a, b) => b.total_consumed - a.total_consumed)
        .slice(0, 5)

      setTopConsumers(topConsumersList)
    } catch (error) {
      console.error('Error loading top consumers:', error)
    }
  }

  const loadConsumptionByType = async () => {
    try {
      const startDate = getStartDate()
      
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('reference_type, metadata, amount')
        .eq('type', 'consumption')
        .gte('created_at', startDate.toISOString())

      if (error) throw error

      // Group by type - handle both old (metadata) and new (column) format
      const consumptionTypes = {}
      data?.forEach(transaction => {
        // Try to get type from column first, then from metadata
        const type = transaction.reference_type || transaction.metadata?.reference_type || 'other'
        if (!consumptionTypes[type]) {
          consumptionTypes[type] = 0
        }
        consumptionTypes[type] += Math.abs(transaction.amount)
      })

      // Convert to array for display
      const typesList = Object.entries(consumptionTypes)
        .map(([type, amount]) => ({ type, amount }))
        .sort((a, b) => b.amount - a.amount)

      setConsumptionByType(typesList)
    } catch (error) {
      console.error('Error loading consumption by type:', error)
    }
  }

  const getStartDate = () => {
    const date = new Date()
    switch (dateRange) {
      case '24hours':
        date.setHours(date.getHours() - 24)
        break
      case '7days':
        date.setDate(date.getDate() - 7)
        break
      case '30days':
        date.setDate(date.getDate() - 30)
        break
      case '90days':
        date.setDate(date.getDate() - 90)
        break
      default:
        date.setDate(date.getDate() - 7)
    }
    return date
  }

  const formatOperationType = (type) => {
    const types = {
      'video_upload': 'Video Upload',
      'image_upload': 'Image Upload',
      'image_capture': 'Frame Capture',
      'ai_inference': 'AI Analysis',
      'manual_adjustment': 'Manual Adjustment',
      'purchase': 'Credit Purchase'
    }
    return types[type] || type || 'Unknown'
  }

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'consumption':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      case 'purchase':
      case 'manual_adjustment':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getTransactionReferenceType = (transaction) => {
    // Try to get type from column first, then from metadata
    return transaction.reference_type || transaction.metadata?.reference_type || null
  }

  const filteredTransactions = recentTransactions.filter(transaction => {
    const matchesSearch = searchTerm === '' || 
      transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.companies?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = filterType === 'all' || transaction.type === filterType
    
    return matchesSearch && matchesType
  })

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/admin" 
                className="text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center space-x-3">
                <CreditCard className="h-8 w-8 text-purple-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Credit Management</h1>
                  <p className="text-gray-600">
                    Monitor and manage system-wide credit usage
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={loadCreditData}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Credits</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalCreditsInSystem.toLocaleString()}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-purple-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Consumed</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.totalCreditsConsumed.toLocaleString()}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Purchased</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.totalCreditsPurchased.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Companies</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.activeCompanies}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Usage</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.creditsConsumedToday.toLocaleString()}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Transactions Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.transactionsToday}
                </p>
              </div>
              <Activity className="h-8 w-8 text-gray-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Consumers */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Top Consumers</h2>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="24hours">Last 24 Hours</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
              </select>
            </div>
            {topConsumers.length === 0 ? (
              <p className="text-gray-500 text-sm">No consumption data for this period</p>
            ) : (
              <div className="space-y-3">
                {topConsumers.map((consumer, index) => (
                  <div key={consumer.company_id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-500 w-6">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {consumer.company_name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">
                        {consumer.total_consumed.toLocaleString()} credits
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consumption by Type */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Consumption by Type ({dateRange.replace('days', ' days').replace('hours', ' hours')})
            </h2>
            {consumptionByType.length === 0 ? (
              <p className="text-gray-500 text-sm">No consumption data for this period</p>
            ) : (
              <div className="space-y-3">
                {consumptionByType.map((item) => {
                  const total = consumptionByType.reduce((sum, i) => sum + i.amount, 0)
                  const percentage = total > 0 ? (item.amount / total * 100).toFixed(1) : 0
                  
                  return (
                    <div key={item.type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {formatOperationType(item.type)}
                        </span>
                        <span className="text-sm text-gray-600">
                          {item.amount.toLocaleString()} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
              <div className="flex items-center space-x-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Types</option>
                  <option value="consumption">Consumption</option>
                  <option value="purchase">Purchases</option>
                  <option value="manual_adjustment">Adjustments</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => {
                  const referenceType = getTransactionReferenceType(transaction)
                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(transaction.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.companies?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.profiles?.email || 'System'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {transaction.description || formatOperationType(referenceType)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-1">
                          {getTransactionIcon(transaction.type)}
                          <span className="text-gray-600">
                            {transaction.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        <span className={transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}