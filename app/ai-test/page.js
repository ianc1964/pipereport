'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getUserAISettings, saveAISettings } from '../../lib/ai-service'
import { Bot, CheckCircle, XCircle, AlertCircle, Key, Save } from 'lucide-react'

export default function AISettingsTestPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [aiSettings, setAISettings] = useState(null)
  const [tableExists, setTableExists] = useState(null)
  const [hasRLSAccess, setHasRLSAccess] = useState(null)
  const [errors, setErrors] = useState([])
  const [success, setSuccess] = useState('')
  
  // Form state for settings
  const [formData, setFormData] = useState({
    ai_enabled: false,
    runpod_api_key: '',
    auto_populate_enabled: true,
    confidence_threshold: 0.7,
    distance_ocr_enabled: true,
    object_detection_enabled: true
  })

  useEffect(() => {
    checkAISetup()
  }, [])

  const checkAISetup = async () => {
    setLoading(true)
    setErrors([])
    
    try {
      // 1. Check user authentication
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
      if (userError) throw new Error('Not authenticated')
      setUser(currentUser)
      console.log('✅ User authenticated:', currentUser.email)

      // 2. Check if ai_settings table exists
      const { data: tables, error: tableError } = await supabase
        .from('ai_settings')
        .select('*')
        .limit(1)
      
      if (tableError && tableError.code === '42P01') {
        setTableExists(false)
        setErrors(prev => [...prev, 'ai_settings table does not exist'])
        console.error('❌ Table does not exist')
      } else if (tableError && tableError.code === '42501') {
        setTableExists(true)
        setHasRLSAccess(false)
        setErrors(prev => [...prev, 'No permission to access ai_settings table (RLS issue)'])
        console.error('❌ RLS permission denied')
      } else {
        setTableExists(true)
        setHasRLSAccess(true)
        console.log('✅ Table exists and is accessible')
      }

      // 3. Try to get AI settings
      const settings = await getUserAISettings()
      setAISettings(settings)
      setFormData({
        ai_enabled: settings.ai_enabled || false,
        runpod_api_key: settings.runpod_api_key || '',
        auto_populate_enabled: settings.auto_populate_enabled !== false,
        confidence_threshold: settings.confidence_threshold || 0.7,
        distance_ocr_enabled: settings.distance_ocr_enabled !== false,
        object_detection_enabled: settings.object_detection_enabled !== false
      })
      console.log('📋 Current AI settings:', settings)

      // 4. Check ai_object_mappings table
      const { error: mappingError } = await supabase
        .from('ai_object_mappings')
        .select('*')
        .limit(1)
      
      if (mappingError) {
        setErrors(prev => [...prev, `ai_object_mappings table issue: ${mappingError.message}`])
      }

    } catch (error) {
      console.error('Setup check error:', error)
      setErrors(prev => [...prev, error.message])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setErrors([])
    setSuccess('')
    
    try {
      // Save settings
      await saveAISettings({
        ai_enabled: formData.ai_enabled,
        runpod_api_key_encrypted: formData.runpod_api_key,
        auto_populate_enabled: formData.auto_populate_enabled,
        confidence_threshold: formData.confidence_threshold,
        distance_ocr_enabled: formData.distance_ocr_enabled,
        object_detection_enabled: formData.object_detection_enabled
      })
      
      setSuccess('AI settings saved successfully!')
      
      // Reload settings
      await checkAISetup()
      
    } catch (error) {
      console.error('Save error:', error)
      setErrors([error.message])
    }
  }

  const createAISettingsTables = async () => {
    const createTableSQL = `
      -- Create ai_settings table if it doesn't exist
      CREATE TABLE IF NOT EXISTS ai_settings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
        runpod_api_key_encrypted TEXT,
        ai_enabled BOOLEAN DEFAULT false,
        auto_populate_enabled BOOLEAN DEFAULT true,
        confidence_threshold FLOAT DEFAULT 0.7,
        distance_ocr_enabled BOOLEAN DEFAULT true,
        object_detection_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Enable RLS
      ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

      -- Create policy for users to manage their own settings
      CREATE POLICY "Users can manage own AI settings" ON ai_settings
        FOR ALL USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

      -- Create ai_object_mappings table
      CREATE TABLE IF NOT EXISTS ai_object_mappings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        object_class TEXT UNIQUE NOT NULL,
        observation_code TEXT NOT NULL,
        confidence_threshold FLOAT DEFAULT 0.5,
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Enable RLS
      ALTER TABLE ai_object_mappings ENABLE ROW LEVEL SECURITY;

      -- Allow all authenticated users to read mappings
      CREATE POLICY "Users can read AI mappings" ON ai_object_mappings
        FOR SELECT USING (true);
    `
    
    alert('Copy this SQL and run it in your Supabase SQL editor:\n\n' + createTableSQL)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3">Checking AI setup...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Bot className="w-8 h-8 text-blue-600" />
            AI Settings Test & Configuration
          </h1>

          {/* Status Checks */}
          <div className="space-y-4 mb-8">
            <h2 className="text-lg font-semibold">System Status</h2>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {user ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span>User authenticated: {user?.email || 'Not authenticated'}</span>
              </div>

              <div className="flex items-center gap-2">
                {tableExists ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span>AI settings table exists</span>
              </div>

              <div className="flex items-center gap-2">
                {hasRLSAccess ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : tableExists === null ? (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span>RLS permissions configured</span>
              </div>

              <div className="flex items-center gap-2">
                {aiSettings?.ai_enabled && aiSettings?.runpod_api_key ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                <span>AI fully configured: {
                  aiSettings?.ai_enabled 
                    ? (aiSettings?.runpod_api_key ? 'Yes' : 'Missing API key')
                    : 'Disabled'
                }</span>
              </div>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
              <h3 className="font-semibold text-red-800 mb-2">Issues Found:</h3>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-red-700">{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800">{success}</p>
            </div>
          )}

          {/* Create Tables Button */}
          {!tableExists && (
            <div className="mb-6">
              <button
                onClick={createAISettingsTables}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Generate SQL to Create Missing Tables
              </button>
            </div>
          )}

          {/* Settings Form */}
          {tableExists && hasRLSAccess && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Configure AI Settings</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="ai_enabled"
                    checked={formData.ai_enabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, ai_enabled: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <label htmlFor="ai_enabled" className="font-medium">
                    Enable AI Analysis
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Key className="w-4 h-4 inline mr-1" />
                    RunPod API Key
                  </label>
                  <input
                    type="password"
                    value={formData.runpod_api_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, runpod_api_key: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your RunPod API key"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get your API key from RunPod dashboard
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-medium">AI Features</h3>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="auto_populate"
                      checked={formData.auto_populate_enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, auto_populate_enabled: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <label htmlFor="auto_populate">Auto-populate fields from AI results</label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="distance_ocr"
                      checked={formData.distance_ocr_enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, distance_ocr_enabled: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <label htmlFor="distance_ocr">Enable distance OCR</label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="object_detection"
                      checked={formData.object_detection_enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, object_detection_enabled: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <label htmlFor="object_detection">Enable object detection</label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confidence Threshold
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={formData.confidence_threshold}
                      onChange={(e) => setFormData(prev => ({ ...prev, confidence_threshold: parseFloat(e.target.value) }))}
                      className="w-32 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleSaveSettings}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4" />
                    Save AI Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Current Settings Display */}
          {aiSettings && (
            <div className="mt-8 p-4 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">Current Settings in Database:</h3>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(aiSettings, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}