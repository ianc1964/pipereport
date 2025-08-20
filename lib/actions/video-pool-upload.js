// lib/actions/video-pool-upload.js
'use server'

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabaseAdmin } from '@/lib/supabase-server'

// Initialize AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

/**
 * Generate presigned PUT URL for direct upload to pool (no section required)
 * @param {Object} params - Upload parameters
 * @returns {Promise<Object>} Presigned upload data
 */
export async function getPoolUploadUrl(params) {
  try {
    const { fileName, contentType, contentLength, projectId, userId } = params
    
    // Verify user is authenticated
    if (!userId) {
      throw new Error('User not authenticated')
    }
    
    // Verify project exists and user has access
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single()
    
    if (projectError || !project) {
      console.error('Project lookup error:', projectError)
      console.error('Project ID:', projectId)
      throw new Error('Project not found')
    }
    
    // For now, we'll allow any authenticated user to upload to any project
    // In production, you might want to check if user belongs to project's company
    
    // Generate unique key for pool videos
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `videos/pool/${projectId}/${timestamp}-${sanitizedFileName}`
    
    // Create presigned PUT URL
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_OUTPUT_BUCKET,
      Key: key,
      ContentType: contentType,
      // ACL: 'public-read', // Commented out - rely on bucket policy instead
    })
    
    // Generate presigned URL (expires in 1 hour)
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
    
    // Construct public URL (using the correct S3 URL format)
    const publicUrl = `https://${process.env.AWS_S3_OUTPUT_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
    
    return {
      success: true,
      uploadData: {
        url: presignedUrl,
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          // 'x-amz-acl': 'public-read', // Commented out if not using ACLs
        },
        publicUrl,
        key,
      }
    }
  } catch (error) {
    console.error('Error generating pool upload URL:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Delete a video from S3 storage
 * @param {string} key - The S3 object key to delete
 * @returns {Promise<Object>} Result of deletion
 */
export async function deletePoolVideo(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_OUTPUT_BUCKET,
      Key: key,
    })
    
    await s3Client.send(command)
    
    return {
      success: true,
      message: 'Video deleted successfully'
    }
  } catch (error) {
    console.error('Error deleting pool video:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Create a video pool record in the database
 * @param {Object} params - Video pool parameters
 * @returns {Promise<Object>} Created pool record
 */
export async function createVideoPoolRecord(params) {
  try {
    const {
      projectId,
      fileName,
      videoUrl,
      fileSize,
      format,
      codec,
      duration,
      width,
      height,
      userId
    } = params
    
    const { data, error } = await supabaseAdmin
      .from('video_pool')
      .insert({
        project_id: projectId,
        original_filename: fileName,
        video_url: videoUrl,
        file_size: fileSize,
        format: format || 'mp4',
        codec: codec || 'h264',
        duration: duration || 0,
        width: width || 0,
        height: height || 0,
        status: 'ready',
        upload_progress: 100,
        uploaded_by: userId,
        uploaded_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return {
      success: true,
      data
    }
  } catch (error) {
    console.error('Error creating video pool record:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get unassigned videos from the pool for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} List of unassigned videos
 */
export async function getUnassignedPoolVideos(projectId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('video_pool')
      .select('*')
      .eq('project_id', projectId)
      .is('assigned_to_section_id', null)
      .eq('status', 'ready')
      .order('uploaded_at', { ascending: false })
    
    if (error) {
      throw error
    }
    
    return {
      success: true,
      data
    }
  } catch (error) {
    console.error('Error fetching pool videos:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Assign a pool video to a section
 * @param {string} videoId - Pool video ID
 * @param {string} sectionId - Section ID to assign to
 * @returns {Promise<Object>} Updated pool record
 */
export async function assignPoolVideoToSection(videoId, sectionId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('video_pool')
      .update({
        assigned_to_section_id: sectionId,
        assigned_at: new Date().toISOString()
      })
      .eq('id', videoId)
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return {
      success: true,
      data
    }
  } catch (error) {
    console.error('Error assigning pool video:', error)
    return {
      success: false,
      error: error.message
    }
  }
}