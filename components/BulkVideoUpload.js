// components/BulkVideoUpload.js
'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Film, AlertCircle, CheckCircle, X, Trash2, Play, Clock, Coins } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import VideoPreviewModal from './VideoPreviewModal'

// Conditionally import PoolTranscodeManager if it exists
let PoolTranscodeManager = null
try {
  PoolTranscodeManager = require('./PoolTranscodeManager').default
} catch (err) {
  console.log('PoolTranscodeManager not found - transcoding features will be limited')
}

// Import upload functions
async function getUploadUrl(params) {
  try {
    const { getPoolUploadUrl } = await import('@/lib/actions/video-pool-upload')
    return await getPoolUploadUrl(params)
  } catch (err) {
    console.error('Pool upload not available:', err)
    return { 
      success: false, 
      error: 'Upload not configured. Please check /lib/actions/video-pool-upload.js' 
    }
  }
}

// Import credit functions
let checkCredits = async () => true
let consumeCredits = async () => {}
let calculateCreditsRequired = async () => ({ credits: 10 })

// Try to load credit functions
import('@/lib/credits').then(module => {
  checkCredits = module.checkCredits || checkCredits
  consumeCredits = module.consumeCredits || consumeCredits
  calculateCreditsRequired = module.calculateCreditsRequired || calculateCreditsRequired
}).catch(err => {
  console.log('Credit module not loaded:', err)
})

// Import video processing functions
let detectVideoFormat = null
let generateVideoThumbnail = null

// Try to load video processing functions
import('@/lib/video/format-detector').then(module => {
  detectVideoFormat = module.detectVideoFormat
}).catch(err => {
  console.log('Format detector not loaded, using fallback:', err)
})

import('@/lib/video/video-metadata').then(module => {
  generateVideoThumbnail = module.generateVideoThumbnail
}).catch(err => {
  console.log('Video metadata not loaded, using fallback:', err)
})

// Fallback functions if imports fail
const fallbackDetectFormat = async (file) => {
  const extension = file.name.split('.').pop().toLowerCase()
  
  // For MP4 files, test if browser can actually play them
  let canPlay = false
  if (extension === 'mp4' || extension === 'm4v') {
    try {
      const video = document.createElement('video')
      const url = URL.createObjectURL(file)
      
      // Test if browser can play this video
      canPlay = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(url)
          resolve(false)
        }, 3000)
        
        video.onloadedmetadata = () => {
          clearTimeout(timeout)
          URL.revokeObjectURL(url)
          resolve(true)
        }
        
        video.onerror = () => {
          clearTimeout(timeout)
          URL.revokeObjectURL(url)
          resolve(false)
        }
        
        video.src = url
        video.load()
      })
    } catch (err) {
      console.log('Could not test video playback:', err)
      canPlay = extension === 'mp4' // Assume MP4s can play
    }
  }
  
  return {
    formatKey: extension,
    compatibility: { canPlayInBrowser: canPlay },
    format: extension,
    codec: 'unknown'
  }
}

const fallbackExtractMetadata = async (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration || 0,
        width: video.videoWidth || 1920,
        height: video.videoHeight || 1080
      })
      URL.revokeObjectURL(video.src)
    }
    
    video.onerror = () => {
      resolve({
        duration: 0,
        width: 1920,
        height: 1080
      })
      URL.revokeObjectURL(video.src)
    }
    
    video.src = URL.createObjectURL(file)
  })
}

const BulkVideoUpload = ({ projectId, onClose }) => {
  const { user, company, refreshProfile } = useAuth()
  const [dragActive, setDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadStatus, setUploadStatus] = useState({})
  const [uploadProgress, setUploadProgress] = useState({})
  const [totalCreditsNeeded, setTotalCreditsNeeded] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [poolVideos, setPoolVideos] = useState([])
  const [showPool, setShowPool] = useState(false)
  const [processingFiles, setProcessingFiles] = useState(false)
  const [creditsPerVideo, setCreditsPerVideo] = useState(10)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  // Video preview modal state
  const [previewVideo, setPreviewVideo] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  
  const fileInputRef = useRef(null)

  // Constants
  const MAX_FILES_PER_BATCH = 5  // Enforce 5-file limit for optimal transcoding
  const MAX_POOL_CAPACITY = 50   // Maximum videos in pool per project

  // Load pool videos
  const loadPoolVideos = async () => {
    try {
      // Get ALL unassigned videos, including those with errors
      const { data, error } = await supabase
        .from('video_pool')
        .select('*')
        .eq('project_id', projectId)
        .is('assigned_to_section_id', null)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setPoolVideos(data)
        
        // Check if we're at the limit
        if (data.length >= MAX_POOL_CAPACITY) {
          console.warn(`Pool limit reached: ${data.length} unassigned videos in pool`)
        }
      } else if (error) {
        console.error('Error loading pool videos:', error)
      }
    } catch (error) {
      console.error('Error loading pool videos:', error)
    }
  }

  // Load credit pricing on mount
  useEffect(() => {
    loadPoolVideos()
    
    // Load dynamic pricing for video uploads
    calculateCreditsRequired('video_upload', { fileSize: 100 * 1024 * 1024 }) // 100MB test
      .then(result => {
        if (result?.credits) {
          setCreditsPerVideo(result.credits)
        }
      })
      .catch(err => {
        console.log('Using default credit pricing:', err)
      })
  }, [refreshTrigger])

  // Function to determine if a video needs transcoding (smart detection)
  const determineTranscodingNeed = (formatInfo, metadata) => {
    console.log('🔍 Determining transcoding need:')
    console.log('  Format info:', formatInfo)
    console.log('  Metadata:', metadata)
    
    // Check if it's a compatible MP4 with H.264 codec
    const format = formatInfo?.formatKey?.toLowerCase()
    const codec = formatInfo?.codec?.toLowerCase()
    
    console.log('  Format:', format)
    console.log('  Codec:', codec)
    console.log('  Browser compatible:', formatInfo?.compatibility?.canPlayInBrowser)
    
    // For MP4 files, if browser says it can play, trust that
    // Don't worry about codec detection as it's often unreliable in browser
    if ((format === 'mp4' || format === 'm4v') && formatInfo?.compatibility?.canPlayInBrowser === true) {
      const height = metadata?.height || 'unknown'
      console.log(`✅ No transcoding needed: Browser can play this MP4 at ${height}p`)
      return false
    }
    
    // Check if it's explicitly incompatible
    const isIncompatibleFormat = ['avi', 'wmv', 'flv', 'mkv', 'mts', '3gp'].includes(format)
    if (isIncompatibleFormat) {
      console.log(`🔄 Transcoding needed: Incompatible format (${format})`)
      return true
    }
    
    // If browser can't play it, needs transcoding
    if (formatInfo?.compatibility?.canPlayInBrowser === false) {
      console.log(`🔄 Transcoding needed: Browser cannot play this format`)
      return true
    }
    
    // Default: if we're not sure, mark it as not needing transcoding for MP4s
    // The server will double-check anyway
    if (format === 'mp4' || format === 'm4v') {
      console.log(`⚠️ Uncertain about MP4, assuming web-ready (server will verify)`)
      return false
    }
    
    // All other formats need transcoding
    console.log(`🔄 Transcoding needed: Unknown or incompatible format (${format})`)
    return true
  }

  // Process video file to extract metadata and format info
  const processVideoFile = async (file) => {
    try {
      // Try to use actual format detection
      let formatInfo = null
      if (detectVideoFormat) {
        formatInfo = await detectVideoFormat(file)
        
        // Validate the format info
        if (!formatInfo?.compatibility || formatInfo.compatibility.canPlayInBrowser === undefined) {
          console.log('Format detector returned incomplete data, using fallback')
          formatInfo = await fallbackDetectFormat(file)
        }
      } else {
        formatInfo = await fallbackDetectFormat(file)
      }

      // Try to extract metadata using thumbnail generator or fallback
      let metadata = null
      if (generateVideoThumbnail) {
        try {
          const result = await generateVideoThumbnail(file, 0)
          // Check if result exists and has the expected properties
          if (result && typeof result === 'object') {
            metadata = {
              duration: result.duration || 0,
              width: result.width || 1920,
              height: result.height || 1080
            }
          } else {
            console.log('Thumbnail generator returned invalid result, using fallback')
            metadata = await fallbackExtractMetadata(file)
          }
        } catch (err) {
          console.log('Thumbnail generation failed, using fallback:', err)
          metadata = await fallbackExtractMetadata(file)
        }
      } else {
        metadata = await fallbackExtractMetadata(file)
      }

      // Calculate credits based on file size (if dynamic pricing is available)
      const credits = await calculateCreditsRequired('video_upload', { 
        fileSize: file.size,
        duration: metadata.duration 
      }).then(res => res?.credits || creditsPerVideo)
        .catch(() => creditsPerVideo)

      return {
        formatInfo,
        metadata,
        credits
      }
    } catch (error) {
      console.error('Error processing video file:', error)
      return {
        formatInfo: await fallbackDetectFormat(file),
        metadata: await fallbackExtractMetadata(file),
        credits: creditsPerVideo
      }
    }
  }

  // Handle file selection with metadata extraction and 5-file limit
  const handleFileSelection = async (files) => {
    setProcessingFiles(true)
    const newFiles = []
    let totalCredits = 0
    let skippedCount = 0
    let limitMessage = ''

    // Check if adding these files would exceed the 5-file batch limit
    const remainingSlots = MAX_FILES_PER_BATCH - selectedFiles.length
    const filesToProcess = files.slice(0, remainingSlots)
    
    if (files.length > remainingSlots) {
      skippedCount = files.length - remainingSlots
      if (selectedFiles.length === 0) {
        limitMessage = `Only the first ${MAX_FILES_PER_BATCH} files were selected. Upload these first, then select more files for the next batch.`
      } else {
        limitMessage = `Only ${remainingSlots} more file${remainingSlots !== 1 ? 's' : ''} can be added to this batch. Upload current files first, then select more for the next batch.`
      }
    }

    for (const file of filesToProcess) {
      // Skip if already selected
      if (selectedFiles.some(f => f.file.name === file.name && f.file.size === file.size)) {
        continue
      }

      // Basic validation
      const maxSize = 2 * 1024 * 1024 * 1024 // 2GB
      if (file.size > maxSize) {
        setUploadStatus(prev => ({
          ...prev,
          [file.name]: { status: 'error', message: 'File exceeds 2GB limit' }
        }))
        continue
      }

      // Process the video file
      const { formatInfo, metadata, credits } = await processVideoFile(file)
      totalCredits += credits

      const fileData = {
        file,
        id: `${file.name}-${file.size}-${Date.now()}`,
        formatInfo,
        metadata,
        creditsNeeded: credits,
        size: file.size,
        name: file.name
      }
      
      newFiles.push(fileData)
    }

    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles])
      setTotalCreditsNeeded(prev => prev + totalCredits)
    }
    
    setProcessingFiles(false)

    // Show limit message if files were skipped
    if (limitMessage) {
      alert(`Batch Limit: ${limitMessage}`)
    }
  }

  // Remove file from selection
  const removeFile = (fileId) => {
    setSelectedFiles(prev => {
      const file = prev.find(f => f.id === fileId)
      if (file) {
        setTotalCreditsNeeded(current => current - file.creditsNeeded)
      }
      return prev.filter(f => f.id !== fileId)
    })
    
    // Clear any status for this file
    const fileName = selectedFiles.find(f => f.id === fileId)?.name
    if (fileName) {
      setUploadStatus(prev => {
        const newStatus = { ...prev }
        delete newStatus[fileName]
        return newStatus
      })
      setUploadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[fileName]
        return newProgress
      })
    }
  }

  // Upload single file to pool
  const uploadFileToPool = async (fileData) => {
    const { file, id, formatInfo, metadata } = fileData

    try {
      setUploadStatus(prev => ({
        ...prev,
        [file.name]: { status: 'uploading', message: 'Getting upload URL...' }
      }))

      // Get upload URL for pool
      const { success, uploadData, error } = await getUploadUrl({
        fileName: file.name,
        contentType: file.type || 'video/mp4',
        contentLength: file.size,
        projectId: projectId,
        userId: user.id
      })

      if (!success) {
        throw new Error(error || 'Failed to get upload URL')
      }

      setUploadStatus(prev => ({
        ...prev,
        [file.name]: { status: 'uploading', message: 'Uploading to storage...' }
      }))

      // Upload file using XMLHttpRequest for progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: percentComplete
            }))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'))
        })

        xhr.open(uploadData.method, uploadData.url)
        
        // Set headers
        Object.entries(uploadData.headers).forEach(([key, value]) => {
          if (key !== 'Content-Length') { // Browser sets this automatically
            xhr.setRequestHeader(key, value)
          }
        })

        xhr.send(file)
      })

      setUploadStatus(prev => ({
        ...prev,
        [file.name]: { status: 'processing', message: 'Saving to video pool...' }
      }))

      // Use smart detection to determine if transcoding is needed
      const needsTranscoding = determineTranscodingNeed(formatInfo, metadata)

      // Save to video_pool table
      const { data: poolEntry, error: poolError } = await supabase
        .from('video_pool')
        .insert({
          project_id: projectId,
          user_id: user.id,
          filename: uploadData.key,
          original_filename: file.name,
          video_url: uploadData.publicUrl,
          file_size: file.size,
          duration: metadata?.duration || 0,
          width: metadata?.width || 0,
          height: metadata?.height || 0,
          format: formatInfo?.formatKey || 'unknown',
          codec: formatInfo?.codec || 'unknown',
          status: 'ready',
          upload_progress: 100,
          metadata: {
            ...metadata,
            formatAnalysis: formatInfo,
            needsTranscoding,
            uploadedAt: new Date().toISOString()
          }
        })
        .select()
        .single()

      if (poolError) {
        console.error('Pool save error:', poolError)
        // Check if it's a pool limit error
        if (poolError.message?.includes('pool limit') || poolError.message?.includes('Maximum')) {
          throw new Error(`Video pool limit reached. Maximum ${MAX_POOL_CAPACITY} unassigned videos per project. Please assign or delete existing videos.`)
        }
        throw poolError
      }

      // Consume credits
      if (company?.id && user?.id) {
        try {
          await consumeCredits(
            company.id,
            user.id,
            fileData.creditsNeeded,
            'video_upload',
            `Bulk upload: ${file.name}`
          )
        } catch (creditError) {
          console.error('Credit consumption failed:', creditError)
          // Don't fail the upload if credit consumption fails
        }
      }

      setUploadStatus(prev => ({
        ...prev,
        [file.name]: { 
          status: 'complete', 
          message: needsTranscoding ? 'Upload complete - transcoding needed for compatibility' : 'Upload successful - video is web-ready!' 
        }
      }))

      return { success: true, poolEntry, needsTranscoding }

    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error)
      setUploadStatus(prev => ({
        ...prev,
        [file.name]: { status: 'error', message: error.message }
      }))
      return { success: false, error: error.message }
    }
  }

  // Start bulk upload
  const startBulkUpload = async () => {
    // Check pool capacity first
    if (poolVideos.length + selectedFiles.length > MAX_POOL_CAPACITY) {
      const available = Math.max(0, MAX_POOL_CAPACITY - poolVideos.length)
      alert(`Video pool limit exceeded. You can only upload ${available} more video${available !== 1 ? 's' : ''}. Currently ${poolVideos.length}/${MAX_POOL_CAPACITY} videos in pool.\n\nPlease assign or delete existing videos first.`)
      return
    }

    // Check credits
    if (company?.id) {
      try {
        const hasCredits = await checkCredits(company.id, totalCreditsNeeded)
        if (!hasCredits) {
          alert(`Insufficient credits. You need ${totalCreditsNeeded} credits for this upload.`)
          return
        }
      } catch (err) {
        alert('Failed to verify credit balance.')
        return
      }
    }

    setIsUploading(true)
    let successCount = 0
    let failedCount = 0
    let needsTranscodingCount = 0
    const errors = []

    // Upload files sequentially to avoid overwhelming the server
    for (const fileData of selectedFiles) {
      const result = await uploadFileToPool(fileData)
      if (result.success) {
        successCount++
        if (result.needsTranscoding) {
          needsTranscodingCount++
        }
      } else {
        failedCount++
        errors.push(`${fileData.name}: ${result.error}`)
      }
    }

    // Refresh profile to update credit balance
    if (successCount > 0) {
      await refreshProfile()
      await loadPoolVideos()
      setRefreshTrigger(prev => prev + 1) // Trigger transcoding manager refresh
    }

    setIsUploading(false)

    // Show appropriate message based on results
    if (successCount === 0) {
      // All uploads failed
      alert(`Upload failed. No videos were uploaded.\n\nErrors:\n${errors.join('\n')}`)
    } else if (failedCount > 0) {
      // Some uploads failed
      let message = `Upload partially complete. ${successCount} of ${selectedFiles.length} videos uploaded successfully.`
      if (needsTranscodingCount > 0) {
        message += `\n\n${needsTranscodingCount} video${needsTranscodingCount > 1 ? 's need' : ' needs'} transcoding.`
      }
      message += `\n\nFailed uploads:\n${errors.join('\n')}`
      if (successCount > 0) {
        message += `\n\nYou can now select up to ${MAX_FILES_PER_BATCH} more files for the next batch.`
      }
      alert(message)
    } else if (needsTranscodingCount > 0) {
      // All succeeded, some need transcoding
      alert(`Upload complete! ${successCount} video${successCount > 1 ? 's' : ''} uploaded successfully.\n\n${needsTranscodingCount} video${needsTranscodingCount > 1 ? 's need' : ' needs'} transcoding for web compatibility. You can start the conversion process from the Video Pool tab.\n\nYou can now select up to ${MAX_FILES_PER_BATCH} more files for the next batch.`)
    } else {
      // All succeeded, all web-ready
      alert(`Upload complete! ${successCount} video${successCount > 1 ? 's' : ''} uploaded successfully. All videos are web-ready!\n\nYou can now select up to ${MAX_FILES_PER_BATCH} more files for the next batch.`)
    }
    
    // Clear successful uploads
    setSelectedFiles(prev => 
      prev.filter(f => uploadStatus[f.file.name]?.status !== 'complete')
    )
    
    // Switch to pool tab if there are videos (successful or needs transcoding)
    if (successCount > 0) {
      setShowPool(true)
    }
  }

  // Handle transcoding completion
  const handleTranscodeComplete = async (result) => {
    // Reload pool videos to show updated status
    await loadPoolVideos()
    setRefreshTrigger(prev => prev + 1)
    
    // Clear the upload area for next batch
    setSelectedFiles([])
    setUploadStatus({})
    setUploadProgress({})
    setTotalCreditsNeeded(0)
    
    // Stay on Video Pool tab to show completed transcoding
    // Don't switch back to upload tab automatically
    
    // Show success message
    alert('Transcoding complete! Upload area cleared for your next batch of up to 5 videos.')
  }

  // Delete video from pool
  const deletePoolVideo = async (videoId, videoUrl) => {
    if (!confirm('Are you sure you want to delete this video from the pool?')) {
      return
    }

    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('video_pool')
        .delete()
        .eq('id', videoId)

      if (dbError) {
        throw dbError
      }

      // Try to delete from S3 (optional - may fail if permissions not set)
      if (videoUrl) {
        try {
          // Parse S3 URL to get bucket and key
          const url = new URL(videoUrl)
          const pathParts = url.pathname.split('/')
          const bucket = url.hostname.split('.')[0]
          const key = pathParts.slice(1).join('/')
          
          // Call a server action to delete from S3 if available
          // This would need to be implemented server-side
          console.log('Video deleted from database. S3 deletion would require server-side implementation.')
        } catch (s3Error) {
          console.error('Could not delete from S3:', s3Error)
          // Continue anyway - database deletion is what matters
        }
      }

      // Refresh the pool
      await loadPoolVideos()
      alert('Video deleted successfully')
    } catch (error) {
      console.error('Error deleting video:', error)
      alert('Failed to delete video: ' + error.message)
    }
  }

  // Handle video preview
  const handlePreviewVideo = (video) => {
    setPreviewVideo(video)
    setShowPreview(true)
  }

  // Check if video needs transcoding (for display purposes in pool)
  const videoNeedsTranscoding = (video) => {
    // Already transcoded
    if (video.metadata?.transcoded) return false
    
    // If explicitly marked as not needing transcoding by server
    if (video.metadata?.needsTranscoding === false) return false
    
    // Check format
    const format = video.format?.toLowerCase()
    
    // MP4 and M4V files are assumed to be web-ready unless explicitly marked otherwise
    if ((format === 'mp4' || format === 'm4v') && video.metadata?.needsTranscoding !== true) {
      return false
    }
    
    // All other formats need transcoding
    return video.metadata?.needsTranscoding !== false
  }

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(Array.from(e.dataTransfer.files))
    }
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get format badge color
  const getFormatBadgeColor = (format) => {
    const lowerFormat = format?.toLowerCase()
    if (lowerFormat === 'mp4' || lowerFormat === 'm4v') return 'bg-green-100 text-green-700'
    if (lowerFormat === 'webm') return 'bg-blue-100 text-blue-700'
    if (['avi', 'wmv', 'flv', 'mkv', 'mts'].includes(lowerFormat)) return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bulk Video Upload</h2>
            <p className="text-sm text-gray-600 mt-1">
              Upload up to {MAX_FILES_PER_BATCH} videos per batch for optimal transcoding performance. Web-compatible MP4 H.264 videos won't need transcoding.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowPool(false)}
            className={`px-4 py-2 rounded-md ${!showPool ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Upload New ({selectedFiles.length}/{MAX_FILES_PER_BATCH})
          </button>
          <button
            onClick={() => setShowPool(true)}
            className={`px-4 py-2 rounded-md ${showPool ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Video Pool ({poolVideos.length}/{MAX_POOL_CAPACITY})
            {poolVideos.length >= MAX_POOL_CAPACITY && (
              <span className="ml-2 text-xs bg-orange-500 text-white px-1 py-0.5 rounded">FULL</span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!showPool ? (
          <>
            {/* Upload area */}
            {!isUploading && selectedFiles.length === 0 && (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg text-gray-600 mb-2">
                  Drag and drop up to {MAX_FILES_PER_BATCH} video files here, or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Process {MAX_FILES_PER_BATCH} files at a time for optimal transcoding • Supports all video formats • Max 2GB per file
                </p>
                <p className="text-sm text-green-600 mt-2">
                  💡 Web-compatible MP4 H.264 videos will skip transcoding
                </p>
                {processingFiles && (
                  <p className="text-sm text-blue-600 mt-4">
                    Processing selected files...
                  </p>
                )}
              </div>
            )}

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">
                    Selected Files ({selectedFiles.length}/{MAX_FILES_PER_BATCH})
                  </h3>
                  {!isUploading && selectedFiles.length < MAX_FILES_PER_BATCH && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                      disabled={processingFiles}
                    >
                      + Add more files ({MAX_FILES_PER_BATCH - selectedFiles.length} remaining)
                    </button>
                  )}
                  {selectedFiles.length >= MAX_FILES_PER_BATCH && (
                    <span className="text-sm text-orange-600">
                      Batch limit reached - upload these files first
                    </span>
                  )}
                </div>

                {/* Credit info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-900">
                    Total credits needed: <strong>{totalCreditsNeeded}</strong>
                  </span>
                </div>

                {/* Batch limit info */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-900">
                    Optimal batch size: {selectedFiles.length}/{MAX_FILES_PER_BATCH} files for best transcoding performance
                  </span>
                </div>

                {/* Pool limit warning */}
                {poolVideos.length + selectedFiles.length > MAX_POOL_CAPACITY && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm text-orange-900">
                      Warning: Pool limit is {MAX_POOL_CAPACITY} videos. You have {poolVideos.length} in pool and {selectedFiles.length} selected.
                      Only {Math.max(0, MAX_POOL_CAPACITY - poolVideos.length)} can be uploaded.
                    </span>
                  </div>
                )}

                {/* File list */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedFiles.map((fileData) => {
                    const status = uploadStatus[fileData.file.name]
                    const progress = uploadProgress[fileData.file.name]
                    const needsTranscoding = determineTranscodingNeed(fileData.formatInfo, fileData.metadata)

                    return (
                      <div
                        key={fileData.id}
                        className="border rounded-lg p-4 bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <Film className="w-5 h-5 text-gray-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{fileData.name}</p>
                              <p className="text-sm text-gray-500">
                                {formatFileSize(fileData.size)} • 
                                {formatDuration(fileData.metadata?.duration)} • 
                                {fileData.metadata?.width}x{fileData.metadata?.height} • 
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ml-1 ${getFormatBadgeColor(fileData.formatInfo?.formatKey)}`}>
                                  {fileData.formatInfo?.formatKey?.toUpperCase()}
                                </span> • 
                                {fileData.creditsNeeded} credits
                              </p>
                              {needsTranscoding ? (
                                <p className="text-xs text-orange-600 mt-1">
                                  ⚠️ Will need transcoding for web compatibility
                                </p>
                              ) : (
                                <p className="text-xs text-green-600 mt-1">
                                  ✅ Web-ready format - no transcoding needed
                                </p>
                              )}
                              
                              {/* Status */}
                              {status && (
                                <div className="mt-2">
                                  {status.status === 'uploading' && (
                                    <div>
                                      <p className="text-sm text-blue-600">{status.message}</p>
                                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                        <div 
                                          className="bg-blue-500 h-2 rounded-full transition-all"
                                          style={{ width: `${progress || 0}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  {status.status === 'processing' && (
                                    <p className="text-sm text-yellow-600">{status.message}</p>
                                  )}
                                  {status.status === 'complete' && (
                                    <p className="text-sm text-green-600 flex items-center gap-1">
                                      <CheckCircle className="w-4 h-4" />
                                      {status.message}
                                    </p>
                                  )}
                                  {status.status === 'error' && (
                                    <p className="text-sm text-red-600 flex items-center gap-1">
                                      <AlertCircle className="w-4 h-4" />
                                      {status.message}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {!isUploading && !status && (
                            <button
                              onClick={() => removeFile(fileData.id)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Video Pool Tab */
          <div className="space-y-6">
            {/* Transcoding Manager - Only show if component exists */}
            {PoolTranscodeManager && (
              <PoolTranscodeManager 
                projectId={projectId} 
                onTranscodeComplete={handleTranscodeComplete}
                key={refreshTrigger}
              />
            )}
            
            {/* Show a simple message if PoolTranscodeManager is not available */}
            {!PoolTranscodeManager && poolVideos.some(v => videoNeedsTranscoding(v)) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-900">
                      Video Processing Required
                    </h3>
                    <p className="text-sm text-amber-700 mt-1">
                      Some videos need to be converted for web playback. 
                      Save the PoolTranscodeManager component to enable batch transcoding.
                    </p>
                    <p className="text-xs text-amber-600 mt-2">
                      Note: Web-compatible MP4 H.264 videos won't need transcoding.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Pool Videos */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Videos in Pool ({poolVideos.length}/{MAX_POOL_CAPACITY})</h3>
                {poolVideos.length >= MAX_POOL_CAPACITY && (
                  <span className="text-sm text-orange-600">Pool limit reached</span>
                )}
              </div>
              {poolVideos.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No videos in the pool yet. Upload some videos to get started.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {poolVideos.map((video) => {
                    const needsTranscoding = videoNeedsTranscoding(video)
                    
                    return (
                      <div key={video.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start gap-3">
                          <Film className="w-5 h-5 text-gray-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{video.original_filename}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-gray-500">
                                {formatFileSize(video.file_size)} • 
                                {formatDuration(video.duration)} • 
                                {video.width}x{video.height}
                              </span>
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getFormatBadgeColor(video.format)}`}>
                                {video.format?.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              <Clock className="inline w-3 h-3 mr-1" />
                              {new Date(video.created_at).toLocaleDateString()}
                            </p>
                            {video.status === 'processing' && (
                              <p className="text-xs text-blue-600 mt-1">
                                🔄 Transcoding in progress...
                              </p>
                            )}
                            {video.status === 'error' && (
                              <p className="text-xs text-red-600 mt-1">
                                ❌ Transcoding failed
                              </p>
                            )}
                            {video.metadata?.transcoded && (
                              <p className="text-xs text-green-600 mt-1">
                                ✅ Optimized for web playback ({video.metadata?.resolution || '480p'})
                              </p>
                            )}
                            {!video.metadata?.transcoded && !needsTranscoding && video.status === 'ready' && (
                              <p className="text-xs text-green-600 mt-1">
                                ✅ Web-ready format - no transcoding needed
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handlePreviewVideo(video)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Preview video"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deletePoolVideo(video.id, video.video_url)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete video"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!showPool && (
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div>
              {selectedFiles.length > 0 && !processingFiles && (
                <p className="text-sm text-gray-600">
                  Batch {selectedFiles.length}/{MAX_FILES_PER_BATCH} • Total credits: <span className="font-semibold">{totalCreditsNeeded}</span>
                </p>
              )}
              {processingFiles && (
                <p className="text-sm text-blue-600">
                  Extracting video metadata...
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isUploading || processingFiles}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={startBulkUpload}
                disabled={selectedFiles.length === 0 || isUploading || processingFiles}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : `Upload Batch (${selectedFiles.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      <VideoPreviewModal 
        video={previewVideo}
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false)
          setPreviewVideo(null)
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={(e) => {
          if (e.target.files) {
            handleFileSelection(Array.from(e.target.files))
          }
        }}
        className="hidden"
      />
    </div>
  )
}

export default BulkVideoUpload