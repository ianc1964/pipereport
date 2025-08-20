import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Upload video file to Supabase storage with progress tracking
export const uploadVideo = async (videoBlob, filename, sectionId, onProgress = null) => {
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    // Create file path with user ID and section ID for organization
    const filePath = `${user.id}/${sectionId}/${filename}`

    // Determine content type based on filename extension
    const extension = filename.split('.').pop().toLowerCase()
    const contentTypeMap = {
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'wmv': 'video/x-ms-wmv',
      'webm': 'video/webm',
      'mkv': 'video/x-matroska',
      'flv': 'video/x-flv'
    }
    const contentType = contentTypeMap[extension] || 'video/mp4'

    // Upload video to Supabase storage with progress tracking
    const { data, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filePath, videoBlob, {
        contentType: contentType,
        upsert: true // Allow overwriting if file already exists
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // Get public URL for the uploaded video
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(filePath)

    return {
      videoUrl: publicUrl,
      filePath: filePath,
      error: null
    }

  } catch (error) {
    console.error('Video upload error:', error)
    return {
      videoUrl: null,
      filePath: null,
      error: error.message
    }
  }
}

// Upload extracted image to Supabase storage
export const uploadImage = async (imageBlob, filename, sectionId) => {
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    // Create file path for images
    const filePath = `${user.id}/${sectionId}/${filename}`

    // Upload image to Supabase storage
    const { data, error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, imageBlob, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Image upload failed: ${uploadError.message}`)
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filePath)

    return {
      imageUrl: publicUrl,
      filePath: filePath,
      error: null
    }

  } catch (error) {
    console.error('Image upload error:', error)
    return {
      imageUrl: null,
      filePath: null,
      error: error.message
    }
  }
}

// Get public URL for any stored file
export const getPublicUrl = (bucket, path) => {
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)
  
  return publicUrl
}

// Delete video file from storage
export const deleteVideo = async (filePath) => {
  try {
    console.log('Attempting to delete video at path:', filePath)
    
    const { error } = await supabase.storage
      .from('videos')
      .remove([filePath])

    if (error) {
      console.error('Storage delete error:', error)
      // Don't throw error - file might not exist, which is OK
      return { success: true, error: `Warning: ${error.message}` }
    }

    console.log('Video file deleted successfully from storage')
    return { success: true, error: null }

  } catch (error) {
    console.error('Video delete error:', error)
    // Still return success if it's just a file not found error
    return { success: true, error: error.message }
  }
}

// Delete image file from storage
export const deleteImage = async (filePath) => {
  try {
    const { error } = await supabase.storage
      .from('images')
      .remove([filePath])

    if (error) {
      throw new Error(`Delete failed: ${error.message}`)
    }

    return { success: true, error: null }

  } catch (error) {
    console.error('Image delete error:', error)
    return { success: false, error: error.message }
  }
}

// Helper to format file sizes
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Helper to format video duration
export const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '0:00'
  
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
}

// Helper to validate video file
export const isValidVideoFile = (file) => {
  const validTypes = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo', // AVI
    'video/x-ms-wmv',  // WMV
    'video/webm'
  ]
  
  return validTypes.includes(file.type)
}

// Helper to get video file extension from MIME type
export const getVideoExtension = (mimeType) => {
  const extensions = {
    'video/mp4': 'mp4',
    'video/mpeg': 'mpeg',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-ms-wmv': 'wmv',
    'video/webm': 'webm'
  }
  
  return extensions[mimeType] || 'mp4'
}