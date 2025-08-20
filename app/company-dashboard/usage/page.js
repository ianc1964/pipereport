'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { 
  getCreditConsumptionStats, 
  getCreditTransactions,
  getOperationDisplayName,
  getCreditBalance
} from '@/lib/credits'
import { 
  ChevronLeft, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Activity,
  FileVideo,
  Image,
  Brain,
  Calendar,
  Loader2,
  AlertCircle
} from 'lucide-react'

export default function UsageStatsPage() {
  const { user, company, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeRange, setTimeRange] = useState('month') // day, week, month, all
  const [stats, setStats] = useState(null)
  const [recentTransactions, setRecentTransactions] = useState([])
  const [dailyUsage, setDailyUsage] = useState([])
  const [balance, setBalance] = useState(null)

  useEffect(() => {
    if (!authLoading && company?.id) {
      loadUsageData()
    }
  }, [authLoading, company, timeRange])

  const loadUsageData = async () => {
    if (!company?.id) return

    try {
      setLoading(true)
      setError(null)

      // Load current balance
      const balanceData = await getCreditBalance(company.id)
      setBalance(balanceData)

      // Load consumption statistics
      const statsData = await getCreditConsumptionStats(company.id, timeRange)
      setStats(statsData)

      // Load recent consumption transactions
      const endDate = new Date()
      const startDate = new Date()
      
      switch (timeRange) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1)
          break
        case 'week':
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'all':
          startDate.setFullYear(startDate.getFullYear() - 10) // Effectively all time
          break
      }

      const transactions = await getCreditTransactions(company.id, {
        type: 'consumption',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100
      })

      setRecentTransactions(transactions)

      // Calculate daily usage for chart
      const dailyData = calculateDailyUsage(transactions, startDate, endDate)
      setDailyUsage(dailyData)

    } catch (error) {
      console.error('Error loading usage data:', error)
      setError('Failed to load usage statistics')
    } finally {
      setLoading(false)
    }
  }

  const calculateDailyUsage = (transactions, startDate, endDate) => {
    const dailyMap = {}
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    
    // Initialize all days with 0
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateKey = date.toISOString().split('T')[0]
      dailyMap[dateKey] = 0
    }

    // Sum up usage by day
    transactions.forEach(transaction => {
      const dateKey = transaction.created_at.split('T')[0]
      if (dailyMap.hasOwnProperty(dateKey)) {
        dailyMap[dateKey] += Math.abs(transaction.amount)
      }
    })

    // Convert to array for display
    return Object.entries(dailyMap).map(([date, usage]) => ({
      date,
      usage,
      dayLabel: new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
    }))
  }

  const getOperationIcon = (operationType) => {
    switch (operationType) {
      case 'video_upload':
        return <FileVideo className="w-4 h-4" />
      case 'image_upload':
      case 'image_capture':
        return <Image className="w-4 h-4" />
      case 'ai_inference':
        return <Brain className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'day':
        return 'Last 24 Hours'
      case 'week':
        return 'Last 7 Days'
      case 'month':
        return 'Last 30 Days'
      case 'all':
        return 'All Time'
      default:
        return timeRange
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading usage statistics...</span>
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

  // Find max usage for chart scaling
  const maxDailyUsage = Math.max(...dailyUsage.map(d => d.usage), 1)

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
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Usage Statistics</h1>
                <p className="text-sm text-gray-600">Monitor your credit consumption and usage patterns</p>
              </div>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Time Period</h2>
            <div className="flex space-x-2">
              {['day', 'week', 'month', 'all'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range === 'day' && '24 Hours'}
                  {range === 'week' && '7 Days'}
                  {range === 'month' && '30 Days'}
                  {range === 'all' && 'All Time'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Total Usage */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Usage</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats?.total || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">{getTimeRangeLabel()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-500" />
            </div>
          </div>

          {/* Daily Average */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Daily Average</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats?.dailyAverage || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Credits per day</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          {/* Current Balance */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Balance</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {balance?.balance || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Credits remaining</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Usage Chart */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Usage Trend</h3>
          {dailyUsage.length > 0 ? (
            <div className="relative h-48">
              <div className="absolute inset-0 flex items-end justify-between space-x-1">
                {dailyUsage.slice(-30).map((day, index) => (
                  <div
                    key={day.date}
                    className="relative flex-1 group"
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                      style={{
                        height: `${(day.usage / maxDailyUsage) * 100}%`,
                        minHeight: day.usage > 0 ? '2px' : '0'
                      }}
                    >
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {day.usage} credits
                      </div>
                    </div>
                    {(timeRange !== 'month' || index % 5 === 0) && (
                      <div className="absolute -bottom-6 left-0 right-0 text-center">
                        <span className="text-xs text-gray-500">
                          {timeRange === 'day' 
                            ? new Date(day.date).getHours() + ':00'
                            : timeRange === 'week'
                            ? day.dayLabel
                            : new Date(day.date).getDate()
                          }
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-0 -ml-12 flex flex-col justify-between text-xs text-gray-500">
                <span>{maxDailyUsage}</span>
                <span>{Math.round(maxDailyUsage / 2)}</span>
                <span>0</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No usage data for the selected period
            </div>
          )}
        </div>

        {/* Usage by Type */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage by Operation Type</h3>
          {stats?.byType && Object.keys(stats.byType).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(stats.byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, usage]) => {
                  const percentage = stats.total > 0 ? (usage / stats.total) * 100 : 0
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getOperationIcon(type)}
                          <span className="text-sm font-medium text-gray-700">
                            {getOperationDisplayName(type)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {usage} credits ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No usage data by type for the selected period
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits Used
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentTransactions.slice(0, 10).map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.created_at).toLocaleDateString()}
                      <span className="block text-xs text-gray-500">
                        {new Date(transaction.created_at).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getOperationIcon(transaction.metadata?.operation_type || transaction.reference_type)}
                        <span className="ml-2 text-sm text-gray-900">
                          {getOperationDisplayName(transaction.metadata?.operation_type || transaction.reference_type || 'consumption')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                      {Math.abs(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recentTransactions.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              No recent activity for the selected period
            </div>
          )}
        </div>
      </div>
    </div>
  )
}