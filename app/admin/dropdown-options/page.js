'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Plus, Edit2, Trash2, Save, X, Search, Filter, Eye, EyeOff,
  ArrowUp, ArrowDown, Settings, List
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/lib/auth-context'

function DropdownAdminContent() {
  const { user, profile } = useAuth()
  const [options, setOptions] = useState([])
  const [filteredOptions, setFilteredOptions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  
  // Form states
  const [showForm, setShowForm] = useState(false)
  const [editingOption, setEditingOption] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  
  const [formData, setFormData] = useState({
    category: '',
    value: '',
    display_order: 0,
    is_active: true,
    is_default: false
  })

  // All possible categories for the form
  const allCategories = [
    'start_type', 'finish_type', 'direction', 'diameter', 'use_type', 'material',
    'shape', 'section_type', 'lining_type', 'lining_material', 'inspection_purpose',
    'flow_control', 'precleaned', 'survey_method', 'location_type', 'weather'
  ]

  // Category display names
  const categoryLabels = {
    'start_type': 'Start Types',
    'finish_type': 'Finish Types', 
    'direction': 'Directions',
    'diameter': 'Diameters (mm)',
    'use_type': 'Use Types',
    'material': 'Materials',
    'shape': 'Shapes',
    'section_type': 'Section Types',
    'lining_type': 'Lining Types',
    'lining_material': 'Lining Materials',
    'inspection_purpose': 'Inspection Purposes',
    'flow_control': 'Flow Control',
    'precleaned': 'Precleaned',
    'survey_method': 'Survey Methods',
    'location_type': 'Location Types',
    'weather': 'Weather'
  }

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    let filtered = options

    if (searchTerm) {
      filtered = filtered.filter(option => 
        option.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter(option => option.category === selectedCategory)
    }

    if (!showInactive) {
      filtered = filtered.filter(option => option.is_active)
    }

    setFilteredOptions(filtered)
  }, [options, searchTerm, selectedCategory, showInactive])

  const loadOptions = async () => {
    try {
      setLoading(true)
      console.log('Loading dropdown options...')
      
      const { data, error } = await supabase
        .from('dropdown_options')
        .select('*')
        .order('category', { ascending: true })
        .order('display_order', { ascending: true })

      if (error) {
        console.error('Database error loading options:', error)
        throw error
      }
      
      console.log('Loaded options:', data?.length)
      setOptions(data || [])
      
      // Extract unique categories
      const uniqueCategories = [...new Set((data || []).map(opt => opt.category))].sort()
      setCategories(uniqueCategories)
      
    } catch (error) {
      console.error('Failed to load dropdown options:', error)
      alert('Failed to load dropdown options: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (option) => {
    console.log('Editing option:', option)
    setEditingOption(option)
    setFormData({
      category: option.category,
      value: option.value,
      display_order: option.display_order || 0,
      is_active: option.is_active,
      is_default: option.is_default || false
    })
    setShowForm(true)
  }

  const handleAdd = () => {
    console.log('Adding new option')
    setEditingOption(null)
    setFormData({
      category: selectedCategory || '',
      value: '',
      display_order: 0,
      is_active: true,
      is_default: false
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.category || !formData.value) {
      alert('Category and value are required')
      return
    }

    setSaving(true)
    try {
      console.log('Saving data:', formData)
      
      const saveData = {
        category: formData.category,
        value: formData.value,
        display_order: parseInt(formData.display_order) || 0,
        is_active: formData.is_active,
        is_default: formData.is_default,
        updated_at: new Date().toISOString()
      }

      let result

      if (editingOption) {
        console.log('Updating existing option:', editingOption.id)
        result = await supabase
          .from('dropdown_options')
          .update(saveData)
          .eq('id', editingOption.id)
          .select()
        
        if (result.error) throw result.error
        console.log('Update result:', result)
      } else {
        console.log('Creating new option')
        result = await supabase
          .from('dropdown_options')
          .insert([{
            ...saveData,
            created_at: new Date().toISOString()
          }])
          .select()
        
        if (result.error) throw result.error
        console.log('Insert result:', result)
      }

      await loadOptions()
      setShowForm(false)
      setEditingOption(null)
      
      // Show success message
      alert(editingOption ? 'Option updated successfully!' : 'Option created successfully!')
      
    } catch (error) {
      console.error('Failed to save dropdown option:', error)
      
      // More detailed error messages
      if (error.message.includes('row-level security')) {
        alert('Access denied: You may not have admin privileges. Please check with your administrator.')
      } else if (error.message.includes('duplicate key')) {
        alert('This option already exists in this category.')
      } else if (error.message.includes('foreign key')) {
        alert('Invalid category or reference.')
      } else {
        alert('Failed to save dropdown option: ' + error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (option) => {
    if (!confirm(`Are you sure you want to delete "${option.value}" from ${categoryLabels[option.category]}?`)) {
      return
    }

    try {
      console.log('Deleting option:', option.id)
      const { error } = await supabase
        .from('dropdown_options')
        .delete()
        .eq('id', option.id)

      if (error) throw error
      
      await loadOptions()
      alert('Option deleted successfully!')
    } catch (error) {
      console.error('Failed to delete dropdown option:', error)
      alert('Failed to delete dropdown option: ' + error.message)
    }
  }

  const handleToggleActive = async (option) => {
    try {
      console.log('Toggling active status for:', option.id)
      const { error } = await supabase
        .from('dropdown_options')
        .update({ 
          is_active: !option.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', option.id)

      if (error) throw error
      await loadOptions()
    } catch (error) {
      console.error('Failed to toggle active status:', error)
      alert('Failed to update option status: ' + error.message)
    }
  }

  const handleMoveOrder = async (option, direction) => {
    const categoryOptions = options.filter(opt => 
      opt.category === option.category && opt.is_active
    ).sort((a, b) => a.display_order - b.display_order)
    
    const currentIndex = categoryOptions.findIndex(opt => opt.id === option.id)
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    
    if (newIndex < 0 || newIndex >= categoryOptions.length) return
    
    const swapOption = categoryOptions[newIndex]
    
    try {
      console.log('Reordering options')
      await supabase
        .from('dropdown_options')
        .update({ 
          display_order: swapOption.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', option.id)
      
      await supabase
        .from('dropdown_options')
        .update({ 
          display_order: option.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', swapOption.id)
      
      await loadOptions()
    } catch (error) {
      console.error('Failed to reorder options:', error)
      alert('Failed to reorder options: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-lg text-gray-500">Loading dropdown options...</div>
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
              <h1 className="text-3xl font-bold text-gray-900">Dropdown Options Manager</h1>
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                Admin Only
              </span>
            </div>
            <p className="text-gray-600">Manage dropdown options for section details forms</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <Link href="/" className="text-blue-600 hover:text-blue-800">
                ← Back to Projects
              </Link>
              <Link href="/admin/observation-codes" className="text-blue-600 hover:text-blue-800">
                Observation Codes →
              </Link>
            </div>
          </div>
          <button 
            onClick={handleAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Option
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {categoryLabels[category] || category}
                </option>
              ))}
            </select>
          </div>

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

          <div className="text-sm text-gray-600 flex items-center">
            <span>Total: {filteredOptions.length} options</span>
          </div>
        </div>
      </div>

      {/* Options Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
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
              {filteredOptions.map((option) => (
                <tr key={option.id} className={`hover:bg-gray-50 ${!option.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {categoryLabels[option.category] || option.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">{option.value}</span>
                      {option.is_default && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Default
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <span>{option.display_order}</span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => handleMoveOrder(option, 'up')}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveOrder(option, 'down')}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(option)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        option.is_active 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {option.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(option)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit option"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(option)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete option"
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

        {filteredOptions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No dropdown options found.</p>
            {searchTerm || selectedCategory ? (
              <p className="text-sm">Try adjusting your filters or search term.</p>
            ) : (
              <p className="text-sm">Click "Add Option" to create your first dropdown option.</p>
            )}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingOption ? 'Edit Dropdown Option' : 'Add New Dropdown Option'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category...</option>
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="value" className="block text-sm font-medium text-gray-700 mb-1">
                    Value *
                  </label>
                  <input
                    id="value"
                    type="text"
                    value={formData.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter option value"
                  />
                </div>

                <div>
                  <label htmlFor="display_order" className="block text-sm font-medium text-gray-700 mb-1">
                    Display Order
                  </label>
                  <input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Default Selection</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
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
                  {saving ? 'Saving...' : 'Save Option'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function DropdownAdminPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <DropdownAdminContent />
    </ProtectedRoute>
  )
}