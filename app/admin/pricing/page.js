'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit2, Save, X, Plus, DollarSign, Activity, AlertCircle, Check } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth-context'
import ProtectedRoute from '../../../components/ProtectedRoute'

// Operation type descriptions for better UX
const OPERATION_DESCRIPTIONS = {
  video_upload: 'Credits charged when users upload video files',
  image_upload: 'Credits charged when users upload image files',
  image_capture: 'Credits charged when users capture frames from videos',
  ai_inference: 'Credits charged for AI object detection and OCR analysis',
  video_ai_analysis: 'Credits charged for AI analysis of entire video files (future feature)'
}

// Unit type options
const UNIT_TYPES = {
  video_upload: [
    { value: 'per_mb', label: 'Per Megabyte' },
    { value: 'per_gb', label: 'Per Gigabyte' },
    { value: 'per_upload', label: 'Per Upload (flat rate)' }
  ],
  image_upload: [
    { value: 'per_upload', label: 'Per Upload' },
    { value: 'per_mb', label: 'Per Megabyte' }
  ],
  image_capture: [
    { value: 'per_operation', label: 'Per Capture' }
  ],
  ai_inference: [
    { value: 'per_inference', label: 'Per Analysis' }
  ],
  video_ai_analysis: [
    { value: 'per_minute', label: 'Per Minute of Video' },
    { value: 'per_video', label: 'Per Video (flat rate)' }
  ]
}

export default function PricingRulesPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState([])
  const [editingRule, setEditingRule] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Load pricing rules
  useEffect(() => {
    loadPricingRules()
  }, [])

  const loadPricingRules = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_pricing_rules')
        .select('*')
        .order('operation_type')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Group rules by operation type and only show the active one
      const groupedRules = {}
      data.forEach(rule => {
        if (!groupedRules[rule.operation_type] || rule.is_active) {
          groupedRules[rule.operation_type] = rule
        }
      })

      // Convert back to array and add missing operation types
      const allOperationTypes = ['video_upload', 'image_upload', 'image_capture', 'ai_inference', 'video_ai_analysis']
      const rulesArray = allOperationTypes.map(opType => {
        return groupedRules[opType] || {
          operation_type: opType,
          unit_type: UNIT_TYPES[opType][0].value,
          credits_per_unit: 0,
          is_active: false,
          description: OPERATION_DESCRIPTIONS[opType]
        }
      })

      setRules(rulesArray)
    } catch (error) {
      console.error('Error loading pricing rules:', error)
      setError('Failed to load pricing rules')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (rule) => {
    setEditingRule({
      ...rule,
      credits_per_unit: parseFloat(rule.credits_per_unit) || 0
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      if (editingRule.id) {
        // Update existing rule
        const { error } = await supabase
          .from('credit_pricing_rules')
          .update({
            unit_type: editingRule.unit_type,
            credits_per_unit: editingRule.credits_per_unit,
            min_charge: editingRule.min_charge || 0,
            max_charge: editingRule.max_charge || null,
            description: editingRule.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRule.id)

        if (error) throw error
      } else {
        // First deactivate any existing rules for this operation type
        const { error: deactivateError } = await supabase
          .from('credit_pricing_rules')
          .update({ is_active: false })
          .eq('operation_type', editingRule.operation_type)
          .eq('is_active', true)

        if (deactivateError) throw deactivateError

        // Create new rule
        const { error } = await supabase
          .from('credit_pricing_rules')
          .insert({
            operation_type: editingRule.operation_type,
            unit_type: editingRule.unit_type,
            credits_per_unit: editingRule.credits_per_unit,
            min_charge: editingRule.min_charge || 0,
            max_charge: editingRule.max_charge || null,
            is_active: true,
            valid_from: new Date().toISOString(),
            description: editingRule.description
          })

        if (error) throw error
      }

      setSuccessMessage('Pricing rule saved successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
      setEditingRule(null)
      loadPricingRules()
    } catch (error) {
      console.error('Error saving pricing rule:', error)
      setError('Failed to save pricing rule')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (rule) => {
    try {
      const { error } = await supabase
        .from('credit_pricing_rules')
        .update({ 
          is_active: !rule.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', rule.id)

      if (error) throw error

      setSuccessMessage(`Rule ${rule.is_active ? 'deactivated' : 'activated'} successfully`)
      setTimeout(() => setSuccessMessage(null), 3000)
      loadPricingRules()
    } catch (error) {
      console.error('Error toggling rule:', error)
      setError('Failed to update rule status')
    }
  }

  const getOperationName = (operationType) => {
    const names = {
      video_upload: 'Video Upload',
      image_upload: 'Image Upload',
      image_capture: 'Frame Capture',
      ai_inference: 'AI Analysis',
      video_ai_analysis: 'Video AI Analysis'
    }
    return names[operationType] || operationType
  }

  const formatUnitType = (unitType) => {
    const formats = {
      per_mb: 'per MB',
      per_gb: 'per GB',
      per_upload: 'per upload',
      per_operation: 'per operation',
      per_inference: 'per analysis',
      per_minute: 'per minute',
      per_video: 'per video'
    }
    return formats[unitType] || unitType
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading pricing rules...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/admin" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Admin Dashboard
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Pricing Rules</h1>
                <p className="mt-2 text-gray-600">Manage credit consumption rates for different operations</p>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg flex items-center">
              <Check className="w-5 h-5 mr-2" />
              {successMessage}
            </div>
          )}

          {/* Info Box */}
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How Credit Pricing Works:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Video uploads can be charged per MB, GB, or flat rate per upload</li>
                  <li>Image operations are typically charged per upload or capture</li>
                  <li>AI analysis is charged separately from upload/capture operations</li>
                  <li>Only one pricing rule can be active per operation type</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Pricing Rules Table */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rules.map((rule) => (
                  <tr key={rule.operation_type} className={!rule.is_active ? 'bg-gray-50' : ''}>
                    {editingRule?.operation_type === rule.operation_type ? (
                      // Edit mode
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {getOperationName(rule.operation_type)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={editingRule.credits_per_unit}
                              onChange={(e) => setEditingRule({
                                ...editingRule,
                                credits_per_unit: parseFloat(e.target.value) || 0
                              })}
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                              step="0.1"
                              min="0"
                            />
                            <span className="text-sm text-gray-500">credits</span>
                            <select
                              value={editingRule.unit_type}
                              onChange={(e) => setEditingRule({
                                ...editingRule,
                                unit_type: e.target.value
                              })}
                              className="px-2 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                              {UNIT_TYPES[rule.operation_type].map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            rule.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editingRule.description || ''}
                            onChange={(e) => setEditingRule({
                              ...editingRule,
                              description: e.target.value
                            })}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                            placeholder="Add description..."
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="text-green-600 hover:text-green-900 mr-3"
                          >
                            {saving ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingRule(null)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    ) : (
                      // View mode
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {getOperationName(rule.operation_type)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {rule.id ? (
                              <>
                                <span className="font-medium">{parseFloat(rule.credits_per_unit)}</span>
                                <span className="text-gray-500 ml-1">credits {formatUnitType(rule.unit_type)}</span>
                              </>
                            ) : (
                              <span className="text-gray-400">Not configured</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            rule.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">
                            {rule.description || OPERATION_DESCRIPTIONS[rule.operation_type]}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEdit(rule)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {rule.id && (
                            <button
                              onClick={() => handleToggleActive(rule)}
                              className={`${
                                rule.is_active ? 'text-gray-600 hover:text-gray-900' : 'text-green-600 hover:text-green-900'
                              }`}
                              title={rule.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <Activity className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Example Calculations */}
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Example Credit Calculations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Current Video Upload Rate</h4>
                {(() => {
                  const videoRule = rules.find(r => r.operation_type === 'video_upload' && r.is_active)
                  if (!videoRule) return <p className="text-sm text-gray-500">No active video upload rule</p>
                  
                  const rate = parseFloat(videoRule.credits_per_unit)
                  if (videoRule.unit_type === 'per_mb') {
                    return (
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 10 MB video = {(10 * rate).toFixed(1)} credits</li>
                        <li>• 100 MB video = {(100 * rate).toFixed(1)} credits</li>
                        <li>• 1 GB video = {(1024 * rate).toFixed(1)} credits</li>
                      </ul>
                    )
                  } else if (videoRule.unit_type === 'per_gb') {
                    return (
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 100 MB video = {(0.1 * rate).toFixed(1)} credits</li>
                        <li>• 1 GB video = {rate.toFixed(1)} credits</li>
                        <li>• 5 GB video = {(5 * rate).toFixed(1)} credits</li>
                      </ul>
                    )
                  } else {
                    return (
                      <p className="text-sm text-gray-600">
                        Any size video = {rate} credits
                      </p>
                    )
                  }
                })()}
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Image Operations</h4>
                {(() => {
                  const imageUploadRule = rules.find(r => r.operation_type === 'image_upload' && r.is_active)
                  const imageCaptureRule = rules.find(r => r.operation_type === 'image_capture' && r.is_active)
                  const aiRule = rules.find(r => r.operation_type === 'ai_inference' && r.is_active)
                  
                  return (
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Upload image = {imageUploadRule ? parseFloat(imageUploadRule.credits_per_unit) : 0} credits</li>
                      <li>• Capture frame = {imageCaptureRule ? parseFloat(imageCaptureRule.credits_per_unit) : 0} credits</li>
                      <li>• AI analysis = {aiRule ? parseFloat(aiRule.credits_per_unit) : 0} credits</li>
                      <li className="font-medium">
                        • Capture + AI = {
                          (imageCaptureRule ? parseFloat(imageCaptureRule.credits_per_unit) : 0) + 
                          (aiRule ? parseFloat(aiRule.credits_per_unit) : 0)
                        } credits total
                      </li>
                    </ul>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}