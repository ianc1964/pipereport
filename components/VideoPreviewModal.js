// components/VideoPreviewModal.js
'use client'

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

export default function VideoPreviewModal({ video, isOpen, onClose }) {
  const [error, setError] = useState(false)
  
  if (!isOpen || !video) return null
  
  // Ensure we're using the correct video URL
  const videoUrl = video.video_url || video.url
  const videoTitle = video.original_filename || video.filename || 'Video Preview'
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {videoTitle}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Video Player */}
        <div className="p-4 bg-gray-50">
          {error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-gray-700 font-medium">Failed to load video</p>
              <p className="text-sm text-gray-500 mt-2">
                URL: {videoUrl}
              </p>
              <button
                onClick={() => setError(false)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : (
            <video
              controls
              autoPlay
              className="w-full rounded"
              onError={() => setError(true)}
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
        
        {/* Video Info */}
        <div className="p-4 border-t bg-gray-50 text-sm text-gray-600">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">Format:</span> {video.format || 'mp4'}
            </div>
            <div>
              <span className="font-medium">Resolution:</span> {video.width}x{video.height}
            </div>
            <div>
              <span className="font-medium">Duration:</span> {formatDuration(video.duration)}
            </div>
            <div>
              <span className="font-medium">Size:</span> {formatFileSize(video.file_size)}
            </div>
          </div>
          {video.metadata?.transcoded && (
            <div className="mt-2 text-green-600">
              ✅ Optimized for web playback ({video.metadata?.resolution || '480p'})
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper functions
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return 'N/A'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatFileSize(bytes) {
  if (!bytes) return 'N/A'
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}