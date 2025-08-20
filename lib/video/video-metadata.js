// lib/video/video-metadata.js

/**
 * Video Metadata Extraction Module
 * Handles extraction and formatting of video metadata
 */

/**
 * Extract comprehensive metadata from video file
 * @param {File} file - Video file
 * @returns {Promise<Object>} Video metadata
 */
export async function extractVideoMetadata(file) {
  const basicMetadata = {
    filename: file.name,
    fileSize: file.size,
    fileSizeFormatted: formatFileSize(file.size),
    lastModified: new Date(file.lastModified),
    mimeType: file.type || 'unknown'
  }
  
  try {
    const videoMetadata = await extractVideoProperties(file)
    const thumbnailData = await generateVideoThumbnail(file)
    
    return {
      ...basicMetadata,
      ...videoMetadata,
      thumbnail: thumbnailData,
      extractedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error extracting video metadata:', error)
    return {
      ...basicMetadata,
      error: error.message,
      extractedAt: new Date().toISOString()
    }
  }
}

/**
 * Extract video-specific properties
 * @param {File} file - Video file
 * @returns {Promise<Object>} Video properties
 */
export function extractVideoProperties(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    let timeoutId
    let isCleanedUp = false
    
    const cleanup = () => {
      if (isCleanedUp) return
      isCleanedUp = true
      
      clearTimeout(timeoutId)
      video.src = '' // Clear the source before revoking
      video.load() // Reset the video element
      URL.revokeObjectURL(url)
      video.remove()
    }
    
    video.onloadedmetadata = () => {
      const metadata = {
        duration: video.duration,
        durationFormatted: formatDuration(video.duration),
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight,
        aspectRatioFormatted: formatAspectRatio(video.videoWidth, video.videoHeight),
        resolution: `${video.videoWidth}x${video.videoHeight}`,
        resolutionCategory: categorizeResolution(video.videoHeight),
        hasVideo: video.videoWidth > 0 && video.videoHeight > 0,
        hasAudio: video.mozHasAudio || video.webkitAudioDecodedByteCount > 0 || true, // Fallback to true
        readyState: video.readyState,
        networkState: video.networkState
      }
      
      // Try to get additional properties if available
      if (video.getVideoPlaybackQuality) {
        const quality = video.getVideoPlaybackQuality()
        metadata.playbackQuality = {
          creationTime: quality.creationTime,
          droppedFrames: quality.droppedVideoFrames,
          totalFrames: quality.totalVideoFrames
        }
      }
      
      cleanup()
      resolve(metadata)
    }
    
    video.onerror = (event) => {
      cleanup()
      reject(new Error('Failed to load video metadata'))
    }
    
    timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('Video metadata extraction timed out'))
    }, 15000)
    
    video.preload = 'metadata'
    video.muted = true // Ensure video can autoplay if needed
    video.playsInline = true
    video.src = url
  })
}

/**
 * Generate a thumbnail from the video
 * @param {File} file - Video file
 * @param {number} timestamp - Timestamp in seconds (default: 1 second)
 * @returns {Promise<Object>} Thumbnail data
 */
export async function generateVideoThumbnail(file, timestamp = 1) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const url = URL.createObjectURL(file)
    let isCleanedUp = false
    
    const cleanup = () => {
      if (isCleanedUp) return
      isCleanedUp = true
      
      video.src = '' // Clear the source before revoking
      video.load() // Reset the video element
      URL.revokeObjectURL(url)
      video.remove()
      canvas.remove()
    }
    
    video.onloadedmetadata = () => {
      // Seek to timestamp or 10% of video if timestamp is beyond duration
      video.currentTime = Math.min(timestamp, video.duration * 0.1)
    }
    
    video.onseeked = () => {
      try {
        // Set canvas size to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        
        // Also create a smaller thumbnail
        const thumbCanvas = document.createElement('canvas')
        const thumbCtx = thumbCanvas.getContext('2d')
        const thumbWidth = 320
        const thumbHeight = Math.round(320 * (video.videoHeight / video.videoWidth))
        
        thumbCanvas.width = thumbWidth
        thumbCanvas.height = thumbHeight
        thumbCtx.drawImage(video, 0, 0, thumbWidth, thumbHeight)
        
        const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7)
        
        // Clean up immediately after getting the data
        cleanup()
        thumbCanvas.remove()
        
        // Return the metadata that upload manager expects
        resolve({
          full: dataUrl,
          thumbnail: thumbnailDataUrl,
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration, // Add duration here
          timestamp: video.currentTime
        })
      } catch (error) {
        cleanup()
        resolve(null)
      }
    }
    
    video.onerror = () => {
      cleanup()
      resolve(null)
    }
    
    // Set up video for thumbnail extraction
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous' // In case of CORS issues
    video.src = url
  })
}

/**
 * Calculate output dimensions for transcoding
 * @param {number} originalWidth - Original video width
 * @param {number} originalHeight - Original video height
 * @param {number} maxHeight - Maximum height (default: 720)
 * @returns {Object} Output dimensions
 */
export function calculateOutputDimensions(originalWidth, originalHeight, maxHeight = 720) {
  const aspectRatio = originalWidth / originalHeight
  let outputWidth, outputHeight
  
  if (originalHeight > maxHeight) {
    outputHeight = maxHeight
    outputWidth = Math.round(maxHeight * aspectRatio)
  } else {
    outputWidth = originalWidth
    outputHeight = originalHeight
  }
  
  // Ensure dimensions are even (required for many codecs)
  outputWidth = outputWidth % 2 === 0 ? outputWidth : outputWidth - 1
  outputHeight = outputHeight % 2 === 0 ? outputHeight : outputHeight - 1
  
  return {
    width: outputWidth,
    height: outputHeight,
    scaled: originalHeight > maxHeight
  }
}

/**
 * Categorize video resolution
 * @param {number} height - Video height
 * @returns {string} Resolution category
 */
function categorizeResolution(height) {
  if (height >= 2160) return '4K'
  if (height >= 1440) return '2K'
  if (height >= 1080) return 'Full HD'
  if (height >= 720) return 'HD'
  if (height >= 480) return 'SD'
  return 'Low'
}

/**
 * Format aspect ratio
 * @param {number} width - Video width
 * @param {number} height - Video height
 * @returns {string} Formatted aspect ratio
 */
function formatAspectRatio(width, height) {
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(width, height)
  const simplifiedWidth = width / divisor
  const simplifiedHeight = height / divisor
  
  // Common aspect ratios
  const ratio = width / height
  if (Math.abs(ratio - 16/9) < 0.01) return '16:9'
  if (Math.abs(ratio - 4/3) < 0.01) return '4:3'
  if (Math.abs(ratio - 21/9) < 0.01) return '21:9'
  if (Math.abs(ratio - 1) < 0.01) return '1:1'
  
  // Return simplified ratio if reasonable
  if (simplifiedWidth < 100 && simplifiedHeight < 100) {
    return `${simplifiedWidth}:${simplifiedHeight}`
  }
  
  // Return decimal ratio
  return ratio.toFixed(2) + ':1'
}

/**
 * Format duration
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Create metadata summary for display
 * @param {Object} metadata - Video metadata
 * @returns {Object} Display-ready summary
 */
export function createMetadataSummary(metadata) {
  if (!metadata) return null
  
  return {
    basic: {
      'File Name': metadata.filename,
      'File Size': metadata.fileSizeFormatted,
      'Duration': metadata.durationFormatted,
      'Format': metadata.mimeType
    },
    video: {
      'Resolution': metadata.resolution,
      'Quality': metadata.resolutionCategory,
      'Aspect Ratio': metadata.aspectRatioFormatted,
      'Dimensions': `${metadata.width} × ${metadata.height} pixels`
    },
    status: {
      'Has Video': metadata.hasVideo ? 'Yes' : 'No',
      'Has Audio': metadata.hasAudio ? 'Yes' : 'No',
      'Ready for Upload': metadata.hasVideo ? 'Yes' : 'No'
    }
  }
}