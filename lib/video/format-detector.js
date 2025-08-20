// lib/video/format-detector.js

/**
 * Video Format Detection and Compatibility Module
 * Provides browser-based video format detection and compatibility checking
 */

// Common video formats and their characteristics
const VIDEO_FORMATS = {
  // Web-friendly formats (usually work everywhere)
  mp4: {
    mimeTypes: ['video/mp4'],
    extensions: ['mp4', 'm4v'],
    browserSupport: 'excellent',
    codecSupport: ['h264', 'h265', 'hevc'],
    needsTranscoding: false,
    description: 'MP4 (H.264/H.265)'
  },
  webm: {
    mimeTypes: ['video/webm'],
    extensions: ['webm'],
    browserSupport: 'good',
    codecSupport: ['vp8', 'vp9', 'av1'],
    needsTranscoding: false,
    description: 'WebM'
  },
  
  // Formats that often need transcoding
  mov: {
    mimeTypes: ['video/quicktime'],
    extensions: ['mov', 'qt'],
    browserSupport: 'limited',
    codecSupport: ['h264', 'prores', 'hevc'],
    needsTranscoding: true,
    description: 'QuickTime'
  },
  avi: {
    mimeTypes: ['video/x-msvideo', 'video/avi'],
    extensions: ['avi'],
    browserSupport: 'poor',
    codecSupport: ['various'],
    needsTranscoding: true,
    description: 'AVI'
  },
  mkv: {
    mimeTypes: ['video/x-matroska'],
    extensions: ['mkv'],
    browserSupport: 'poor',
    codecSupport: ['various'],
    needsTranscoding: true,
    description: 'Matroska'
  },
  wmv: {
    mimeTypes: ['video/x-ms-wmv'],
    extensions: ['wmv'],
    browserSupport: 'poor',
    codecSupport: ['wmv'],
    needsTranscoding: true,
    description: 'Windows Media'
  },
  flv: {
    mimeTypes: ['video/x-flv'],
    extensions: ['flv', 'f4v'],
    browserSupport: 'none',
    codecSupport: ['h264', 'vp6'],
    needsTranscoding: true,
    description: 'Flash Video'
  },
  mts: {
    mimeTypes: ['video/mp2t', 'video/m2ts'],
    extensions: ['mts', 'm2ts', 'ts'],
    browserSupport: 'poor',
    codecSupport: ['h264'],
    needsTranscoding: true,
    description: 'AVCHD'
  },
  '3gp': {
    mimeTypes: ['video/3gpp', 'video/3gpp2'],
    extensions: ['3gp', '3g2'],
    browserSupport: 'limited',
    codecSupport: ['h263', 'h264'],
    needsTranscoding: true,
    description: '3GP Mobile'
  },
  mpg: {
    mimeTypes: ['video/mpeg'],
    extensions: ['mpg', 'mpeg', 'mpe'],
    browserSupport: 'limited',
    codecSupport: ['mpeg1', 'mpeg2'],
    needsTranscoding: true,
    description: 'MPEG'
  }
}

// Browser compatibility test results cache
const compatibilityCache = new Map()

/**
 * Detect video format from file
 * @param {File} file - The video file to analyze
 * @returns {Object} Format information and compatibility
 */
export async function detectVideoFormat(file) {
  const extension = getFileExtension(file.name)
  const mimeType = file.type || 'unknown'
  
  // Find format by extension or mime type
  const format = findFormatByFile(extension, mimeType)
  
  // Test actual browser compatibility
  const compatibility = await testBrowserCompatibility(file)
  
  // Get codec information if possible
  const codecInfo = await detectCodec(file)
  
  return {
    filename: file.name,
    size: file.size,
    mimeType,
    extension,
    format: format?.description || 'Unknown',
    formatKey: Object.keys(VIDEO_FORMATS).find(key => 
      VIDEO_FORMATS[key] === format
    ) || 'unknown',
    browserSupport: format?.browserSupport || 'unknown',
    needsTranscoding: format?.needsTranscoding ?? true,
    compatibility: {
      canPlayInBrowser: compatibility.canPlay,
      supportedByBrowser: compatibility.supported,
      error: compatibility.error,
      testedCodec: codecInfo.codec,
      confidence: compatibility.confidence
    },
    recommendations: generateRecommendations(format, compatibility, codecInfo)
  }
}

/**
 * Test if browser can actually play the video
 * @param {File} file - Video file to test
 * @returns {Object} Compatibility test results
 */
async function testBrowserCompatibility(file) {
  const cacheKey = `${file.type}-${file.size}`
  
  // Check cache first
  if (compatibilityCache.has(cacheKey)) {
    return compatibilityCache.get(cacheKey)
  }
  
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    let timeoutId
    
    const cleanup = () => {
      clearTimeout(timeoutId)
      URL.revokeObjectURL(url)
      video.remove()
    }
    
    const result = {
      canPlay: false,
      supported: false,
      error: null,
      confidence: 'low'
    }
    
    // Set up event handlers
    video.onloadedmetadata = () => {
      result.canPlay = true
      result.supported = true
      result.confidence = 'high'
      cleanup()
      compatibilityCache.set(cacheKey, result)
      resolve(result)
    }
    
    video.onerror = (e) => {
      result.error = 'Browser cannot decode this video format'
      result.confidence = 'high'
      cleanup()
      compatibilityCache.set(cacheKey, result)
      resolve(result)
    }
    
    // Timeout fallback
    timeoutId = setTimeout(() => {
      result.error = 'Compatibility test timed out'
      result.confidence = 'medium'
      cleanup()
      resolve(result)
    }, 5000)
    
    // Test by trying to load metadata
    video.preload = 'metadata'
    video.src = url
  })
}

/**
 * Attempt to detect video codec
 * @param {File} file - Video file
 * @returns {Object} Codec information
 */
async function detectCodec(file) {
  try {
    // Check if MediaSource API is available
    if (!window.MediaSource || !MediaSource.isTypeSupported) {
      return { codec: 'unknown', method: 'unavailable' }
    }
    
    // Common codec strings to test based on file type
    const codecTests = getCodecTestsForFile(file)
    
    for (const codec of codecTests) {
      if (MediaSource.isTypeSupported(codec)) {
        return { codec, method: 'MediaSource' }
      }
    }
    
    return { codec: 'unknown', method: 'MediaSource' }
  } catch (error) {
    return { codec: 'unknown', method: 'error', error: error.message }
  }
}

/**
 * Get codec test strings based on file type
 * @param {File} file - Video file
 * @returns {Array} Codec strings to test
 */
function getCodecTestsForFile(file) {
  const extension = getFileExtension(file.name)
  const mimeBase = file.type.split('/')[0]
  
  // Common codecs to test
  const codecs = []
  
  if (extension === 'mp4' || extension === 'm4v') {
    codecs.push(
      'video/mp4; codecs="avc1.42E01E"', // H.264 Baseline
      'video/mp4; codecs="avc1.4D401E"', // H.264 Main
      'video/mp4; codecs="avc1.64001E"', // H.264 High
      'video/mp4; codecs="hev1.1.6.L93.90"', // H.265/HEVC
      'video/mp4; codecs="hvc1.1.6.L93.90"'  // H.265/HEVC
    )
  }
  
  if (extension === 'webm') {
    codecs.push(
      'video/webm; codecs="vp8"',
      'video/webm; codecs="vp9"',
      'video/webm; codecs="av01.0.05M.08"' // AV1
    )
  }
  
  if (extension === 'mov') {
    codecs.push(
      'video/quicktime',
      'video/mp4; codecs="avc1.42E01E"' // Many MOV files use H.264
    )
  }
  
  return codecs
}

/**
 * Generate recommendations based on format detection
 * @param {Object} format - Format information
 * @param {Object} compatibility - Compatibility test results
 * @param {Object} codecInfo - Codec information
 * @returns {Object} Recommendations
 */
function generateRecommendations(format, compatibility, codecInfo) {
  const recommendations = {
    action: 'proceed',
    warnings: [],
    suggestions: [],
    requiresTranscoding: false
  }
  
  // If browser can play it, we're good
  if (compatibility.canPlay) {
    recommendations.action = 'proceed'
    recommendations.suggestions.push('This video format is compatible with your browser')
    return recommendations
  }
  
  // If format needs transcoding
  if (format?.needsTranscoding) {
    recommendations.requiresTranscoding = true
    recommendations.action = 'transcode'
    recommendations.warnings.push(
      `${format.description} format typically requires conversion for web playback`
    )
    recommendations.suggestions.push(
      'Consider converting to MP4 (H.264) format for best compatibility',
      'The application will handle this automatically with a transcoding service'
    )
  }
  
  // Specific format warnings
  if (format?.browserSupport === 'none') {
    recommendations.warnings.push(
      'This format is not supported by web browsers'
    )
  } else if (format?.browserSupport === 'poor') {
    recommendations.warnings.push(
      'This format has limited browser support'
    )
  }
  
  // Unknown format
  if (!format) {
    recommendations.warnings.push(
      'Unknown video format detected',
      'The file may need conversion before it can be played'
    )
    recommendations.requiresTranscoding = true
  }
  
  return recommendations
}

/**
 * Find format information by extension and mime type
 * @param {string} extension - File extension
 * @param {string} mimeType - MIME type
 * @returns {Object|null} Format information
 */
function findFormatByFile(extension, mimeType) {
  const ext = extension.toLowerCase()
  
  // First try to match by extension
  for (const [key, format] of Object.entries(VIDEO_FORMATS)) {
    if (format.extensions.includes(ext)) {
      return format
    }
  }
  
  // Then try by mime type
  for (const [key, format] of Object.entries(VIDEO_FORMATS)) {
    if (format.mimeTypes.includes(mimeType)) {
      return format
    }
  }
  
  return null
}

/**
 * Get file extension from filename
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
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

/**
 * Check if format is web-compatible
 * @param {string} formatKey - Format key from detection
 * @returns {boolean} True if web-compatible
 */
export function isWebCompatible(formatKey) {
  const format = VIDEO_FORMATS[formatKey]
  return format && !format.needsTranscoding
}