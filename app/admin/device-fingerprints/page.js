'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import { 
  ChevronLeft, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Search,
  RefreshCw,
  Monitor,
  User,
  Calendar,
  ChevronDown,
  ChevronRight,
  Ban,
  Unlock
} from 'lucide-react'
import { 
  getSuspiciousFingerprints, 
  getCompaniesByFingerprint,
  blockFingerprint,
  unblockFingerprint,
  analyzeFingerprintPatterns
} from '@/lib/actions/fingerprint-tracking'

function DeviceFingerprintsContent() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [fingerprints, setFingerprints] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [minCompanies, setMinCompanies] = useState(1)
  const [expandedRows, setExpandedRows] = useState({})
  const [stats, setStats] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [blockingDevice, setBlockingDevice] = useState(null)
  const [showOnlyBlocked, setShowOnlyBlocked] = useState(false)

  useEffect(() => {
    if (!authLoading && profile) {
      loadData()
      loadStats()
    }
  }, [authLoading, profile, minCompanies, showOnlyBlocked])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Get all fingerprints with their associations
      const { data, error } = await supabase
        .from('device_fingerprints')
        .select(`
          *,
          fingerprint_users!inner (
            company_id,
            user_id,
            is_trial_account,
            created_at,
            ip_address,
            companies (
              id,
              name,
              subscription_status,
              created_at
            ),
            profiles (
              id,
              email,
              full_name
            )
          ),
          trial_abuse_detections (
            blocked,
            blocked_at,
            blocked_by,
            severity,
            detection_type
          )
        `)
        .order('last_seen_at', { ascending: false })

      if (error) throw error

      // Process the data to group by fingerprint
      const processedData = processFingerprints(data || [])
      
      // Filter based on minCompanies and blocked status
      let filtered = processedData.filter(fp => fp.company_count >= minCompanies)
      
      if (showOnlyBlocked) {
        filtered = filtered.filter(fp => fp.is_blocked)
      }
      
      setFingerprints(filtered)
    } catch (error) {
      console.error('Error loading fingerprints:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const result = await analyzeFingerprintPatterns(30)
      if (result.success) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const processFingerprints = (data) => {
    const fingerprintMap = new Map()
    
    data.forEach(fp => {
      if (!fingerprintMap.has(fp.id)) {
        fingerprintMap.set(fp.id, {
          id: fp.id,
          fingerprint_hash: fp.fingerprint_hash,
          confidence_score: fp.confidence_score,
          first_seen_at: fp.first_seen_at,
          last_seen_at: fp.last_seen_at,
          seen_count: fp.seen_count,
          companies: new Map(),
          users: new Map(),
          ip_addresses: new Set(),
          is_blocked: false,
          blocked_at: null,
          severity: 'low'
        })
      }
      
      const fingerprint = fingerprintMap.get(fp.id)
      
      // Process each association
      fp.fingerprint_users?.forEach(fu => {
        if (fu.companies) {
          fingerprint.companies.set(fu.company_id, {
            id: fu.company_id,
            name: fu.companies.name,
            subscription_status: fu.companies.subscription_status,
            is_trial: fu.is_trial_account,
            created_at: fu.created_at
          })
        }
        
        if (fu.profiles) {
          fingerprint.users.set(fu.user_id, {
            id: fu.user_id,
            email: fu.profiles.email,
            full_name: fu.profiles.full_name
          })
        }
        
        if (fu.ip_address) {
          fingerprint.ip_addresses.add(fu.ip_address)
        }
      })
      
      // Check if blocked
      if (fp.trial_abuse_detections?.length > 0) {
        const detection = fp.trial_abuse_detections[0]
        fingerprint.is_blocked = detection.blocked || false
        fingerprint.blocked_at = detection.blocked_at
        fingerprint.severity = detection.severity || 'low'
      }
    })
    
    // Convert to array and calculate counts
    return Array.from(fingerprintMap.values()).map(fp => ({
      ...fp,
      companies: Array.from(fp.companies.values()),
      users: Array.from(fp.users.values()),
      ip_addresses: Array.from(fp.ip_addresses),
      company_count: fp.companies.size,
      user_count: fp.users.size,
      trial_count: Array.from(fp.companies.values()).filter(c => c.is_trial).length
    }))
  }

  const getRiskLevel = (fingerprint) => {
    if (fingerprint.is_blocked) return 'blocked'
    if (fingerprint.trial_count >= 3) return 'critical'
    if (fingerprint.trial_count >= 2) return 'high'
    if (fingerprint.company_count >= 2) return 'medium'
    return 'low'
  }

  const getRiskBadge = (level) => {
    const badges = {
      blocked: { color: 'bg-black text-white', icon: Ban, text: 'Blocked' },
      critical: { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Critical' },
      high: { color: 'bg-orange-100 text-orange-800', icon: AlertTriangle, text: 'High' },
      medium: { color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle, text: 'Medium' },
      low: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Low' }
    }
    
    const badge = badges[level]
    const Icon = badge.icon
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.text}
      </span>
    )
  }

  const toggleExpanded = (fingerprintId) => {
    setExpandedRows(prev => ({
      ...prev,
      [fingerprintId]: !prev[fingerprintId]
    }))
  }

  const handleBlockDevice = async (fingerprint) => {
    if (!user) return
    
    const action = fingerprint.is_blocked ? 'unblock' : 'block'
    const confirmMsg = fingerprint.is_blocked 
      ? `Are you sure you want to unblock this device? It will be able to create new trial accounts.`
      : `Are you sure you want to block this device? It will prevent any new trial accounts from this device.`
    
    if (!window.confirm(confirmMsg)) return
    
    setBlockingDevice(fingerprint.id)
    
    try {
      const result = fingerprint.is_blocked
        ? await unblockFingerprint(fingerprint.fingerprint_hash, user.id, 'Manual unblock by admin')
        : await blockFingerprint(fingerprint.fingerprint_hash, user.id, 'Manual block by admin')
      
      if (result.success) {
        await loadData()
      } else {
        alert(`Failed to ${action} device: ${result.error}`)
      }
    } catch (error) {
      console.error(`Error ${action}ing device:`, error)
      alert(`Failed to ${action} device`)
    } finally {
      setBlockingDevice(null)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    await loadStats()
    setRefreshing(false)
  }

  const filteredFingerprints = fingerprints.filter(fp => {
    if (!searchTerm) return true
    
    const search = searchTerm.toLowerCase()
    return (
      fp.fingerprint_hash.toLowerCase().includes(search) ||
      fp.companies.some(c => c.name.toLowerCase().includes(search)) ||
      fp.users.some(u => u.email.toLowerCase().includes(search)) ||
      fp.ip_addresses.some(ip => ip.includes(search))
    )
  })

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading device fingerprints...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-400 hover:text-gray-500">
                <ChevronLeft className="h-6 w-6" />
              </Link>
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Device Fingerprints</h1>
                <p className="text-sm text-gray-500 mt-1">Monitor and manage device-based trial abuse</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium 
                ${refreshing 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Devices</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_fingerprints}</p>
                </div>
                <Monitor className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Trial Companies</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.trial_companies}</p>
                </div>
                <User className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Suspicious Devices</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{stats.suspicious_fingerprints}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-400" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Critical Risk</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{stats.critical_fingerprints}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Hash, company, email, IP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Companies
              </label>
              <select
                value={minCompanies}
                onChange={(e) => setMinCompanies(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1+ Companies</option>
                <option value={2}>2+ Companies (Suspicious)</option>
                <option value={3}>3+ Companies (Critical)</option>
                <option value={5}>5+ Companies</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status Filter
              </label>
              <select
                value={showOnlyBlocked ? 'blocked' : 'all'}
                onChange={(e) => setShowOnlyBlocked(e.target.value === 'blocked')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Devices</option>
                <option value="blocked">Blocked Only</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{filteredFingerprints.length}</span> devices
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fingerprints Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Device Fingerprint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Companies
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Seen
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
                {filteredFingerprints.map((fingerprint) => (
                  <React.Fragment key={fingerprint.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {fingerprint.fingerprint_hash.substring(0, 20)}...
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Confidence: {(fingerprint.confidence_score * 100).toFixed(0)}%
                            {' • '}
                            Seen: {fingerprint.seen_count} times
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getRiskBadge(getRiskLevel(fingerprint))}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {fingerprint.company_count} companies
                        </div>
                        <div className="text-xs text-gray-500">
                          {fingerprint.trial_count} trials
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(fingerprint.first_seen_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(fingerprint.last_seen_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleExpanded(fingerprint.id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            {expandedRows[fingerprint.id] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleBlockDevice(fingerprint)}
                            disabled={blockingDevice === fingerprint.id}
                            className={`px-3 py-1 rounded text-xs font-medium ${
                              fingerprint.is_blocked
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            } ${blockingDevice === fingerprint.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {blockingDevice === fingerprint.id ? (
                              'Processing...'
                            ) : fingerprint.is_blocked ? (
                              <>
                                <Unlock className="inline h-3 w-3 mr-1" />
                                Unblock
                              </>
                            ) : (
                              <>
                                <Ban className="inline h-3 w-3 mr-1" />
                                Block
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Details */}
                    {expandedRows[fingerprint.id] && (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Companies */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Companies</h4>
                              <div className="space-y-1">
                                {fingerprint.companies.map((company) => (
                                  <div key={company.id} className="text-sm">
                                    <span className="font-medium">{company.name}</span>
                                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                      company.is_trial
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {company.subscription_status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Users */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Users</h4>
                              <div className="space-y-1">
                                {fingerprint.users.map((user) => (
                                  <div key={user.id} className="text-sm">
                                    <div>{user.email}</div>
                                    {user.full_name && (
                                      <div className="text-xs text-gray-500">{user.full_name}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* IP Addresses */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">IP Addresses</h4>
                              <div className="space-y-1">
                                {fingerprint.ip_addresses.map((ip) => (
                                  <div key={ip} className="text-sm font-mono">
                                    {ip}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {/* Fingerprint Hash */}
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">Full Fingerprint Hash</h4>
                            <code className="text-xs text-gray-600 break-all">{fingerprint.fingerprint_hash}</code>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            
            {filteredFingerprints.length === 0 && (
              <div className="text-center py-12">
                <Shield className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No devices found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm 
                    ? 'Try adjusting your search criteria'
                    : 'No devices match your filter criteria'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DeviceFingerprintsPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <DeviceFingerprintsContent />
    </ProtectedRoute>
  )
}