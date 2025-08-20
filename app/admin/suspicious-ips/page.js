'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import { 
  getSuspiciousIPs, 
  getCompaniesByIP 
} from '@/lib/actions/ip-tracking'
import { 
  AlertTriangle, 
  Globe, 
  Building2, 
  Users,
  TrendingUp,
  Shield,
  ChevronLeft,
  ExternalLink,
  Clock,
  Search,
  Filter
} from 'lucide-react'

export default function SuspiciousIPsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [suspiciousData, setSuspiciousData] = useState([])
  const [expandedIP, setExpandedIP] = useState(null)
  const [ipDetails, setIpDetails] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [minCompanies, setMinCompanies] = useState(2)

  useEffect(() => {
    loadSuspiciousIPs()
  }, [])

  async function loadSuspiciousIPs() {
    try {
      setLoading(true)
      const result = await getSuspiciousIPs()
      
      if (result.success) {
        setSuspiciousData(result.data || [])
      }
    } catch (error) {
      console.error('Error loading suspicious IPs:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadIPDetails(ip) {
    if (ipDetails[ip]) {
      setExpandedIP(expandedIP === ip ? null : ip)
      return
    }

    try {
      const result = await getCompaniesByIP(ip)
      if (result.success) {
        setIpDetails(prev => ({
          ...prev,
          [ip]: result.data
        }))
        setExpandedIP(ip)
      }
    } catch (error) {
      console.error('Error loading IP details:', error)
    }
  }

  // Filter data based on search and minimum companies
  const filteredData = suspiciousData.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.ip_address.includes(searchTerm) ||
      item.company_names?.some(name => 
        name.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      item.user_emails?.some(email => 
        email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    
    const matchesMinCompanies = item.company_count >= minCompanies
    
    return matchesSearch && matchesMinCompanies
  })

  function getRiskLevel(companyCount, userCount) {
    if (companyCount >= 5) return 'critical'
    if (companyCount >= 3) return 'high'
    if (companyCount >= 2 && userCount >= 5) return 'medium'
    return 'low'
  }

  function getRiskBadge(level) {
    switch(level) {
      case 'critical':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Critical
          </span>
        )
      case 'high':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            High
          </span>
        )
      case 'medium':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Shield className="w-3 h-3 mr-1" />
            Medium
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Shield className="w-3 h-3 mr-1" />
            Low
          </span>
        )
    }
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading suspicious IP patterns...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // Calculate statistics
  const totalSuspiciousIPs = suspiciousData.length
  const criticalRiskCount = suspiciousData.filter(
    item => getRiskLevel(item.company_count, item.user_count) === 'critical'
  ).length
  const highRiskCount = suspiciousData.filter(
    item => getRiskLevel(item.company_count, item.user_count) === 'high'
  ).length
  const avgCompaniesPerIP = suspiciousData.length > 0
    ? (suspiciousData.reduce((sum, item) => sum + item.company_count, 0) / suspiciousData.length).toFixed(1)
    : 0

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="text-blue-600 hover:text-blue-800 flex items-center mb-4">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to admin dashboard
          </Link>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <AlertTriangle className="w-8 h-8 mr-3 text-amber-600" />
                Suspicious IP Monitoring
              </h1>
              <p className="text-gray-600 mt-1">
                Track IP addresses used across multiple companies to identify potential trial abuse
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Globe className="w-10 h-10 text-gray-400 mr-4" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalSuspiciousIPs}</p>
                <p className="text-sm text-gray-600">Suspicious IPs</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <AlertTriangle className="w-10 h-10 text-red-400 mr-4" />
              <div>
                <p className="text-2xl font-bold text-red-600">{criticalRiskCount}</p>
                <p className="text-sm text-gray-600">Critical Risk</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Shield className="w-10 h-10 text-orange-400 mr-4" />
              <div>
                <p className="text-2xl font-bold text-orange-600">{highRiskCount}</p>
                <p className="text-sm text-gray-600">High Risk</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <TrendingUp className="w-10 h-10 text-blue-400 mr-4" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{avgCompaniesPerIP}</p>
                <p className="text-sm text-gray-600">Avg Companies/IP</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Search className="w-4 h-4 inline mr-1" />
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search IP, company, or email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Filter className="w-4 h-4 inline mr-1" />
                Minimum Companies
              </label>
              <select
                value={minCompanies}
                onChange={(e) => setMinCompanies(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="2">2+ companies</option>
                <option value="3">3+ companies</option>
                <option value="5">5+ companies</option>
                <option value="10">10+ companies</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={loadSuspiciousIPs}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>

        {/* Suspicious IPs Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Suspicious IP Addresses
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Companies
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Logins
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      No suspicious IP patterns found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => {
                    const riskLevel = getRiskLevel(item.company_count, item.user_count)
                    const isExpanded = expandedIP === item.ip_address
                    const details = ipDetails[item.ip_address]
                    
                    return (
                      <>
                        <tr key={item.ip_address} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm font-mono font-medium text-gray-900">
                              {item.ip_address}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getRiskBadge(riskLevel)}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-gray-900">
                              {item.company_count} companies
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {item.company_names?.slice(0, 2).join(', ')}
                              {item.company_names?.length > 2 && (
                                <span className="text-gray-400">
                                  {' '}+{item.company_names.length - 2} more
                                </span>
                              )}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Users className="w-4 h-4 text-gray-400 mr-1" />
                              <span className="text-sm text-gray-900">
                                {item.user_count}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {item.total_logins}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-500">
                              <Clock className="w-4 h-4 mr-1" />
                              {new Date(item.last_seen).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => loadIPDetails(item.ip_address)}
                              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            >
                              {isExpanded ? 'Hide' : 'View'} Details
                            </button>
                          </td>
                        </tr>
                        
                        {/* Expanded details row */}
                        {isExpanded && details && (
                          <tr>
                            <td colSpan="7" className="px-6 py-4 bg-gray-50">
                              <div className="space-y-4">
                                <h4 className="text-sm font-medium text-gray-900">
                                  Companies using IP {item.ip_address}:
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {details.map(company => (
                                    <div 
                                      key={company.id}
                                      className="bg-white rounded-lg border border-gray-200 p-3"
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <h5 className="text-sm font-medium text-gray-900">
                                          {company.name}
                                        </h5>
                                        <Link
                                          href={`/admin/companies/${company.id}`}
                                          className="text-blue-600 hover:text-blue-800"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </Link>
                                      </div>
                                      <div className="space-y-1 text-xs text-gray-600">
                                        <p>
                                          Status: <span className={`font-medium ${
                                            company.subscription_status === 'trial' 
                                              ? 'text-amber-600' 
                                              : 'text-gray-700'
                                          }`}>
                                            {company.subscription_status}
                                          </span>
                                        </p>
                                        <p>Created: {new Date(company.created_at).toLocaleDateString()}</p>
                                        <p>Logins: {company.login_count}</p>
                                        <p>Users: {company.users?.length || 0}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}