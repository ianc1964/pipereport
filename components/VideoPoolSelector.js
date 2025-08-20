'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Film, Clock, HardDrive, AlertCircle, Check, Play } from 'lucide-react'

export default function VideoPoolSelector({ 
  projectId, 
  onSelect,
  selectedVideoId = null 
}) {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedVideo, setSelectedVideo] = useState(null)

  // Load unassigned videos from pool
  useEffect(() => {
    loadPoolVideos()
  }, [projectId])

  const loadPoolVideos = async () => {
    if (!projectId) return

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('video_pool')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'ready')
        .is('assigned_to_section_id', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      setVideos(data || [])
      
      // If there's a pre-selected video, find and select it
      if (selectedVideoId && data) {
        const video = data.find(v => v.id === selectedVideoId)
        if (video) {
          setSelectedVideo(video)
        }
      }
    } catch (err) {
      console.error('Error loading pool videos:', err)
      setError('Failed to load videos from pool')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size'
    const mb = bytes / (1024 * 1024)
    return mb > 1000 
      ? `${(mb / 1024).toFixed(1)} GB`
      : `${mb.toFixed(1)} MB`
  }

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown duration'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getFormatBadgeColor = (format) => {
    const colors = {
      'mp4': 'bg-green-100 text-green-800',
      'avi': 'bg-yellow-100 text-yellow-800',
      'mov': 'bg-blue-100 text-blue-800',
      'wmv': 'bg-orange-100 text-orange-800',
      'mkv': 'bg-purple-100 text-purple-800',
      'webm': 'bg-teal-100 text-teal-800'
    }
    return colors[format?.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }

  const handleVideoSelect = (video) => {
    setSelectedVideo(video)
    if (onSelect) {
      onSelect(video)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading video pool...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
        <AlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-8">
        <Film className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No videos in pool</p>
        <p className="text-sm text-gray-500 mt-1">
          Upload videos using the Bulk Upload feature to add them to the pool
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-600">
          Select a video from the pool ({videos.length} available)
        </p>
        {selectedVideo && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
            1 video selected
          </span>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
        <div className="divide-y divide-gray-200">
          {videos.map((video) => {
            const isSelected = selectedVideo?.id === video.id
            const needsTranscoding = video.metadata?.needsTranscoding

            return (
              <div
                key={video.id}
                onClick={() => handleVideoSelect(video)}
                className={`
                  p-4 cursor-pointer transition-all
                  ${isSelected 
                    ? 'bg-blue-50 border-l-4 border-blue-500' 
                    : 'hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Selection indicator */}
                    <div className="mt-1">
                      <div className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center
                        ${isSelected 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300'
                        }
                      `}>
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>

                    {/* Video icon */}
                    <div className="flex-shrink-0">
                      <Film className="w-8 h-8 text-gray-400" />
                    </div>

                    {/* Video details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 truncate">
                            {video.original_filename || 'Unnamed video'}
                          </p>
                          
                          {/* Metadata row */}
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(video.duration)}
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatFileSize(video.file_size)}
                            </span>
                            {video.width && video.height && (
                              <span>{video.width}x{video.height}</span>
                            )}
                          </div>

                          {/* Format and status badges */}
                          <div className="flex items-center gap-2 mt-2">
                            {video.format && (
                              <span className={`
                                inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                ${getFormatBadgeColor(video.format)}
                              `}>
                                {video.format.toUpperCase()}
                              </span>
                            )}
                            
                            {needsTranscoding && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                <AlertCircle className="w-3 h-3" />
                                Needs transcoding
                              </span>
                            )}
                          </div>

                          {/* Upload date */}
                          <p className="text-xs text-gray-400 mt-2">
                            Uploaded {formatDate(video.created_at)}
                          </p>
                        </div>

                        {/* Preview button (if video URL exists) */}
                        {video.video_url && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(video.video_url, '_blank')
                            }}
                            className="ml-2 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Preview video"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedVideo && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Selected:</strong> {selectedVideo.original_filename}
            {selectedVideo.metadata?.needsTranscoding && (
              <span className="block text-xs text-blue-600 mt-1">
                This video will be transcoded for compatibility when the section is saved.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}