// lib/video/upload-manager.js

import { BackblazeB2Storage, uploadToB2 } from './storage/backblaze-storage'
import { 
  getS3UploadUrl, 
  updateSectionWithVideo
} from '@/lib/actions/video-upload'
import {
  createTranscodeJob,
  checkTranscodeStatus,
  updateSectionWithTranscodedVideo
} from './mediaconvert-service'
import { detectVideoFormat } from './format-detector'
import { generateVideoThumbnail } from './video-metadata'

/**
 * Upload Manager
 * Orchestrates the entire video upload and processing flow with smart format detection
 */
export class VideoUploadManager {
  constructor() {
    this.storage = new BackblazeB2Storage({})
  }

  /**
   * Check if video needs transcoding based on format and compatibility
   * @param {Object} formatInfo - Format detection results
   * @param {Object} videoMetadata - Video metadata (dimensions, codec, etc)
   * @returns {boolean} True if transcoding is needed
   */
  shouldTranscode(formatInfo, videoMetadata) {
    // Skip transcoding for compatible MP4s
    if (formatInfo.formatKey === 'mp4' || formatInfo.extension === 'mp4') {
      // Check if browser can play it
      if (formatInfo.compatibility.canPlayInBrowser) {
        // Check resolution - if 720p or lower, no need to transcode
        if (videoMetadata && videoMetadata.height <= 720) {
          console.log('Skipping transcoding: Compatible MP4, resolution <= 720p')
          return false
        }
        // For higher resolutions, we might still want to transcode to 720p
        console.log('Will transcode: MP4 but resolution > 720p')
        return true
      }
    }
    
    // Always transcode these formats
    const alwaysTranscode = ['avi', 'wmv', 'flv', 'mkv', 'mts', '3gp']
    if (alwaysTranscode.includes(formatInfo.formatKey)) {
      console.log(`Will transcode: Format ${formatInfo.formatKey} requires conversion`)
      return true
    }
    
    // If browser can't play it, transcode
    if (!formatInfo.compatibility.canPlayInBrowser) {
      console.log('Will transcode: Browser cannot play this format')
      return true
    }
    
    // Default to not transcoding if compatible
    console.log('Skipping transcoding: Format is compatible')
    return false
  }

  /**
   * Upload video with progress tracking and optional MediaConvert transcoding
   * @param {Object} params - Upload parameters
   * @returns {Promise<Object>} Upload result
   */
  async uploadVideo({
    file,
    sectionId,
    userId,
    onProgress,
    onStatusChange
  }) {
    try {
      // Step 1: Detect video format and compatibility
      onStatusChange?.('analyzing')
      const formatInfo = await detectVideoFormat(file)
      console.log('Format detection:', formatInfo)
      
      // Extract video metadata to check resolution
      let videoMetadata = null
      try {
        videoMetadata = await generateVideoThumbnail(file, 1)
        console.log('Video metadata:', {
          width: videoMetadata.width,
          height: videoMetadata.height,
          duration: videoMetadata.duration
        })
      } catch (error) {
        console.warn('Could not extract video metadata:', error)
      }
      
      // Determine if transcoding is needed
      const needsTranscoding = this.shouldTranscode(formatInfo, videoMetadata)
      
      // Step 2: Get presigned upload URL from server
      onStatusChange?.('preparing')
      const uploadUrlResult = await getS3UploadUrl({
        fileName: file.name,
        contentType: file.type,
        contentLength: file.size,
        sectionId,
        userId
      })

      if (!uploadUrlResult.success) {
        throw new Error(uploadUrlResult.error || 'Failed to get upload URL')
      }

      const { uploadData } = uploadUrlResult

      // Step 3: Upload to S3
      onStatusChange?.('uploading')
      const uploadResult = await uploadToS3(
        file,
        uploadData,
        (progress) => {
          if (needsTranscoding) {
            onProgress?.(progress * 0.7) // 70% for upload if transcoding
          } else {
            onProgress?.(progress * 0.95) // 95% for upload if no transcoding
          }
        }
      )

      if (!uploadResult.success) {
        throw new Error('Upload failed')
      }

      // Step 4: Update section with S3 URL
      onStatusChange?.('processing')
      if (!needsTranscoding) {
        onProgress?.(98)
      } else {
        onProgress?.(75)
      }
      
      const updateResult = await updateSectionWithVideo({
        sectionId,
        videoUrl: uploadData.publicUrl,
        fileName: file.name,
        duration: videoMetadata?.duration || 0,
        metadata: {
          originalSize: file.size,
          contentType: file.type,
          s3Key: uploadData.key,
          format: formatInfo.format,
          width: videoMetadata?.width,
          height: videoMetadata?.height,
          needsTranscoding: needsTranscoding
        },
        userId
      })

      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update section')
      }

      let finalVideoUrl = uploadData.publicUrl
      let wasTranscoded = false
      
      // Step 5: Transcode if needed
      if (needsTranscoding) {
        onStatusChange?.('transcoding')
        onProgress?.(80)
        
        // Extract the filename from the S3 key to reuse the same timestamp
        const keyParts = uploadData.key.split('/')
        const s3Filename = keyParts[keyParts.length - 1]
        const fileNameWithoutExt = s3Filename.replace(/\.[^/.]+$/, '')
        const outputKey = fileNameWithoutExt
        
        const transcodeResult = await createTranscodeJob({
          inputUrl: uploadData.publicUrl,
          outputKey,
          sectionId,
          userId,
          metadata: {
            originalFormat: file.type,
            originalSize: file.size,
            sourceHeight: videoMetadata?.height,
            targetHeight: (videoMetadata?.height > 720) ? 720 : videoMetadata?.height
          }
        })

        if (transcodeResult.success) {
          // Poll for MediaConvert job completion
          const transcodeStatus = await this.waitForTranscoding(
            transcodeResult.jobId,
            (progress) => onProgress?.(80 + (progress * 0.2)) // Last 20%
          )
          
          if (transcodeStatus.ready) {
            finalVideoUrl = transcodeResult.outputUrl
            wasTranscoded = true
            
            // Update section with transcoded URL
            await updateSectionWithTranscodedVideo({
              sectionId,
              transcodedUrl: finalVideoUrl,
              originalUrl: uploadData.publicUrl,
              userId
            })
          }
        } else {
          console.log('MediaConvert failed, using original video')
        }
      }

      onProgress?.(100)
      onStatusChange?.('complete')

      return {
        success: true,
        videoUrl: finalVideoUrl,
        s3Url: uploadData.publicUrl,
        fileName: file.name,
        metadata: {
          size: file.size,
          type: file.type,
          s3Key: uploadData.key,
          transcoded: wasTranscoded,
          format: wasTranscoded ? '720p_mp4' : formatInfo.format,
          skippedTranscoding: !needsTranscoding,
          originalHeight: videoMetadata?.height,
          finalHeight: wasTranscoded ? 
            Math.min(720, videoMetadata?.height || 720) : 
            videoMetadata?.height
        }
      }

    } catch (error) {
      console.error('Upload failed:', error)
      onStatusChange?.('error')
      throw error
    }
  }

  /**
   * Wait for MediaConvert transcoding to complete
   * @param {string} jobId - MediaConvert job ID
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Final transcode status
   */
  async waitForTranscoding(jobId, onProgress) {
    const maxAttempts = 60 // 5 minutes max
    let attempts = 0
    
    while (attempts < maxAttempts) {
      const statusResult = await checkTranscodeStatus(jobId)
      
      if (!statusResult.success) {
        throw new Error('Failed to check transcode status')
      }
      
      if (statusResult.ready) {
        onProgress?.(100)
        return statusResult
      }
      
      if (statusResult.failed) {
        throw new Error(statusResult.errorMessage || 'Transcoding failed')
      }
      
      // Update progress
      onProgress?.(statusResult.progress || 0)
      
      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000))
      attempts++
    }
    
    throw new Error('Transcoding timeout')
  }

  /**
   * Upload to S3 using XMLHttpRequest
   */
  async uploadToS3(file, uploadData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          onProgress?.(percentComplete)
        }
      })
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ success: true })
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`))
        }
      })
      
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'))
      })
      
      xhr.open('PUT', uploadData.url)
      
      // Set headers from uploadData (but not Content-Length)
      Object.entries(uploadData.headers).forEach(([key, value]) => {
        if (key !== 'Content-Length') {
          xhr.setRequestHeader(key, value)
        }
      })
      
      xhr.send(file)
    })
  }

  /**
   * Format upload status for display
   * @param {string} status - Current status
   * @returns {string} Human-readable status
   */
  formatStatus(status) {
    const statusMessages = {
      analyzing: 'Analyzing video format...',
      preparing: 'Preparing upload...',
      uploading: 'Uploading to cloud storage...',
      processing: 'Processing video...',
      transcoding: 'Optimizing video for web playback...',
      complete: 'Upload complete!',
      error: 'Upload failed'
    }
    
    return statusMessages[status] || status
  }
}

// Export singleton instance
export const uploadManager = new VideoUploadManager()

// Also export the upload function for backward compatibility
export const uploadToS3 = VideoUploadManager.prototype.uploadToS3