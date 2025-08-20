'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { getCreditTransactions, getCreditBalance } from '@/lib/credits'
import { ChevronLeft, CreditCard, Package, TrendingUp, TrendingDown, AlertCircle, Clock, Loader2 } from 'lucide-react'

export default function CreditHistoryPage() {
  const { user, company, loading: authLoading } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all, purchases, consumption
  const [timeRange, setTimeRange] = useState('30') // days

  useEffect(() => {
    if (!authLoading && company?.id) {
      loadCreditData()
    }
  }, [authLoading, company, filter, timeRange])

  const loadCreditData = async () => {
    if (!company?.id) return

    try {
      setLoading(true)
      setError(null)

      // Load current balance
      const balanceData = await getCreditBalance(company.id)
      setBalance(balanceData)

      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - parseInt(timeRange))

      // Load transactions with correct options format
      const transactionsData = await getCreditTransactions(company.id, {
        type: filter === 'all' ? null : filter,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100
      })
      setTransactions(transactionsData || [])
    } catch (error) {
      console.error('Error loading credit data:', error)
      setError('Failed to load credit history')
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'purchase':
      case 'subscription':
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'consumption':
        return <TrendingDown className="w-4 h-4 text-red-600" />
      case 'manual_adjustment':
        return <AlertCircle className="w-4 h-4 text-blue-600" />
      case 'expiry':
        return <Clock className="w-4 h-4 text-gray-600" />
      default:
        return <CreditCard className="w-4 h-4 text-gray-600" />
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'purchase':
        return 'Credit Purchase'
      case 'subscription':
        return 'Subscription Credits'
      case 'consumption':
        return 'Credit Usage'
      case 'manual_adjustment':
        return 'Manual Adjustment'
      case 'expiry':
        return 'Credits Expired'
      default:
        return type
    }
  }

  const formatAmount = (amount, type) => {
    const isPositive = type === 'purchase' || type === 'subscription' || (type === 'manual_adjustment' && amount > 0)
    const prefix = isPositive ? '+' : ''
    const className = isPositive ? 'text-green-600' : 'text-red-600'
    return <span className={`font-medium ${className}`}>{prefix}{amount}</span>
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading credit history...</span>
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">No company found. Please contact support.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/company-dashboard" 
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <CreditCard className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Credit History</h1>
                <p className="text-sm text-gray-600">View your credit transactions and balance</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/account/subscription"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Package className="w-4 h-4 mr-2" />
                View Plans
              </Link>
              <button
                onClick={() => window.location.href = '/account/subscription?tab=credits'}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Buy Credits
              </button>
            </div>
          </div>
        </div>

        {/* Current Balance Card */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current Balance</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {balance?.balance || 0} <span className="text-lg font-normal text-gray-600">credits</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">
                Total Purchased: <span className="font-medium">{balance?.totalPurchased || 0}</span>
              </p>
              <p className="text-sm text-gray-600">
                Total Consumed: <span className="font-medium">{balance?.totalConsumed || 0}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Type
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All Transactions</option>
                <option value="purchase">Purchases Only</option>
                <option value="consumption">Usage Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
          </div>
          
          {error ? (
            <div className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600">{error}</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-center">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No transactions found for the selected period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance After
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(transaction.created_at).toLocaleDateString()}
                        <span className="block text-xs text-gray-500">
                          {new Date(transaction.created_at).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getTypeIcon(transaction.type)}
                          <span className="ml-2 text-sm text-gray-900">
                            {getTypeLabel(transaction.type)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {transaction.description}
                        {transaction.metadata?.operation_details && (
                          <span className="block text-xs text-gray-500">
                            {transaction.metadata.operation_details}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {transaction.profiles?.full_name || transaction.profiles?.email || 'System'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {formatAmount(transaction.amount, transaction.type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {transaction.balance_after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Need more credits? 
            <Link href="/account/subscription" className="ml-1 text-blue-600 hover:text-blue-700 font-medium">
              View subscription plans
            </Link>
            {' '}or{' '}
            <button 
              onClick={() => window.location.href = '/account/subscription?tab=credits'}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              purchase credit packs
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}