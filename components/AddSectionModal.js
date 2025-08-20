'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AddSectionModal({ isOpen, onClose, projectId, onSectionAdded }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [nextSectionNumber, setNextSectionNumber] = useState(1)
  const [autoNameEnabled, setAutoNameEnabled] = useState(true)

  // Get next section number when modal opens
  useEffect(() => {
    const getNextSectionNumber = async () => {
      if (!projectId || !isOpen) return

      try {
        // Call the database function to get next section number
        const { data, error } = await supabase.rpc('get_next_section_number', {
          project_uuid: projectId
        })

        if (error) {
          console.error('Error getting next section number:', error)
          setNextSectionNumber(1) // Fallback
        } else {
          setNextSectionNumber(data)
          
          // Auto-generate name if enabled
          if (autoNameEnabled) {
            setName(`Section ${data}`)
          }
        }
      } catch (error) {
        console.error('Error getting next section number:', error)
        setNextSectionNumber(1) // Fallback
      }
    }

    if (isOpen) {
      getNextSectionNumber()
    }
  }, [projectId, isOpen, autoNameEnabled])

  // Update auto-generated name when section number changes
  useEffect(() => {
    if (autoNameEnabled && nextSectionNumber) {
      setName(`Section ${nextSectionNumber}`)
    }
  }, [nextSectionNumber, autoNameEnabled])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!name.trim()) {
      alert('Section name is required')
      return
    }

    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('sections')
        .insert([
          {
            project_id: projectId,
            name: name.trim(),
            section_number: nextSectionNumber,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single()

      if (error) throw error

      onSectionAdded(data)
      setName('')
      setAutoNameEnabled(true)
      onClose()
    } catch (error) {
      console.error('Error creating section:', error)
      alert('Failed to create section. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleNameChange = (e) => {
    const newName = e.target.value
    setName(newName)
    
    // Disable auto-naming if user types something different
    if (newName !== `Section ${nextSectionNumber}`) {
      setAutoNameEnabled(false)
    }
  }

  const handleAutoNameToggle = () => {
    setAutoNameEnabled(!autoNameEnabled)
    if (!autoNameEnabled && nextSectionNumber) {
      setName(`Section ${nextSectionNumber}`)
    }
  }

  const handleClose = () => {
    setName('')
    setAutoNameEnabled(true)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Add New Section</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="section-name" className="block text-sm font-medium text-gray-700">
                Section Name
              </label>
              <div className="flex items-center text-xs">
                <input
                  type="checkbox"
                  id="auto-name"
                  checked={autoNameEnabled}
                  onChange={handleAutoNameToggle}
                  className="mr-1"
                />
                <label htmlFor="auto-name" className="text-gray-500">
                  Auto-name
                </label>
              </div>
            </div>
            
            <input
              id="section-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Section ${nextSectionNumber}`}
              disabled={loading}
            />
            
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>This will be Section #{nextSectionNumber}</span>
              {!autoNameEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setAutoNameEnabled(true)
                    setName(`Section ${nextSectionNumber}`)
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Use auto-name
                </button>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <div className="flex items-start">
              <div className="text-sm text-blue-800">
                <strong>Section Numbering:</strong>
                <ul className="mt-1 text-xs space-y-1">
                  <li>• Sections are automatically numbered in sequence</li>
                  <li>• Numbers are preserved when sections are deleted</li>
                  <li>• Sections are displayed in numerical order</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Creating...' : 'Create Section'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}