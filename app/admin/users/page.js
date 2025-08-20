'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { 
  Users, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Shield, 
  Building2, 
  User,
  CheckCircle,
  XCircle,
  UserPlus,
  UserX,
  Mail
} from 'lucide-react'

export default function ManageUsersPage() {
  const [companies, setCompanies] = useState([])
  const [orphanedUsers, setOrphanedUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCompanies, setExpandedCompanies] = useState({})
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCompanies: 0,
    superAdmins: 0,
    orphanedUsers: 0
  })
  
  const { user: currentUser, profile: currentProfile, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading) {
      loadData()
    }
  }, [authLoading])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Get all companies with their users
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select(`
          *,
          profiles!profiles_company_id_fkey (
            id,
            email,
            full_name,
            role,
            is_active,
            created_at
          )
        `)
        .order('name')

      if (companiesError) throw companiesError

      // Get orphaned users (users without companies)
      const { data: orphanedData, error: orphanedError } = await supabase
        .from('profiles')
        .select('*')
        .is('company_id', null)
        .neq('role', 'super_admin') // Super admins don't need companies
        .order('created_at', { ascending: false })

      if (orphanedError) throw orphanedError

      // Get super admins separately
      const { data: superAdmins, error: superAdminsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'super_admin')
        .order('created_at', { ascending: false })

      if (superAdminsError) throw superAdminsError

      setCompanies(companiesData || [])
      setOrphanedUsers(orphanedData || [])

      // Calculate stats
      const totalUsers = (companiesData || []).reduce((sum, company) => 
        sum + (company.profiles?.length || 0), 0
      ) + (orphanedData?.length || 0) + (superAdmins?.length || 0)

      setStats({
        totalUsers,
        totalCompanies: companiesData?.length || 0,
        superAdmins: superAdmins?.length || 0,
        orphanedUsers: orphanedData?.length || 0
      })

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCompanyExpansion = (companyId) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }))
  }

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error
      
      // Refresh data
      await loadData()
    } catch (error) {
      console.error('Error toggling user status:', error)
      alert('Failed to update user status')
    }
  }

  const changeUserRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      
      // Refresh data
      await loadData()
    } catch (error) {
      console.error('Error changing user role:', error)
      alert('Failed to change user role')
    }
  }

  // Filter companies and users based on search
  const filteredCompanies = companies.filter(company => {
    const companyMatches = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          company.main_contact_email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const hasMatchingUser = company.profiles?.some(user => 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    return searchTerm === '' || companyMatches || hasMatchingUser
  })

  const getRoleIcon = (role) => {
    switch (role) {
      case 'super_admin':
        return <Shield className="h-4 w-4 text-purple-600" />
      case 'company_admin':
        return <Building2 className="h-4 w-4 text-blue-600" />
      default:
        return <User className="h-4 w-4 text-gray-600" />
    }
  }

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin'
      case 'company_admin':
        return 'Company Admin'
      default:
        return 'User'
    }
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800'
      case 'company_admin':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (authLoading) {
    return (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                <Users className="h-8 w-8 text-green-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
                  <p className="text-gray-600">
                    {stats.totalUsers} users across {stats.totalCompanies} companies
                  </p>
                </div>
              </div>
            </div>
            
            {orphanedUsers.length > 0 && (
              <Link
                href="/admin/users/fix-orphaned"
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                <UserX className="w-4 h-4 mr-2" />
                Fix {orphanedUsers.length} Orphaned Users
              </Link>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Companies</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalCompanies}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Super Admins</p>
                <p className="text-2xl font-bold text-purple-600">{stats.superAdmins}</p>
              </div>
              <Shield className="h-8 w-8 text-purple-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Orphaned Users</p>
                <p className="text-2xl font-bold text-red-600">{stats.orphanedUsers}</p>
              </div>
              <UserX className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white shadow-sm rounded-lg p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by company name, user name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-3 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Companies and Users */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white shadow-sm rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading users...</p>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="bg-white shadow-sm rounded-lg p-8 text-center">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No companies found matching your search</p>
            </div>
          ) : (
            filteredCompanies.map((company) => (
              <div key={company.id} className="bg-white shadow-sm rounded-lg overflow-hidden">
                {/* Company Header */}
                <div 
                  className="px-6 py-4 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleCompanyExpansion(company.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {expandedCompanies[company.id] ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                        <p className="text-sm text-gray-500">
                          {company.profiles?.length || 0} users • {company.main_contact_email}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/admin/companies/${company.id}`}
                      className="text-blue-600 hover:text-blue-900 text-sm"
                    >
                      Manage Company →
                    </Link>
                  </div>
                </div>

                {/* Users List */}
                {expandedCompanies[company.id] && (
                  <div className="divide-y divide-gray-200">
                    {company.profiles?.length === 0 ? (
                      <div className="px-6 py-4 text-center text-gray-500">
                        No users in this company
                      </div>
                    ) : (
                      company.profiles?.map((user) => (
                        <div key={user.id} className="px-6 py-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {user.full_name || 'No name'}
                                </div>
                                <div className="text-sm text-gray-500 flex items-center">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {user.email}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {getRoleIcon(user.role)}
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                  {getRoleLabel(user.role)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-4">
                              {/* Status */}
                              <div className="flex items-center">
                                {user.is_active !== false ? (
                                  <div className="flex items-center text-green-600">
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    <span className="text-sm">Active</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center text-red-600">
                                    <XCircle className="h-4 w-4 mr-1" />
                                    <span className="text-sm">Inactive</span>
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              {user.id !== currentProfile?.id && (
                                <div className="flex items-center space-x-2">
                                  {user.role !== 'super_admin' && (
                                    <button
                                      onClick={() => changeUserRole(user.id, user.role === 'user' ? 'company_admin' : 'user')}
                                      className="text-xs text-blue-600 hover:text-blue-900"
                                    >
                                      Make {user.role === 'user' ? 'Admin' : 'User'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => toggleUserStatus(user.id, user.is_active !== false)}
                                    className="text-xs text-gray-600 hover:text-gray-900"
                                  >
                                    {user.is_active !== false ? 'Deactivate' : 'Activate'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}