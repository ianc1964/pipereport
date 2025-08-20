'use client'

import { useState } from 'react'
import { X, Upload, Database, Film } from 'lucide-react'
import VideoUpload from './VideoUpload'
import VideoPoolSelector from './VideoPoolSelector'
import { supabase } from '@/lib/supabase'

export default function VideoSourceModal({ 
  isOpen, 
  onClose, 
  sectionId,
  sectionName,
  projectId,
  onVideoAdded 
}) {
  const [videoSource, setVideoSource] = useState(null) // null, 'upload', 'pool'
  const [selectedPoolVideo, setSelectedPoolVideo] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  // Handle video upload completion
  const handleUploadComplete = async (uploadData) => {
    try {
      // Update section with video data
      const { error: updateError } = await supabase
        .from('sections')
        .update({
          video_url: uploadData.videoUrl,
          video_filename: uploadData.filename,
          video_duration: uploadData.duration,
          video_metadata: uploadData.metadata
        })
        .eq('id', sectionId)

      if (updateError) throw updateError

      // Notify parent and close
      if (onVideoAdded) {
        onVideoAdded({
          sectionId,
          videoUrl: uploadData.videoUrl,
          filename: uploadData.filename
        })
      }
      onClose()
    } catch (err) {
      console.error('Error updating section with video:', err)
      setError('Failed to update section with video')
    }
  }

  // Handle pool video selection and assignment
  const handleAssignPoolVideo = async () => {
    if (!selectedPoolVideo) return

    setSaving(true)
    setError('')

    try {
      // Update section with pool video data
      const { error: sectionError } = await supabase
        .from('sections')
        .update({
          video_url: selectedPoolVideo.video_url,
          video_filename: selectedPoolVideo.original_filename,
          video_duration: selectedPoolVideo.duration,
          video_metadata: selectedPoolVideo.metadata
        })
        .eq('id', sectionId)

      if (sectionError) throw sectionError

      // Mark pool video as assigned
      const { error: poolError } = await supabase
        .from('video_pool')
        .update({
          assigned_to_section_id: sectionId,
          assigned_at: new Date().toISOString()
        })
        .eq('id', selectedPoolVideo.id)

      if (poolError) {
        console.error('Error updating pool assignment:', poolError)
        // Don't throw - section was updated successfully
      }

      // Notify parent and close
      if (onVideoAdded) {
        onVideoAdded({
          sectionId,
          videoUrl: selectedPoolVideo.video_url,
          filename: selectedPoolVideo.original_filename
        })
      }
      onClose()
    } catch (err) {
      console.error('Error assigning pool video:', err)
      setError('Failed to assign video to section')
    } finally {
      setSaving(false)
    }
  }

  // Reset state when closing
  const handleClose = () => {
    setVideoSource(null)
    setSelectedPoolVideo(null)
    setError('')
    onClose()
  }

  // Show video upload modal
  if (videoSource === 'upload') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <VideoUpload
          sectionId={sectionId}
          onUploadComplete={handleUploadComplete}
          onCancel={() => setVideoSource(null)}
        />
      </div>
    )
  }

  // Main selection modal
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Film className="w-5 h-5" />
              Add Video to Section
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {sectionName || `Section ${sectionId}`}
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {!videoSource ? (
            // Source selection
            <div className="space-y-4">
              <p className="text-gray-600 text-center mb-6">
                Choose how you want to add a video to this section:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upload new option */}
                <button
                  onClick={() => setVideoSource('upload')}
                  className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <Upload className="w-12 h-12 text-gray-400 group-hover:text-blue-600 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900 mb-2">Upload New Video</h3>
                  <p className="text-sm text-gray-500">
                    Select a video file from your computer to upload
                  </p>
                </button>

                {/* Select from pool option */}
                <button
                  onClick={() => setVideoSource('pool')}
                  className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <Database className="w-12 h-12 text-gray-400 group-hover:text-blue-600 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900 mb-2">Select from Pool</h3>
                  <p className="text-sm text-gray-500">
                    Choose from videos already uploaded to this project
                  </p>
                </button>
              </div>
            </div>
          ) : videoSource === 'pool' ? (
            // Pool selection
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Select a Video from Pool</h3>
                <button
                  onClick={() => {
                    setVideoSource(null)
                    setSelectedPoolVideo(null)
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
              </div>

              <VideoPoolSelector
                projectId={projectId}
                onSelect={setSelectedPoolVideo}
                selectedVideoId={selectedPoolVideo?.id}
              />

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignPoolVideo}
                  disabled={!selectedPoolVideo || saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4" />
                      Assign Video to Section
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}