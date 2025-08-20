'use server'

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Get B2 authorization token
 */
async function getB2AuthToken() {
  const credentials = Buffer.from(
    `${process.env.BACKBLAZE_KEY_ID}:${process.env.BACKBLAZE_APPLICATION_KEY}`
  ).toString('base64')

  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to authorize with Backblaze B2')
  }

  const data = await response.json()
  return data
}

/**
 * Get B2 upload URL using native B2 API
 */
async function getB2UploadUrl(authData) {
  const response = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      'Authorization': authData.authorizationToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bucketId: process.env.BACKBLAZE_BUCKET_ID
    })
  })

  if (!response.ok) {
    throw new Error('Failed to get B2 upload URL')
  }

  return await response.json()
}

/**
 * Generate a presigned URL for uploading observation images to Backblaze B2
 * This is the main function to use - it uses native B2 API
 * @param {string} userId - The user ID
 * @param {string} observationId - The observation ID (can be temporary)
 * @param {string} filename - The original filename
 * @returns {Object} Upload URL and final file URL
 */
export async function getB2ImageUploadUrl(userId, observationId, filename) {
  try {
    // Verify user has permission
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      throw new Error('User not found or unauthorized')
    }

    // Generate unique filename with path structure
    const timestamp = Date.now()
    const fileExtension = filename.split('.').pop().toLowerCase()
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    
    // Structure: images/observations/{observationId}/{timestamp}-{filename}
    const b2Key = `images/observations/${observationId}/${timestamp}-${safeFilename}`

    // Get B2 authorization
    const b2AuthData = await getB2AuthToken()
    
    // Get upload URL from B2
    const uploadData = await getB2UploadUrl(b2AuthData)
    
    // The download URL is provided in the auth response
    // Use downloadUrl from the auth response to construct the public URL
    const downloadUrlBase = b2AuthData.downloadUrl
    const publicUrl = `${downloadUrlBase}/file/${process.env.BACKBLAZE_BUCKET_NAME}/${b2Key}`
    
    console.log('Generated public URL using API response:', publicUrl)

    return {
      uploadUrl: uploadData.uploadUrl,
      authToken: uploadData.authorizationToken,
      key: b2Key,
      publicUrl
    }
  } catch (error) {
    console.error('Error generating B2 image upload URL:', error)
    throw new Error(`Failed to generate upload URL: ${error.message}`)
  }
}

/**
 * Alternative S3-compatible approach using presigned URLs without AWS SDK
 * Uses the S3-compatible API that Backblaze B2 provides
 */
export async function getB2ImageUploadUrlS3(userId, observationId, filename) {
  try {
    // Verify user
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      throw new Error('User not found or unauthorized')
    }

    // Generate unique filename
    const timestamp = Date.now()
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `images/observations/${observationId}/${timestamp}-${safeFilename}`

    // For S3-compatible approach, we'll create a simple presigned URL
    // This is a simplified version that works with B2's S3-compatible API
    const region = process.env.BACKBLAZE_REGION || 'us-west-002'
    const bucket = process.env.BACKBLAZE_BUCKET_NAME
    const endpoint = `https://s3.${region}.backblazeb2.com`
    
    // Create a simple PUT URL (B2 accepts public uploads if bucket is configured for it)
    // For production, you might want to use the native B2 API approach above
    const uploadUrl = `${endpoint}/${bucket}/${key}`
    
    // For public buckets, we can upload directly
    // The actual signing would require AWS SDK, so we'll use the native B2 API instead
    console.log('Note: Using native B2 API instead of S3-compatible for better security')
    
    // Fallback to native B2 API
    return getB2ImageUploadUrl(userId, observationId, filename)
  } catch (error) {
    console.error('Error generating B2 S3 upload URL:', error)
    throw new Error(`Failed to generate upload URL: ${error.message}`)
  }
}

/**
 * Delete image from B2 (for cleanup if needed)
 */
export async function deleteB2Image(imageUrl) {
  try {
    // Extract key from URL
    const urlParts = imageUrl.split('/')
    const key = urlParts.slice(urlParts.indexOf('images')).join('/')
    
    const authData = await getB2AuthToken()
    
    // First, get file info using b2_list_file_names
    const listResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_list_file_names`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: process.env.BACKBLAZE_BUCKET_ID,
        prefix: key,
        maxFileCount: 1
      })
    })

    if (!listResponse.ok) {
      throw new Error('Failed to find file in B2')
    }

    const listData = await listResponse.json()
    if (listData.files.length === 0) {
      console.log('File not found in B2:', key)
      return true // Already deleted
    }

    const file = listData.files[0]

    // Delete the file using b2_delete_file_version
    const deleteResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_delete_file_version`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.fileName,
        fileId: file.fileId
      })
    })

    if (!deleteResponse.ok) {
      throw new Error('Failed to delete file from B2')
    }

    console.log('Successfully deleted image from B2:', key)
    return true
  } catch (error) {
    console.error('Error deleting B2 image:', error)
    return false
  }
}

// Note: Upload headers are generated inline in the client component
// All exports in this server actions file must be async functions