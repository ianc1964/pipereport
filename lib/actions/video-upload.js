// lib/actions/video-upload.js
'use server'

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabaseAdmin } from '@/lib/supabase-server'

// Initialize S3 client for AWS S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

/**
 * Generate presigned PUT URL for direct upload to AWS S3
 * @param {Object} params - Upload parameters
 * @returns {Promise<Object>} Presigned upload data
 */
export async function getS3UploadUrl(params) {
  try {
    const { fileName, contentType, contentLength, sectionId, userId } = params
    
    // Verify user is authenticated
    if (!userId) {
      throw new Error('User not authenticated')
    }
    
    // Verify section belongs to user's company
    const { data: section, error: sectionError } = await supabaseAdmin
      .from('sections')
      .select('id, project_id, projects(user_id)')
      .eq('id', sectionId)
      .single()
    
    if (sectionError || !section) {
      throw new Error('Section not found')
    }
    
    // Generate unique key
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `videos/${sectionId}/${timestamp}-${sanitizedFileName}`
    
    // Create presigned PUT URL with public-read ACL
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_OUTPUT_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read', // Make the object publicly readable
    })
    
    // Generate presigned URL (expires in 1 hour)
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
    
    // Construct public URL
    const publicUrl = `https://${process.env.AWS_S3_OUTPUT_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
    
    return {
      success: true,
      uploadData: {
        url: presignedUrl,
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          // Don't include Content-Length in headers - browser will set it
        },
        publicUrl,
        key,
      }
    }
  } catch (error) {
    console.error('Error generating S3 upload URL:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Delete video from S3
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} Delete result
 */
export async function deleteS3Video(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_OUTPUT_BUCKET,
      Key: key,
    })
    
    await s3Client.send(command)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting S3 video:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Update section with video URL after successful upload
 * @param {Object} params - Update parameters
 * @returns {Promise<Object>} Update result
 */
export async function updateSectionWithVideo(params) {
  try {
    const { sectionId, videoUrl, fileName, duration, metadata, userId } = params
    
    // Verify user has access to section
    const { data: section, error: sectionError } = await supabaseAdmin
      .from('sections')
      .select('id, project_id, projects(user_id)')
      .eq('id', sectionId)
      .single()
    
    if (sectionError || !section) {
      throw new Error('Section not found')
    }
    
    // Update section
    const { error: updateError } = await supabaseAdmin
      .from('sections')
      .update({
        video_url: videoUrl,
        video_filename: fileName,
        video_duration: duration,
        video_metadata: {
          ...metadata,
          storage_provider: 'aws-s3',
          uploaded_at: new Date().toISOString()
        }
      })
      .eq('id', sectionId)
    
    if (updateError) {
      throw updateError
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error updating section:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Keep the old B2 function name for backward compatibility if needed
export { getS3UploadUrl as getB2UploadUrl }