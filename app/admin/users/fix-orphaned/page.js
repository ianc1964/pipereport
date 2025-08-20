'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import { 
  UserX, 
  Building2, 
  Plus,
  Link2,
  ChevronLeft,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

export default function FixOrphanedUsersPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <FixOrphanedUsersContent />
    </ProtectedRoute>
  )
}

function FixOrphanedUsersContent() {
  const [orphanedUsers, setOrphanedUsers] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState({})
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load orphaned users (company_admin without companies)
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'company_admin')
        .is('company_id', null)
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      // Load existing companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, main_contact_email')
        .order('name')

      if (companiesError) throw companiesError

      setOrphanedUsers(users || [])
      setCompanies(companiesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      setMessage({ type: 'error', text: 'Failed to load data' })
    } finally {
      setLoading(false)
    }
  }

  const createCompanyForUser = async (user) => {
    setProcessing(prev => ({ ...prev, [user.id]: true }))
    setMessage(null)

    try {
      // Generate company name from user's name or email
      const companyName = user.full_name 
        ? `${user.full_name}'s Company`
        : user.email.split('@')[0] + ' Company'

      // Create company with trial credits
      const { data: companyId, error: companyError } = await supabase
        .rpc('create_company_with_trial', {
          company_name: companyName,
          company_email: user.email,
          trial_credits: 100
        })

      if (companyError) throw companyError

      // Update user profile with company_id
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', user.id)

      if (updateError) throw updateError

      setMessage({ 
        type: 'success', 
        text: `Created company "${companyName}" for ${user.email}` 
      })
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error creating company:', error)
      setMessage({ 
        type: 'error', 
        text: `Failed to create company for ${user.email}: ${error.message}` 
      })
    } finally {
      setProcessing(prev => ({ ...prev, [user.id]: false }))
    }
  }

  const linkUserToCompany = async (userId, companyId) => {
    setProcessing(prev => ({ ...prev, [userId]: true }))
    setMessage(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', userId)

      if (error) throw error

      const company = companies.find(c => c.id === companyId)
      setMessage({ 
        type: 'success', 
        text: `Linked user to ${company?.name}` 
      })
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error linking user:', error)
      setMessage({ 
        type: 'error', 
        text: `Failed to link user: ${error.message}` 
      })
    } finally {
      setProcessing(prev => ({ ...prev, [userId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading orphaned users...</p>
        </div>
      </div>
    )
  }

  return (
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
              <UserX className="h-8 w-8 text-red-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Fix Orphaned Users</h1>
                <p className="text-gray-600">
                  {orphanedUsers.length} users without companies
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-md flex items-start ${
          message.type === 'error' 
            ? 'bg-red-50 border border-red-200 text-red-700' 
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {message.type === 'error' ? (
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">About Orphaned Users</p>
            <p>These are users with company_admin role but no associated company. You can:</p>
            <ul className="list-disc list-inside mt-1">
              <li>Create a new company for them (they'll get 100 trial credits)</li>
              <li>Link them to an existing company</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Orphaned Users List */}
      {orphanedUsers.length === 0 ? (
        <div className="bg-white shadow-sm rounded-lg p-8 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <p className="text-gray-600">No orphaned users found! All users are properly linked to companies.</p>
          <Link 
            href="/admin/users" 
            className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-500"
          >
            Go to Manage Users
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orphanedUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.full_name || 'No name'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => createCompanyForUser(user)}
                        disabled={processing[user.id]}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing[user.id] ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        ) : (
                          <>
                            <Plus className="w-3 h-3 mr-1" />
                            Create Company
                          </>
                        )}
                      </button>
                      
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            linkUserToCompany(user.id, e.target.value)
                          }
                        }}
                        disabled={processing[user.id]}
                        className="text-xs border border-gray-300 rounded-md px-2 py-1 disabled:opacity-50"
                      >
                        <option value="">Link to existing...</option>
                        {companies.map(company => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}