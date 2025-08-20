'use client'

import { useState } from 'react'
import { Archive, AlertTriangle } from 'lucide-react'

export default function ArchiveProjectModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  projectName,
  isArchiving = false 
}) {
  const [reason, setReason] = useState('')
  const [selectedReason, setSelectedReason] = useState('')
  
  const commonReasons = [
    { value: 'completed', label: 'Project completed successfully' },
    { value: 'cancelled', label: 'Project cancelled' },
    { value: 'on_hold', label: 'Project on hold' },
    { value: 'delivered', label: 'Deliverables sent to client' },
    { value: 'other', label: 'Other reason' }
  ]

  const handleConfirm = () => {
    const finalReason = selectedReason === 'other' ? reason : selectedReason
    onConfirm(finalReason || 'No reason provided')
  }

  const handleClose = () => {
    setReason('')
    setSelectedReason('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 transform transition-all">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <Archive className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Archive Project</h3>
        </div>
        
        <p className="text-gray-600 mb-4">
          Are you sure you want to archive "<strong>{projectName}</strong>"?
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> Archived projects will be hidden from your main project list but can be restored at any time. All data will be preserved.
          </p>
        </div>

        {/* Reason Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Archive Reason (Optional)
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Select a reason...</option>
            {commonReasons.map(reason => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Reason Text Area */}
        {selectedReason === 'other' && (
          <div className="mb-4">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please specify the reason..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={3}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={isArchiving}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isArchiving ? 'Archiving...' : 'Archive Project'}
          </button>
          <button
            onClick={handleClose}
            disabled={isArchiving}
            className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}