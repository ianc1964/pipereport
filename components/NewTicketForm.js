'use client'

import { useState } from 'react'
import { createSupportTicket } from '@/lib/actions/create-support-ticket'
import { useAuth } from '@/lib/auth-context'
import { X, AlertCircle, CheckCircle, MessageCircle, Loader2 } from 'lucide-react'

export default function NewTicketForm({ isOpen, onClose, onTicketCreated }) {
  const { user, loading: authLoading } = useAuth()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'normal'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const categories = [
    { value: 'technical', label: 'Technical Issue', description: 'Problems with uploads, processing, or system functionality' },
    { value: 'billing', label: 'Billing & Credits', description: 'Questions about subscriptions, credits, or payments' },
    { value: 'feature_request', label: 'Feature Request', description: 'Suggestions for new features or improvements' },
    { value: 'bug_report', label: 'Bug Report', description: 'Report errors or unexpected behavior' },
    { value: 'general', label: 'General Support', description: 'Questions about how to use the platform' }
  ]

  const priorities = [
    { value: 'low', label: 'Low', description: 'General questions, nice-to-have features', color: 'text-gray-600' },
    { value: 'normal', label: 'Normal', description: 'Standard support requests', color: 'text-blue-600' },
    { value: 'high', label: 'High', description: 'Issues affecting productivity', color: 'text-orange-600' },
    { value: 'urgent', label: 'Urgent', description: 'Critical issues blocking work completely', color: 'text-red-600' }
  ]

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
    if (success) setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Check if auth is still loading
    if (authLoading) {
      setError('Please wait for authentication to complete')
      return
    }
    
    // Check if user is available
    if (!user?.id) {
      setError('User not authenticated. Please refresh the page and try again.')
      return
    }
    
    // Client-side validation
    if (!formData.title.trim()) {
      setError('Please enter a title for your ticket')
      return
    }

    if (formData.title.trim().length < 5) {
      setError('Title must be at least 5 characters long')
      return
    }

    if (formData.description.trim().length > 2000) {
      setError('Description must be less than 2000 characters')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await createSupportTicket({
        ticketData: formData,
        userId: user.id
      })
      
      if (result.success) {
        setSuccess('Support ticket created successfully!')
        
        // Call the callback to refresh the tickets list
        if (onTicketCreated) {
          onTicketCreated(result.data)
        }
        
        // Reset form
        setFormData({
          title: '',
          description: '',
          category: 'general',
          priority: 'normal'
        })
        
        // Close modal after a short delay to show success message
        setTimeout(() => {
          onClose()
          setSuccess('')
        }, 1500)
        
      } else {
        setError(result.error || 'Failed to create support ticket')
      }
    } catch (error) {
      console.error('Error creating ticket:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Show loading if auth is still loading
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading authentication...</span>
          </div>
        </div>
      </div>
    )
  }

  // Show debug info if user is not available
  if (!user?.id) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
          <h3 className="text-lg font-semibold mb-4 text-red-600">Authentication Debug</h3>
          <div className="space-y-2 text-sm">
            <p><strong>User:</strong> {JSON.stringify(user)}</p>
            <p><strong>Auth Loading:</strong> {authLoading.toString()}</p>
            <p><strong>User ID:</strong> {user?.id || 'undefined'}</p>
          </div>
          <button 
            onClick={onClose} 
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  // Show loading if auth is still loading
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Create Support Ticket</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading || authLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Success/Error Messages */}
          {success && (
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              <CheckCircle className="w-5 h-5" />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Brief description of your issue or request"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={loading || authLoading}
              maxLength={200}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.title.length}/200 characters
            </p>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={loading || authLoading}
              required
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {categories.find(c => c.value === formData.category)?.description}
            </p>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
              Priority *
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => handleInputChange('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={loading || authLoading}
              required
            >
              {priorities.map(priority => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
            <p className={`text-xs mt-1 ${priorities.find(p => p.value === formData.priority)?.color || 'text-gray-500'}`}>
              {priorities.find(p => p.value === formData.priority)?.description}
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Provide detailed information about your issue or request. Include steps to reproduce the problem, what you expected to happen, and any error messages you received."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={loading || authLoading}
              maxLength={2000}
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.description.length}/2000 characters • Optional but recommended for faster resolution
            </p>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Tips for faster resolution:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Be specific about what you were trying to do</li>
              <li>• Include any error messages exactly as they appeared</li>
              <li>• Mention your browser and operating system if relevant</li>
              <li>• For technical issues, describe steps to reproduce the problem</li>
            </ul>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || authLoading}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || authLoading || !formData.title.trim() || !user?.id}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}