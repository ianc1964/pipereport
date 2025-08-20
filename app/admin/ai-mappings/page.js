'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Search,
  Filter,
  Eye,
  EyeOff,
  Bot,
  Target,
  AlertTriangle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/lib/auth-context'

function AIObjectMappingsAdminContent() {
  const { user, profile } = useAuth()
  const [mappings, setMappings] = useState([])
  const [filteredMappings, setFilteredMappings] = useState([])
  const [observationCodes, setObservationCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCode, setSelectedCode] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  
  // Form states
  const [showForm, setShowForm] = useState(false)
  const [editingMapping, setEditingMapping] = useState(null)
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    object_class: '',
    observation_code: '',
    confidence_threshold: 0.7,
    is_active: true
  })

  // Load data on mount
  useEffect(() => {
    loadMappings()
    loadObservationCodes()
  }, [])

  // Filter mappings based on search and filters
  useEffect(() => {
    let filtered = mappings

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(mapping => 
        mapping.object_class.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mapping.observation_code.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by observation code
    if (selectedCode) {
      filtered = filtered.filter(mapping => mapping.observation_code === selectedCode)
    }

    // Filter by active status
    if (!showInactive) {
      filtered = filtered.filter(mapping => mapping.is_active)
    }

    setFilteredMappings(filtered)
  }, [mappings, searchTerm, selectedCode, showInactive])

  const loadMappings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('ai_object_mappings')
        .select('*')
        .order('object_class', { ascending: true })

      if (error) throw error
      setMappings(data || [])
    } catch (error) {
      console.error('Failed to load AI object mappings:', error)
      alert('Failed to load AI object mappings')
    } finally {
      setLoading(false)
    }
  }

  const loadObservationCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('observation_codes')
        .select('code, description, category')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('code', { ascending: true })

      if (error) throw error
      setObservationCodes(data || [])
    } catch (error) {
      console.error('Failed to load observation codes:', error)
    }
  }

  const handleEdit = (mapping) => {
    setEditingMapping(mapping)
    setFormData({
      object_class: mapping.object_class,
      observation_code: mapping.observation_code,
      confidence_threshold: mapping.confidence_threshold,
      is_active: mapping.is_active
    })
    setShowForm(true)
  }

  const handleAdd = () => {
    setEditingMapping(null)
    setFormData({
      object_class: '',
      observation_code: '',
      confidence_threshold: 0.7,
      is_active: true
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.object_class || !formData.observation_code) {
      alert('Object class and observation code are required')
      return
    }

    // Validate confidence threshold
    if (formData.confidence_threshold < 0 || formData.confidence_threshold > 1) {
      alert('Confidence threshold must be between 0 and 1')
      return
    }

    setSaving(true)
    try {
      const saveData = {
        ...formData,
        object_class: formData.object_class.toLowerCase().trim(),
        updated_at: new Date().toISOString()
      }

      if (editingMapping) {
        // Update existing
        const { error } = await supabase
          .from('ai_object_mappings')
          .update(saveData)
          .eq('id', editingMapping.id)
        
        if (error) throw error
      } else {
        // Create new - add created_by
        const { error } = await supabase
          .from('ai_object_mappings')
          .insert([{
            ...saveData,
            created_by: user?.id,
            created_at: new Date().toISOString()
          }])
        
        if (error) throw error
      }

      await loadMappings()
      setShowForm(false)
      setEditingMapping(null)
    } catch (error) {
      console.error('Failed to save AI object mapping:', error)
      if (error.message?.includes('duplicate key')) {
        alert('An object class can only be mapped to one observation code. This object class already exists.')
      } else {
        alert('Failed to save AI object mapping: ' + error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (mapping) => {
    if (!confirm(`Are you sure you want to delete the mapping for "${mapping.object_class}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('ai_object_mappings')
        .delete()
        .eq('id', mapping.id)

      if (error) throw error
      await loadMappings()
    } catch (error) {
      console.error('Failed to delete AI object mapping:', error)
      alert('Failed to delete AI object mapping: ' + error.message)
    }
  }

  const handleToggleActive = async (mapping) => {
    try {
      const { error } = await supabase
        .from('ai_object_mappings')
        .update({ 
          is_active: !mapping.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', mapping.id)

      if (error) throw error
      await loadMappings()
    } catch (error) {
      console.error('Failed to toggle active status:', error)
      alert('Failed to update mapping status')
    }
  }

  // Get unique observation codes for filter
  const uniqueCodes = [...new Set(mappings.map(mapping => mapping.observation_code))].sort()

  // Group observation codes by category for the form dropdown
  const groupedObservationCodes = observationCodes.reduce((groups, code) => {
    const category = code.category || 'Other'
    if (!groups[category]) groups[category] = []
    groups[category].push(code)
    return groups
  }, {})

  // Suggested object classes (common YOLO detections)
  const suggestedObjectClasses = [
    'crack', 'joint', 'pipe', 'defect', 'damage', 'blockage', 'corrosion', 
    'leak', 'displacement', 'deformation', 'infiltration', 'root', 'debris',
    'hole', 'fracture', 'surface_damage', 'structural_defect', 'connection'
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-lg text-gray-500">Loading AI object mappings...</div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">AI Object Mappings</h1>
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                Admin Only
              </span>
            </div>
            <p className="text-gray-600">Map AI-detected object classes to observation codes</p>
            <p className="text-sm text-gray-500 mt-1">
              <Link href="/admin/observation-codes" className="text-blue-600 hover:text-blue-800">
                ← Back to Observation Codes
              </Link>
              {" | "}
              <Link href="/" className="text-blue-600 hover:text-blue-800">
                Projects
              </Link>
            </p>
          </div>
          <button 
            onClick={handleAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Mapping
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Target className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">How AI Object Mapping Works</h3>
            <p className="text-sm text-blue-700 mt-1">
              When AI analyzes a video frame, it detects objects like "crack" or "joint". These mappings tell the system 
              which observation code to suggest. For example, if AI detects a "crack" with 80% confidence, and you've mapped 
              "crack" → "DT-001", the system will auto-populate the observation form with code "DT-001".
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search object classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Code Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Codes</option>
              {uniqueCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          {/* Show Inactive Toggle */}
          <div className="flex items-center">
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border ${
                showInactive ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Show Inactive
            </button>
          </div>

          {/* Stats */}
          <div className="text-sm text-gray-600 flex items-center">
            <span>Total: {filteredMappings.length} mappings</span>
          </div>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Object Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Observation Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence Threshold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMappings.map((mapping) => {
                const relatedCode = observationCodes.find(code => code.code === mapping.observation_code)
                return (
                  <tr key={mapping.id} className={`hover:bg-gray-50 ${!mapping.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{mapping.object_class}</div>
                          <div className="text-xs text-gray-500">AI-detected object</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{mapping.observation_code}</div>
                        {relatedCode && (
                          <div className="text-xs text-gray-500">{relatedCode.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-900">{(mapping.confidence_threshold * 100).toFixed(0)}%</div>
                        <div className={`w-2 h-2 rounded-full ${
                          mapping.confidence_threshold >= 0.8 ? 'bg-green-500' : 
                          mapping.confidence_threshold >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`} title={`${mapping.confidence_threshold >= 0.8 ? 'High' : mapping.confidence_threshold >= 0.6 ? 'Medium' : 'Low'} confidence`} />
                      </div>
                      <div className="text-xs text-gray-500">
                        {mapping.confidence_threshold >= 0.8 ? 'High confidence' : 
                         mapping.confidence_threshold >= 0.6 ? 'Medium confidence' : 'Low confidence'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(mapping)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          mapping.is_active 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {mapping.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(mapping)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit mapping"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mapping)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete mapping"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredMappings.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p>No AI object mappings found.</p>
            {searchTerm || selectedCode ? (
              <p className="text-sm">Try adjusting your filters or search term.</p>
            ) : (
              <p className="text-sm">Click "Add Mapping" to create your first object class mapping.</p>
            )}
          </div>
        )}
      </div>

      {/* Warning Box */}
      {mappings.length === 0 && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">No AI Mappings Configured</h3>
              <p className="text-sm text-yellow-700 mt-1">
                AI analysis will only suggest observation codes if you create mappings between object classes and your observation codes. 
                Start by adding some common mappings like "crack" → "DT-001" or "joint" → "JT-001".
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingMapping ? 'Edit AI Object Mapping' : 'Add New AI Object Mapping'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {/* Object Class */}
                <div>
                  <label htmlFor="object-class" className="block text-sm font-medium text-gray-700 mb-1">
                    Object Class *
                  </label>
                  <input
                    id="object-class"
                    list="suggested-classes"
                    type="text"
                    value={formData.object_class}
                    onChange={(e) => setFormData(prev => ({ ...prev, object_class: e.target.value.toLowerCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. crack, joint, pipe, defect"
                  />
                  <datalist id="suggested-classes">
                    {suggestedObjectClasses.map(className => (
                      <option key={className} value={className} />
                    ))}
                  </datalist>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the object class name that your YOLO model detects (must be lowercase)
                  </p>
                </div>

                {/* Observation Code */}
                <div>
                  <label htmlFor="observation-code" className="block text-sm font-medium text-gray-700 mb-1">
                    Observation Code *
                  </label>
                  <select
                    id="observation-code"
                    value={formData.observation_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, observation_code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select observation code...</option>
                    {Object.entries(groupedObservationCodes).map(([category, codes]) => (
                      <optgroup key={category} label={category}>
                        {codes.map(code => (
                          <option key={code.code} value={code.code}>
                            {code.code} - {code.description}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select which observation code should be suggested when this object is detected
                  </p>
                </div>

                {/* Confidence Threshold */}
                <div>
                  <label htmlFor="confidence-threshold" className="block text-sm font-medium text-gray-700 mb-1">
                    Confidence Threshold
                  </label>
                  <div className="space-y-2">
                    <input
                      id="confidence-threshold"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.confidence_threshold}
                      onChange={(e) => setFormData(prev => ({ ...prev, confidence_threshold: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0% (Accept all)</span>
                      <span className="font-medium">{(formData.confidence_threshold * 100).toFixed(0)}%</span>
                      <span>100% (Very strict)</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    AI detection must be above this confidence level to suggest this observation code
                  </p>
                </div>

                {/* Active Status */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Active (available for AI suggestions)
                    </span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                <button
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Mapping'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function AIObjectMappingsAdminPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <AIObjectMappingsAdminContent />
    </ProtectedRoute>
  )
}