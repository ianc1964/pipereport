'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function TestDatabase() {
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkDatabase()
  }, [])

  const checkDatabase = async () => {
    try {
      const checks = {}

      // Test 1: Check companies table
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .limit(1)
      
      checks.companies = {
        exists: !companiesError,
        error: companiesError?.message,
        sample: companies?.[0],
        columns: companies?.[0] ? Object.keys(companies[0]) : []
      }

      // Test 2: Check user_credits table
      const { data: credits, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .limit(1)
      
      checks.user_credits = {
        exists: !creditsError,
        error: creditsError?.message,
        sample: credits?.[0],
        columns: credits?.[0] ? Object.keys(credits[0]) : []
      }

      // Test 3: Check profiles table
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)
      
      checks.profiles = {
        exists: !profilesError,
        error: profilesError?.message,
        sample: profiles?.[0],
        columns: profiles?.[0] ? Object.keys(profiles[0]) : []
      }

      // Test 4: Check the join query
      const { data: joinTest, error: joinError } = await supabase
        .from('companies')
        .select(`
          *,
          user_credits(*)
        `)
        .limit(1)
      
      checks.joinQuery = {
        success: !joinError,
        error: joinError?.message,
        data: joinTest?.[0]
      }

      setResults(checks)
    } catch (error) {
      console.error('Error checking database:', error)
      setResults({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Database Structure Check</h1>
        
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(results).map(([table, info]) => (
              <div key={table} className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-2">{table}</h2>
                
                {info.error ? (
                  <div className="text-red-600">
                    <p>Error: {info.error}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-green-600 mb-2">✓ Table exists</p>
                    
                    {info.columns && (
                      <div className="mb-4">
                        <p className="font-medium mb-1">Columns:</p>
                        <div className="bg-gray-100 p-2 rounded text-sm">
                          {info.columns.join(', ')}
                        </div>
                      </div>
                    )}
                    
                    {info.sample && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-blue-600">View sample data</summary>
                        <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-auto">
                          {JSON.stringify(info.sample, null, 2)}
                        </pre>
                      </details>
                    )}
                    
                    {info.data && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-blue-600">View join result</summary>
                        <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-auto">
                          {JSON.stringify(info.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}