'use client'
import { useState, useEffect } from 'react'
import { 
  getAllNodeTypes, 
  createNodeType, 
  updateNodeType, 
  deleteNodeType,
  toggleNodeTypeActive 
} from '@/lib/maps'

// Available shapes for nodes
const SHAPE_OPTIONS = ['circle', 'square', 'triangle', 'diamond', 'hexagon']

// Predefined colors
const COLOR_OPTIONS = [
  { name: 'Brown', value: '#8B4513' },
  { name: 'Indigo', value: '#4B0082' },
  { name: 'Green', value: '#228B22' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Orange', value: '#FF8C00' },
  { name: 'Navy', value: '#000080' },
  { name: 'Crimson', value: '#DC143C' },
  { name: 'Blue', value: '#4169E1' },
  { name: 'Purple', value: '#800080' },
  { name: 'Teal', value: '#008080' },
  { name: 'Gold', value: '#FFD700' },
  { name: 'Gray', value: '#808080' }
]

export default function NodeTypesModal({ isOpen, onClose, onNodeTypesUpdate }) {
  const [nodeTypes, setNodeTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingType, setEditingType] = useState(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    icon_shape: 'circle',
    icon_color: '#8B4513',
    icon_size: 24,
    icon_text: ''
  })

  // Load node types when modal opens
  useEffect(() => {
    if (isOpen) {
      loadNodeTypes()
    }
  }, [isOpen])

  const loadNodeTypes = async () => {
    try {
      setLoading(true)
      const types = await getAllNodeTypes()
      setNodeTypes(types)
    } catch (error) {
      console.error('Error loading node types:', error)
      alert('Failed to load node types')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      setLoading(true)
      
      if (editingType) {
        // Update existing type
        await updateNodeType(editingType.id, formData)
      } else {
        // Create new type
        await createNodeType(formData)
      }
      
      // Reload types
      await loadNodeTypes()
      
      // Notify parent
      if (onNodeTypesUpdate) {
        onNodeTypesUpdate()
      }
      
      // Reset form
      setEditingType(null)
      setFormData({
        code: '',
        name: '',
        icon_shape: 'circle',
        icon_color: '#8B4513',
        icon_size: 24,
        icon_text: ''
      })
      
      alert(editingType ? 'Node type updated!' : 'Node type created!')
    } catch (error) {
      console.error('Error saving node type:', error)
      alert(error.message || 'Failed to save node type')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (type) => {
    setEditingType(type)
    setFormData({
      code: type.code,
      name: type.name,
      icon_shape: type.icon_shape,
      icon_color: type.icon_color,
      icon_size: type.icon_size,
      icon_text: type.icon_text || ''
    })
  }

  const handleDelete = async (type) => {
    if (!confirm(`Delete node type "${type.name}"? This cannot be undone.`)) {
      return
    }
    
    try {
      setLoading(true)
      await deleteNodeType(type.id)
      await loadNodeTypes()
      
      if (onNodeTypesUpdate) {
        onNodeTypesUpdate()
      }
    } catch (error) {
      console.error('Error deleting node type:', error)
      alert(error.message || 'Failed to delete node type')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (type) => {
    try {
      await toggleNodeTypeActive(type.id, !type.is_active)
      await loadNodeTypes()
      
      if (onNodeTypesUpdate) {
        onNodeTypesUpdate()
      }
    } catch (error) {
      console.error('Error toggling node type:', error)
      alert(error.message || 'Failed to update node type')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{ zIndex: 10000 }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Manage Node Types</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add/Edit Form */}
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-4">
            {editingType ? 'Edit Node Type' : 'Add Custom Node Type'}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., MH"
                maxLength="4"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., Manhole"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shape
              </label>
              <select
                value={formData.icon_shape}
                onChange={(e) => handleInputChange('icon_shape', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {SHAPE_OPTIONS.map(shape => (
                  <option key={shape} value={shape}>
                    {shape.charAt(0).toUpperCase() + shape.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size
              </label>
              <input
                type="number"
                value={formData.icon_size}
                onChange={(e) => handleInputChange('icon_size', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="16"
                max="48"
                step="4"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <div className="flex items-center gap-2">
              <select
                value={formData.icon_color}
                onChange={(e) => handleInputChange('icon_color', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              >
                {COLOR_OPTIONS.map(color => (
                  <option key={color.value} value={color.value}>
                    {color.name}
                  </option>
                ))}
              </select>
              <input
                type="color"
                value={formData.icon_color}
                onChange={(e) => handleInputChange('icon_color', e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <div className="flex items-center justify-center w-10 h-10 border border-gray-300 rounded">
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: formData.icon_color }}
                />
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Icon Text (Optional)
            </label>
            <input
              type="text"
              value={formData.icon_text}
              onChange={(e) => handleInputChange('icon_text', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Text to display on icon"
              maxLength="3"
            />
          </div>
          
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : (editingType ? 'Update' : 'Create')}
            </button>
            {editingType && (
              <button
                type="button"
                onClick={() => {
                  setEditingType(null)
                  setFormData({
                    code: '',
                    name: '',
                    icon_shape: 'circle',
                    icon_color: '#8B4513',
                    icon_size: 24,
                    icon_text: ''
                  })
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Node Types List */}
        <div className="space-y-2">
          <h3 className="font-semibold mb-2">Existing Node Types</h3>
          {loading && !nodeTypes.length ? (
            <p className="text-gray-500">Loading...</p>
          ) : nodeTypes.length === 0 ? (
            <p className="text-gray-500">No node types found</p>
          ) : (
            <div className="grid gap-2">
              {nodeTypes.map(type => (
                <div
                  key={type.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    type.is_active ? 'bg-white' : 'bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Preview */}
                    <div className="w-10 h-10 flex items-center justify-center">
                      <svg width={type.icon_size} height={type.icon_size}>
                        {type.icon_shape === 'circle' ? 
                          <circle 
                            cx={type.icon_size/2} 
                            cy={type.icon_size/2} 
                            r={type.icon_size/2 - 2} 
                            fill={type.icon_color} 
                            stroke="black" 
                            strokeWidth="2"
                          /> : 
                          type.icon_shape === 'square' ? 
                          <rect 
                            x="2" 
                            y="2" 
                            width={type.icon_size - 4} 
                            height={type.icon_size - 4} 
                            fill={type.icon_color} 
                            stroke="black" 
                            strokeWidth="2"
                          /> : 
                          type.icon_shape === 'triangle' ? 
                          <polygon 
                            points={`${type.icon_size/2},2 ${type.icon_size-2},${type.icon_size-2} 2,${type.icon_size-2}`} 
                            fill={type.icon_color} 
                            stroke="black" 
                            strokeWidth="2"
                          /> : 
                          type.icon_shape === 'hexagon' ?
                          <polygon
                            points={`${type.icon_size/2},2 ${type.icon_size-2},${type.icon_size*0.25} ${type.icon_size-2},${type.icon_size*0.75} ${type.icon_size/2},${type.icon_size-2} 2,${type.icon_size*0.75} 2,${type.icon_size*0.25}`}
                            fill={type.icon_color}
                            stroke="black"
                            strokeWidth="2"
                          /> :
                          <polygon 
                            points={`${type.icon_size/2},2 ${type.icon_size-2},${type.icon_size/2} ${type.icon_size/2},${type.icon_size-2} 2,${type.icon_size/2}`} 
                            fill={type.icon_color} 
                            stroke="black" 
                            strokeWidth="2"
                          />
                        }
                        {type.icon_text && (
                          <text
                            x={type.icon_size/2}
                            y={type.icon_size/2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="white"
                            fontSize={type.icon_size * 0.4}
                            fontWeight="bold"
                          >
                            {type.icon_text}
                          </text>
                        )}
                      </svg>
                    </div>
                    
                    <div>
                      <div className="font-medium">
                        {type.name} ({type.code})
                      </div>
                      <div className="text-sm text-gray-500">
                        {type.is_system ? 'System' : 'Custom'} • 
                        {type.is_active ? ' Active' : ' Inactive'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {!type.is_system && (
                      <>
                        <button
                          onClick={() => handleToggleActive(type)}
                          className={`px-3 py-1 text-sm rounded ${
                            type.is_active 
                              ? 'bg-gray-200 hover:bg-gray-300' 
                              : 'bg-green-100 hover:bg-green-200 text-green-700'
                          }`}
                        >
                          {type.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEdit(type)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(type)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}