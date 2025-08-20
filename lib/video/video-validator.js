// lib/video/video-validator.js

/**
 * Video Validation Module
 * Handles all video file validation rules and constraints
 */

// Validation rules configuration
const VALIDATION_RULES = {
  maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
  minFileSize: 1024, // 1KB - prevent empty files
  allowedMimeTypes: [
    'video/*', // Accept all video types
  ],
  // Dangerous extensions to block
  blockedExtensions: ['exe', 'bat', 'cmd', 'sh', 'app', 'dmg', 'pkg'],
  maxDuration: 3600, // 1 hour max
  minDuration: 1, // 1 second minimum
}

/**
 * Comprehensive video file validation
 * @param {File} file - Video file to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with errors and warnings
 */
export async function validateVideoFile(file, options = {}) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    metadata: {}
  }
  
  // Basic file validation
  const basicValidation = validateBasicFileProperties(file)
  if (!basicValidation.valid) {
    result.valid = false
    result.errors.push(...basicValidation.errors)
  }
  result.warnings.push(...basicValidation.warnings)
  
  // Security validation
  const securityValidation = validateFileSecurity(file)
  if (!securityValidation.valid) {
    result.valid = false
    result.errors.push(...securityValidation.errors)
  }
  
  // If basic validation passed, do deeper checks
  if (result.valid && options.deepValidation !== false) {
    try {
      const videoValidation = await validateVideoProperties(file)
      if (!videoValidation.valid) {
        result.valid = false
        result.errors.push(...videoValidation.errors)
      }
      result.warnings.push(...videoValidation.warnings)
      result.metadata = videoValidation.metadata
    } catch (error) {
      result.warnings.push(`Could not validate video properties: ${error.message}`)
    }
  }
  
  return result
}

/**
 * Validate basic file properties
 * @param {File} file - File to validate
 * @returns {Object} Validation result
 */
function validateBasicFileProperties(file) {
  const result = {
    valid: true,
    errors: [],
    warnings: []
  }
  
  // Check if file exists
  if (!file) {
    result.valid = false
    result.errors.push('No file provided')
    return result
  }
  
  // Check file size
  if (file.size > VALIDATION_RULES.maxFileSize) {
    result.valid = false
    result.errors.push(
      `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${formatFileSize(VALIDATION_RULES.maxFileSize)}`
    )
  }
  
  if (file.size < VALIDATION_RULES.minFileSize) {
    result.valid = false
    result.errors.push('File appears to be empty or corrupted')
  }
  
  // Check if it's a video file
  if (!file.type.startsWith('video/')) {
    // Some video files don't have proper mime types, check extension
    const extension = getFileExtension(file.name)
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'mpg', 'mpeg', '3gp', 'mts', 'm2ts']
    
    if (!videoExtensions.includes(extension.toLowerCase())) {
      result.valid = false
      result.errors.push('Please select a valid video file')
    } else {
      result.warnings.push('File type could not be verified, proceeding based on extension')
    }
  }
  
  // Warn about large files
  if (file.size > 1 * 1024 * 1024 * 1024) { // 1GB
    result.warnings.push(
      `Large file size (${formatFileSize(file.size)}) may take longer to process`
    )
  }
  
  return result
}

/**
 * Validate file security
 * @param {File} file - File to validate
 * @returns {Object} Validation result
 */
function validateFileSecurity(file) {
  const result = {
    valid: true,
    errors: []
  }
  
  const extension = getFileExtension(file.name)
  
  // Check for blocked extensions
  if (VALIDATION_RULES.blockedExtensions.includes(extension.toLowerCase())) {
    result.valid = false
    result.errors.push('This file type is not allowed for security reasons')
  }
  
  // Check for suspicious filenames
  const suspiciousPatterns = [
    /\.(exe|bat|cmd|sh|ps1|vbs|jar)$/i,
    /\.(dll|so|dylib)$/i,
    /\.(zip|rar|7z|tar|gz)$/i // Archives that might contain executables
  ]
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(file.name)) {
      result.valid = false
      result.errors.push('Suspicious file type detected')
      break
    }
  }
  
  // Check for path traversal attempts
  if (file.name.includes('../') || file.name.includes('..\\')) {
    result.valid = false
    result.errors.push('Invalid filename')
  }
  
  return result
}

/**
 * Validate video-specific properties
 * @param {File} file - Video file to validate
 * @returns {Promise<Object>} Validation result with metadata
 */
async function validateVideoProperties(file) {
  return new Promise((resolve) => {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: {}
    }
    
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    let timeoutId
    
    const cleanup = () => {
      clearTimeout(timeoutId)
      URL.revokeObjectURL(url)
      video.remove()
    }
    
    video.onloadedmetadata = () => {
      // Extract metadata
      result.metadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight
      }
      
      // Validate duration
      if (video.duration > VALIDATION_RULES.maxDuration) {
        result.valid = false
        result.errors.push(
          `Video duration (${formatDuration(video.duration)}) exceeds maximum allowed duration of ${formatDuration(VALIDATION_RULES.maxDuration)}`
        )
      }
      
      if (video.duration < VALIDATION_RULES.minDuration) {
        result.valid = false
        result.errors.push('Video is too short (minimum 1 second)')
      }
      
      // Validate dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        result.valid = false
        result.errors.push('Video appears to be corrupted (no video stream detected)')
      }
      
      // Warn about unusual aspect ratios
      const aspectRatio = video.videoWidth / video.videoHeight
      if (aspectRatio < 0.5 || aspectRatio > 3) {
        result.warnings.push('Video has an unusual aspect ratio')
      }
      
      // Warn about very high resolutions
      if (video.videoWidth > 3840 || video.videoHeight > 2160) {
        result.warnings.push(
          `Very high resolution (${video.videoWidth}x${video.videoHeight}) may impact performance`
        )
      }
      
      cleanup()
      resolve(result)
    }
    
    video.onerror = () => {
      result.warnings.push('Could not load video metadata - file may be corrupted or in an unsupported format')
      cleanup()
      resolve(result)
    }
    
    // Timeout after 10 seconds
    timeoutId = setTimeout(() => {
      result.warnings.push('Video metadata loading timed out')
      cleanup()
      resolve(result)
    }, 10000)
    
    video.preload = 'metadata'
    video.src = url
  })
}

/**
 * Get file extension
 * @param {string} filename - File name
 * @returns {string} Extension without dot
 */
function getFileExtension(filename) {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

/**
 * Format duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

/**
 * Create a validation summary message
 * @param {Object} validationResult - Result from validateVideoFile
 * @returns {string} Summary message
 */
export function createValidationSummary(validationResult) {
  if (validationResult.valid) {
    return 'Video file is valid and ready for upload'
  }
  
  const errorCount = validationResult.errors.length
  const warningCount = validationResult.warnings.length
  
  let summary = ''
  if (errorCount > 0) {
    summary += `${errorCount} error${errorCount > 1 ? 's' : ''} found`
  }
  if (warningCount > 0) {
    if (summary) summary += ', '
    summary += `${warningCount} warning${warningCount > 1 ? 's' : ''}`
  }
  
  return summary
}