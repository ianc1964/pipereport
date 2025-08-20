'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function DebugCompanies() {
  const { profile, isSuperAdmin } = useAuth()
  const [sqlResults, setSqlResults] = useState(null)
  const [appResults, setAppResults] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    debugCompanies()
  }, [])

  const debugCompanies = async () => {
    try {
      console.log('Current user:', profile)
      console.log('Is super admin:', isSuperAdmin)

      // Test 1: Direct SQL query (bypasses RLS)
      const { data: sqlData, error: sqlError } = await supabase
        .rpc('get_all_companies_debug')
      
      if (!sqlError) {
        setSqlResults(sqlData)
      } else {
        console.log('SQL function might not exist, trying regular query')
      }

      // Test 2: App query (uses RLS)
      const { data: appData, error: appError } = await supabase
        .from('companies')
        .select(`
          *,
          user_credits(balance),
          profiles(count)
        `)

      if (appError) {
        setError(appError)
        console.error('App query error:', appError)
      } else {
        setAppResults(appData)
      }

      // Test 3: Simple count
      const { count, error: countError } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })

      console.log('Company count:', count)
      console.log('Count error:', countError)

    } catch (err) {
      console.error('Debug error:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-6">Loading debug info...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Companies Debug Info</h1>
      
      {/* User Info */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Current User</h2>
        <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
          {JSON.stringify({
            id: profile?.id,
            email: profile?.email,
            role: profile?.role,
            company_id: profile?.company_id,
            is_super_admin: isSuperAdmin
          }, null, 2)}
        </pre>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 p-4 rounded shadow">
          <h2 className="font-semibold mb-2 text-red-700">Error</h2>
          <pre className="text-sm text-red-600">
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      )}

      {/* App Query Results */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">
          App Query Results (with RLS) - Found {appResults?.length || 0} companies
        </h2>
        {appResults && appResults.length > 0 ? (
          <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify(appResults, null, 2)}
          </pre>
        ) : (
          <p className="text-red-600">No companies visible through app query!</p>
        )}
      </div>

      {/* SQL Results */}
      {sqlResults && (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">
            Direct SQL Results - Found {sqlResults?.length || 0} companies
          </h2>
          <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify(sqlResults, null, 2)}
          </pre>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-blue-50 p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Quick Fix Actions</h2>
        <p className="text-sm mb-2">Run these SQL commands in Supabase:</p>
        <pre className="text-xs bg-white p-2 rounded overflow-auto">
{`-- Make sure you're a super admin
UPDATE profiles SET role = 'super_admin' WHERE id = auth.uid();

-- Check if companies table has RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'companies';

-- If RLS is enabled, check policies
SELECT policyname FROM pg_policies WHERE tablename = 'companies';`}
        </pre>
      </div>
    </div>
  )
}