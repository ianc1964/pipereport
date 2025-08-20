'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import RefreshButton from '@/components/RefreshButton'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Search,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/lib/auth-context'

function ObservationCodesAdminContent() {
  const { user, profile } = useAuth()
  const [codes, setCodes] = useState([])
  const [filteredCodes, setFilteredCodes] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Form states
  const [showForm, setShowForm] = useState(false)
  const [editingCode, setEditingCode] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    category: '',
    default_severity: null,
    band_options: [],
    material_options: [],
    type_options: [],
    dimension_options: [],
    requires_joint: false,
    requires_loss_percentage: false,
    continuous_defect_starts: false,
    continuous_defect_ends: false,
    clock_ref_count: 0,
    is_active: true
  })

  const loadCodes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('observation_codes')
        .select('*')
        .order('category', { ascending: true })
        .order('code', { ascending: true })

      if (error) throw error
      setCodes(data || [])
    } catch (error) {
      console.error('Failed to load observation codes:', error)
      setCodes([])
      alert('Failed to load observation codes')
    } finally {
      setLoading(false)
    }
  }

  // Load observation codes on mount
  useEffect(() => {
    loadCodes()
  }, [])

  // Filter codes based on search and filters
  useEffect(() => {
    let filtered = codes

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(code => 
        code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(code => code.category === selectedCategory)
    }

    // Filter by active status
    if (!showInactive) {
      filtered = filtered.filter(code => code.is_active)
    }

    setFilteredCodes(filtered)
  }, [codes, searchTerm, selectedCategory, showInactive])

  const handleEdit = (code) => {
    setEditingCode(code)
    setFormData({
      code: code.code,
      description: code.description,
      category: code.category,
      default_severity: code.default_severity || null,
      band_options: code.band_options || [],
      material_options: code.material_options || [],
      type_options: code.type_options || [],
      dimension_options: code.dimension_options || [],
      requires_joint: code.requires_joint || false,
      requires_loss_percentage: code.requires_loss_percentage || false,
      continuous_defect_starts: code.continuous_defect_starts || false,
      continuous_defect_ends: code.continuous_defect_ends || false,
      clock_ref_count: code.clock_ref_count || 0,
      is_active: code.is_active
    })
    setShowForm(true)
  }

  const handleAdd = () => {
    setEditingCode(null)
    setFormData({
      code: '',
      description: '',
      category: '',
      default_severity: null,
      band_options: [],
      material_options: [],
      type_options: [],
      dimension_options: [],
      requires_joint: false,
      requires_loss_percentage: false,
      continuous_defect_starts: false,
      continuous_defect_ends: false,
      clock_ref_count: 0,
      is_active: true
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.code || !formData.description || !formData.category) {
      alert('Code, description, and category are required')
      return
    }

    setSaving(true)
    try {
      const saveData = {
        ...formData,
        updated_at: new Date().toISOString()
      }

      if (editingCode) {
        // Update existing
        const { error } = await supabase
          .from('observation_codes')
          .update(saveData)
          .eq('id', editingCode.id)
        
        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('observation_codes')
          .insert([{
            ...saveData,
            created_at: new Date().toISOString()
          }])
        
        if (error) throw error
      }

      await loadCodes()
      setShowForm(false)
      setEditingCode(null)
    } catch (error) {
      console.error('Failed to save observation code:', error)
      alert('Failed to save observation code: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (code) => {
    if (!confirm(`Are you sure you want to delete observation code "${code.code}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('observation_codes')
        .delete()
        .eq('id', code.id)

      if (error) throw error
      await loadCodes()
    } catch (error) {
      console.error('Failed to delete observation code:', error)
      alert('Failed to delete observation code: ' + error.message)
    }
  }

  const handleToggleActive = async (code) => {
    try {
      const { error } = await supabase
        .from('observation_codes')
        .update({ 
          is_active: !code.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', code.id)

      if (error) throw error
      await loadCodes()
    } catch (error) {
      console.error('Failed to toggle active status:', error)
      alert('Failed to update code status')
    }
  }

  const categories = [...new Set(codes.map(code => code.category))].sort()

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setFormData(prev => ({ ...prev, category: newCategory.trim() }))
      setNewCategory('')
    }
  }

  const ArrayInput = ({ label, value, onChange, placeholder }) => {
    const [inputValue, setInputValue] = useState('')
    
    const addItem = () => {
      if (inputValue.trim() && !value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()])
        setInputValue('')
      }
    }
    
    const removeItem = (index) => {
      onChange(value.filter((_, i) => i !== index))
    }

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="button"
              onClick={addItem}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Add
            </button>
          </div>
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {value.map((item, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading observation codes...</p>
        </div>
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
              <h1 className="text-3xl font-bold text-gray-900">Observation Codes Manager</h1>
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                Admin Only
              </span>
            </div>
            <p className="text-gray-600">Manage your observation code templates and standards</p>
            <p className="text-sm text-gray-500 mt-1">
              <Link href="/" className="text-blue-600 hover:text-blue-800">
                ← Back to Projects
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RefreshButton />
            <button 
              onClick={handleAdd}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Code
            </button>
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
              placeholder="Search codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
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
            <span>Total: {filteredCodes.length} codes</span>
          </div>
        </div>
      </div>

      {/* Codes Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code & Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Configuration
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
              {filteredCodes.map((code) => (
                <tr key={code.id} className={`hover:bg-gray-50 ${!code.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{code.code}</div>
                      <div className="text-sm text-gray-500">{code.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {code.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="space-y-1">
                      <div>
                        Default Severity: {code.default_severity ? code.default_severity : 'None'}
                      </div>
                      {/* Show option counts */}
                      <div className="text-xs space-y-1">
                        {code.band_options?.length > 0 && <div>• Band: {code.band_options.length} options</div>}
                        {code.material_options?.length > 0 && <div>• Material: {code.material_options.length} options</div>}
                        {code.type_options?.length > 0 && <div>• Type: {code.type_options.length} options</div>}
                        {code.dimension_options?.length > 0 && <div>• Dimension: {code.dimension_options.length} options</div>}
                      </div>
                      {/* Optional indicators */}
                      <div className="text-xs space-y-1">
                        {code.requires_joint && <div className="text-blue-600">• Joint Available</div>}
                        {code.requires_loss_percentage && <div className="text-blue-600">• Loss % Available</div>}
                        {code.continuous_defect_starts && <div className="text-green-600">• Cont. Defect Starts Available</div>}
                        {code.continuous_defect_ends && <div className="text-green-600">• Cont. Defect Ends Available</div>}
                        {code.clock_ref_count > 0 && <div className="text-blue-600">• Clock Refs: {code.clock_ref_count}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(code)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        code.is_active 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {code.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(code)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit code"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(code)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete code"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCodes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No observation codes found.</p>
            {searchTerm || selectedCategory ? (
              <p className="text-sm">Try adjusting your filters or search term.</p>
            ) : (
              <p className="text-sm">Click "Add Code" to create your first observation code.</p>
            )}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingCode ? 'Edit Observation Code' : 'Add New Observation Code'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Basic Info */}
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Basic Information</h3>
                  
                  <div>
                    <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                      Code *
                    </label>
                    <input
                      id="code"
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. DT-001"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description *
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      placeholder="Detailed description of this observation type"
                    />
                  </div>

                  {/* Enhanced Category Selection */}
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <div className="space-y-2">
                      <select
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select existing category...</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      
                      <div className="text-xs text-gray-500 text-center">OR</div>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          placeholder="Create new category..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="default-severity" className="block text-sm font-medium text-gray-700 mb-1">
                      Default Severity Grade
                    </label>
                    <select
                      id="default-severity"
                      value={formData.default_severity || ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        default_severity: e.target.value ? parseInt(e.target.value) : null
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No default severity</option>
                      <option value="1">1 - Minor</option>
                      <option value="2">2 - Low</option>
                      <option value="3">3 - Medium</option>
                      <option value="4">4 - High</option>
                      <option value="5">5 - Critical</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      This severity will be auto-selected but users can change it when creating observations
                    </p>
                  </div>

                  <div>
                    <label htmlFor="clock-refs" className="block text-sm font-medium text-gray-700 mb-1">
                      Clock References Required
                    </label>
                    <select
                      id="clock-refs"
                      value={formData.clock_ref_count}
                      onChange={(e) => setFormData(prev => ({ ...prev, clock_ref_count: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>None</option>
                      <option value={1}>1 Reference</option>
                      <option value={2}>2 References</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Active (available for use)</span>
                    </label>
                  </div>
                </div>

                {/* Right Column - Configuration Options */}
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Configuration Options</h3>
                  
                  {/* Optional Fields Section */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-800 mb-3">Optional Fields Available</h4>
                    <div className="space-y-3 bg-gray-50 p-4 rounded-md">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.requires_joint}
                          onChange={(e) => setFormData(prev => ({ ...prev, requires_joint: e.target.checked }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Joint Indicator <span className="text-xs text-gray-500">(optional for users)</span></span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.requires_loss_percentage}
                          onChange={(e) => setFormData(prev => ({ ...prev, requires_loss_percentage: e.target.checked }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Loss Percentage <span className="text-xs text-gray-500">(optional for users)</span></span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.continuous_defect_starts}
                          onChange={(e) => setFormData(prev => ({ ...prev, continuous_defect_starts: e.target.checked }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Continuous Defect Starts <span className="text-xs text-gray-500">(optional for users)</span></span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.continuous_defect_ends}
                          onChange={(e) => setFormData(prev => ({ ...prev, continuous_defect_ends: e.target.checked }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Continuous Defect Ends <span className="text-xs text-gray-500">(optional for users)</span></span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      These fields will be available to users but can be left empty
                    </p>
                  </div>

                  {/* Dropdown Options */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-800">Dropdown Options</h4>
                    
                    <ArrayInput
                      label="Band Options"
                      value={formData.band_options}
                      onChange={(value) => setFormData(prev => ({ ...prev, band_options: value }))}
                      placeholder="e.g. A, B, C"
                    />

                    <ArrayInput
                      label="Material Options"
                      value={formData.material_options}
                      onChange={(value) => setFormData(prev => ({ ...prev, material_options: value }))}
                      placeholder="e.g. Steel, Plastic, Concrete"
                    />

                    <ArrayInput
                      label="Type Options"
                      value={formData.type_options}
                      onChange={(value) => setFormData(prev => ({ ...prev, type_options: value }))}
                      placeholder="e.g. Crack, Corrosion, Wear"
                    />

                    <ArrayInput
                      label="Dimension Options"
                      value={formData.dimension_options}
                      onChange={(value) => setFormData(prev => ({ ...prev, dimension_options: value }))}
                      placeholder="e.g. Width, Height, Diameter"
                    />
                  </div>
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
                  {saving ? 'Saving...' : 'Save Code'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function ObservationCodesAdminPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <ObservationCodesAdminContent />
    </ProtectedRoute>
  )
}