// components/VideoUpload.js (Refactored Version)
'use client'

import { useState, useRef } from 'react'
import { Upload, Film, AlertCircle, CheckCircle, X, CreditCard, FileVideo, AlertTriangle, Cloud } from 'lucide-react'
import { useAuth } from '../lib/auth-context'
import { checkCredits, consumeCredits, calculateCreditsRequired } from '../lib/credits'
import { detectVideoFormat, isWebCompatible } from '../lib/video/format-detector'
import { validateVideoFile } from '../lib/video/video-validator'
import { extractVideoMetadata } from '../lib/video/video-metadata'
import { uploadManager } from '../lib/video/upload-manager'

const VideoUpload = ({ sectionId, onUploadComplete, onCancel }) => {
  const { user, company, refreshProfile } = useAuth()
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  // New states for enhanced flow
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileAnalysis, setFileAnalysis] = useState(null)
  const [validationResult, setValidationResult] = useState(null)
  const [requiredCredits, setRequiredCredits] = useState(0)
  const [calculatingCredits, setCalculatingCredits] = useState(false)
  const [showFormatWarning, setShowFormatWarning] = useState(false)
  
  const fileInputRef = useRef(null)

  // Handle file selection with enhanced validation and format detection
  const handleFileSelection = async (file) => {
    if (!file) return
    
    setError('')
    setShowFormatWarning(false)
    setFileAnalysis(null)
    setValidationResult(null)
    
    // Step 1: Basic validation
    const validation = await validateVideoFile(file)
    setValidationResult(validation)
    
    if (!validation.valid) {
      setError(validation.errors.join('. '))
      return
    }
    
    // Step 2: Format detection
    const formatInfo = await detectVideoFormat(file)
    setFileAnalysis(formatInfo)
    
    // Step 3: Show warnings if needed
    if (formatInfo.recommendations.requiresTranscoding || !formatInfo.compatibility.canPlayInBrowser) {
      setShowFormatWarning(true)
    }
    
    // Step 4: Calculate credits
    setCalculatingCredits(true)
    try {
      const { credits } = await calculateCreditsRequired('video_upload', {
        fileSize: file.size
      })
      setRequiredCredits(credits)
    } catch (error) {
      console.error('Error calculating credits:', error)
      setRequiredCredits(10) // Fallback
    } finally {
      setCalculatingCredits(false)
    }
    
    setSelectedFile(file)
  }

  // Handle actual upload with new upload manager
  const handleFileUpload = async () => {
    if (!selectedFile || requiredCredits === 0) return

    // Check credits
    if (company?.id) {
      try {
        const hasCredits = await checkCredits(company.id, requiredCredits)
        if (!hasCredits) {
          setError(`Insufficient credits. You need ${requiredCredits} credits.`)
          return
        }
      } catch (err) {
        setError('Failed to verify credit balance.')
        return
      }
    }

    setError('')
    setUploading(true)
    setProgress(0)

    try {
      // Extract metadata first
      const metadata = await extractVideoMetadata(selectedFile)
      
      // Upload using new upload manager
      const uploadResult = await uploadManager.uploadVideo({
        file: selectedFile,
        sectionId,
        userId: user.id,
        onProgress: setProgress,
        onStatusChange: (status) => {
          setUploadStatus(uploadManager.formatStatus(status))
        }
      })
      
      if (!uploadResult.success) {
        throw new Error('Upload failed')
      }

      // Consume credits
      if (company?.id && user?.id) {
        await consumeCredits(
          company.id,
          user.id,
          requiredCredits,
          'video_upload',
          `Video: ${uploadResult.fileName}`
        )
        await refreshProfile()
      }

      setSuccess(true)
      setProgress(100)
      
      setTimeout(() => {
        onUploadComplete({
          videoUrl: uploadResult.videoUrl,
          filename: uploadResult.fileName,
          duration: metadata.duration,
          metadata: {
            ...metadata,
            formatAnalysis: fileAnalysis,
            b2Url: uploadResult.b2Url,
            streamData: uploadResult.streamData,
            storage: 'backblaze-b2',
            transcoding: 'cloudflare-stream'
          }
        })
      }, 1500)

    } catch (err) {
      console.error('Upload failed:', err)
      setError(err.message)
      setUploading(false)
      setProgress(0)
      setUploadStatus('')
    }
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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0])
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-auto">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Upload Successful!
          </h3>
          <p className="text-gray-600 mb-4">
            Your video has been uploaded and is ready for analysis.
          </p>
          <p className="text-sm text-gray-500">
            {requiredCredits} credits used
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Upload Video</h3>
        <button
          onClick={onCancel}
          disabled={uploading}
          className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <AlertCircle className="w-4 h-4 text-red-500 mr-2 mt-0.5" />
            <div className="text-red-700 text-sm">{error}</div>
          </div>
        </div>
      )}

      {/* File selection area */}
      {!selectedFile && !uploading && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">
            Drag and drop your video file here, or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supports all video formats • Max 2GB
          </p>
        </div>
      )}

      {/* File analysis display */}
      {selectedFile && fileAnalysis && !uploading && (
        <div className="space-y-4">
          {/* File info */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center">
                <FileVideo className="w-5 h-5 text-gray-600 mr-2" />
                <div>
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {fileAnalysis.format} • {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null)
                  setFileAnalysis(null)
                  setShowFormatWarning(false)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Compatibility status */}
            <div className="flex items-center text-sm">
              {fileAnalysis.compatibility.canPlayInBrowser ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <span>Compatible format</span>
                </div>
              ) : (
                <div className="flex items-center text-orange-600">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  <span>Format needs conversion</span>
                </div>
              )}
            </div>
          </div>

          {/* Format warning */}
          {showFormatWarning && fileAnalysis.recommendations.warnings.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800 mb-1">Format Notice</p>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {fileAnalysis.recommendations.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-amber-600 mt-2">
                    The video will be automatically converted for optimal playback.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Credit cost */}
          {!calculatingCredits && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center">
                <CreditCard className="w-4 h-4 text-blue-500 mr-2" />
                <span className="text-blue-700 text-sm font-medium">
                  This upload will cost {requiredCredits} credits
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSelectedFile(null)
                setFileAnalysis(null)
                setShowFormatWarning(false)
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleFileUpload}
              disabled={calculatingCredits || requiredCredits === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Upload ({requiredCredits} credits)
            </button>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="text-center">
          <Film className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Uploading...</h4>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">{progress}%</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={(e) => e.target.files[0] && handleFileSelection(e.target.files[0])}
        className="hidden"
      />
    </div>
  )
}

export default VideoUpload