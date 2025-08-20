'use client'

import { useState, useEffect } from 'react'
import { 
  getCompanyLoginHistory, 
  getCompaniesByIP 
} from '@/lib/actions/ip-tracking'
import { 
  Globe, 
  AlertTriangle, 
  Clock, 
  User,
  Building2,
  ChevronRight,
  Shield,
  Activity
} from 'lucide-react'

export default function CompanyIPInfo({ companyId, companyName }) {
  const [loginHistory, setLoginHistory] = useState([])
  const [suspiciousIPs, setSuspiciousIPs] = useState([])
  const [expandedIP, setExpandedIP] = useState(null)
  const [relatedCompanies, setRelatedCompanies] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadIPData()
  }, [companyId])

  async function loadIPData() {
    try {
      setLoading(true)
      
      // Load login history for this company
      const historyResult = await getCompanyLoginHistory(companyId, 25)
      if (historyResult.success) {
        setLoginHistory(historyResult.data || [])
        
        // Identify IPs used by multiple users
        const ipCounts = {}
        const ipUsers = {}
        
        historyResult.data.forEach(entry => {
          const ip = entry.ip_address
          ipCounts[ip] = (ipCounts[ip] || 0) + 1
          
          if (!ipUsers[ip]) {
            ipUsers[ip] = new Set()
          }
          if (entry.profiles?.email) {
            ipUsers[ip].add(entry.profiles.email)
          }
        })
        
        // Find suspicious IPs (used by multiple users or high frequency)
        const suspicious = Object.entries(ipCounts)
          .filter(([ip, count]) => count > 5 || ipUsers[ip]?.size > 1)
          .map(([ip, count]) => ({
            ip,
            count,
            userCount: ipUsers[ip]?.size || 0,
            users: Array.from(ipUsers[ip] || [])
          }))
        
        setSuspiciousIPs(suspicious)
      }
    } catch (error) {
      console.error('Error loading IP data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRelatedCompanies(ip) {
    if (relatedCompanies[ip]) {
      setExpandedIP(expandedIP === ip ? null : ip)
      return
    }
    
    try {
      const result = await getCompaniesByIP(ip)
      if (result.success) {
        setRelatedCompanies(prev => ({
          ...prev,
          [ip]: result.data
        }))
        setExpandedIP(ip)
      }
    } catch (error) {
      console.error('Error loading related companies:', error)
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getIPRiskLevel(ip, userCount, loginCount) {
    // Check if this IP is associated with other companies
    const otherCompanies = relatedCompanies[ip]?.filter(c => c.id !== companyId).length || 0
    
    if (otherCompanies > 0) return 'high'
    if (userCount > 2 || loginCount > 20) return 'medium'
    return 'low'
  }

  function getRiskBadge(level) {
    switch(level) {
      case 'high':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            High Risk
          </span>
        )
      case 'medium':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            <Shield className="w-3 h-3 mr-1" />
            Medium Risk
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            <Shield className="w-3 h-3 mr-1" />
            Normal
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  // Get unique IPs with aggregated data
  const uniqueIPs = {}
  loginHistory.forEach(entry => {
    const ip = entry.ip_address
    if (!uniqueIPs[ip]) {
      uniqueIPs[ip] = {
        ip,
        users: new Set(),
        logins: [],
        firstSeen: entry.created_at,
        lastSeen: entry.created_at
      }
    }
    if (entry.profiles?.email) {
      uniqueIPs[ip].users.add(entry.profiles.email)
    }
    uniqueIPs[ip].logins.push(entry)
    if (new Date(entry.created_at) < new Date(uniqueIPs[ip].firstSeen)) {
      uniqueIPs[ip].firstSeen = entry.created_at
    }
    if (new Date(entry.created_at) > new Date(uniqueIPs[ip].lastSeen)) {
      uniqueIPs[ip].lastSeen = entry.created_at
    }
  })

  const ipList = Object.values(uniqueIPs)
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))

  return (
    <div className="space-y-6">
      {/* Suspicious Activity Alert */}
      {suspiciousIPs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-amber-900">
                Suspicious IP Activity Detected
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                {suspiciousIPs.length} IP address{suspiciousIPs.length > 1 ? 'es' : ''} with unusual activity patterns
              </p>
            </div>
          </div>
        </div>
      )}

      {/* IP Address List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            IP Address Activity
          </h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {ipList.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No login activity recorded yet
            </div>
          ) : (
            ipList.map((ipData) => {
              const riskLevel = getIPRiskLevel(
                ipData.ip, 
                ipData.users.size, 
                ipData.logins.length
              )
              const isExpanded = expandedIP === ipData.ip
              const related = relatedCompanies[ipData.ip]
              
              return (
                <div key={ipData.ip} className="hover:bg-gray-50">
                  <div 
                    className="px-6 py-4 cursor-pointer"
                    onClick={() => loadRelatedCompanies(ipData.ip)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <p className="font-mono text-sm font-medium text-gray-900">
                            {ipData.ip}
                          </p>
                          {getRiskBadge(riskLevel)}
                          <ChevronRight 
                            className={`w-4 h-4 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                        
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            {ipData.users.size} user{ipData.users.size !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center">
                            <Activity className="w-3 h-3 mr-1" />
                            {ipData.logins.length} login{ipData.logins.length !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Last: {formatDate(ipData.lastSeen)}
                          </span>
                        </div>
                        
                        {ipData.users.size > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600">
                              Users: {Array.from(ipData.users).join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded section showing related companies */}
                  {isExpanded && related && (
                    <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100">
                      <div className="mt-3">
                        <h4 className="text-xs font-medium text-gray-700 uppercase mb-2">
                          Other Companies Using This IP
                        </h4>
                        {related.filter(c => c.id !== companyId).length === 0 ? (
                          <p className="text-sm text-gray-500">
                            No other companies found using this IP
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {related
                              .filter(c => c.id !== companyId)
                              .map(company => (
                                <div 
                                  key={company.id}
                                  className="bg-white rounded border border-gray-200 p-3"
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-gray-900 flex items-center">
                                        <Building2 className="w-4 h-4 mr-1 text-gray-400" />
                                        {company.name}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Status: <span className={`font-medium ${
                                          company.subscription_status === 'trial' 
                                            ? 'text-amber-600' 
                                            : 'text-gray-600'
                                        }`}>
                                          {company.subscription_status}
                                        </span>
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Created: {new Date(company.created_at).toLocaleDateString()}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Logins: {company.login_count}
                                      </p>
                                    </div>
                                    {company.subscription_status === 'trial' && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                        Trial
                                      </span>
                                    )}
                                  </div>
                                  
                                  {company.users.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-xs text-gray-600">
                                        Users: {company.users.map(u => u.email).join(', ')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
        
        {loginHistory.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Showing IP addresses from the last 25 logins
            </p>
          </div>
        )}
      </div>
    </div>
  )
}