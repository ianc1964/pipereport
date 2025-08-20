// lib/actions/video-pool-transcode-fixed.js
'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

// Configuration
const MAX_CONCURRENT_JOBS = 5
const BATCH_SIZE = 20
const CHECK_INTERVAL = 15000
const MAX_CHECK_ATTEMPTS = 60
const API_CALL_DELAY = 500
const TARGET_RESOLUTION = 480 // Changed from 720 to 480

/**
 * Add delay to respect AWS rate limits
 */
async function rateLimitDelay() {
  await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY))
}

/**
 * Process videos in the pool that need transcoding
 */
export async function processPoolVideosForTranscoding(projectId = null) {
  try {
    console.log('🎬 Starting batch transcoding process...')
    
    // Find videos that need transcoding
    let query = supabaseAdmin
      .from('video_pool')
      .select('*')
      .eq('status', 'ready')
      .eq('metadata->needsTranscoding', true)
      .is('assigned_to_section_id', null)
      .limit(BATCH_SIZE)
    
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    
    const { data: videosToProcess, error: queryError } = await query
    
    if (queryError) {
      console.error('❌ Error querying videos:', queryError)
      return { success: false, error: queryError.message }
    }
    
    if (!videosToProcess || videosToProcess.length === 0) {
      console.log('✅ No videos need transcoding')
      return { success: true, message: 'No videos to process', processed: 0 }
    }
    
    console.log(`📊 Found ${videosToProcess.length} videos to transcode to ${TARGET_RESOLUTION}p`)
    
    const results = {
      successful: [],
      failed: [],
      total: videosToProcess.length
    }
    
    // Process in smaller chunks
    for (let i = 0; i < videosToProcess.length; i += MAX_CONCURRENT_JOBS) {
      const batch = videosToProcess.slice(i, i + MAX_CONCURRENT_JOBS)
      console.log(`\n🔄 Processing batch ${Math.floor(i / MAX_CONCURRENT_JOBS) + 1} (${batch.length} videos)...`)
      
      // Start jobs with delay between each
      const batchJobs = []
      for (const video of batch) {
        const job = await startTranscodeJob(video)
        batchJobs.push(job)
        await rateLimitDelay()
      }
      
      // Monitor all jobs in this batch
      const batchResults = await monitorBatchJobs(batchJobs)
      
      // Collect results
      batchResults.forEach(result => {
        if (result.success) {
          results.successful.push(result)
        } else {
          results.failed.push(result)
        }
      })
    }
    
    console.log(`\n🎉 Transcoding complete. Success: ${results.successful.length}, Failed: ${results.failed.length}`)
    
    return {
      success: true,
      results,
      message: `Processed ${results.total} videos: ${results.successful.length} successful, ${results.failed.length} failed`
    }
    
  } catch (error) {
    console.error('💥 Batch transcoding error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Check status of videos currently processing
 */
export async function checkProcessingVideos(projectId = null) {
  try {
    console.log('🔍 Checking processing videos...')
    
    let query = supabaseAdmin
      .from('video_pool')
      .select('*')
      .eq('status', 'processing')
    
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    
    const { data: processingVideos, error } = await query
    
    if (error) throw error
    
    if (!processingVideos || processingVideos.length === 0) {
      return { success: true, message: 'No videos in processing state' }
    }
    
    console.log(`Found ${processingVideos.length} videos in processing state`)
    
    // Import AWS SDK
    const { MediaConvertClient, GetJobCommand, DescribeEndpointsCommand } = await import('@aws-sdk/client-mediaconvert')
    
    // Get MediaConvert client
    const client = new MediaConvertClient({
      region: process.env.AWS_REGION || 'eu-west-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
    
    const endpointCommand = new DescribeEndpointsCommand({})
    const endpointResponse = await client.send(endpointCommand)
    const endpoint = endpointResponse.Endpoints[0].Url
    
    const mediaConvertClient = new MediaConvertClient({
      endpoint,
      region: process.env.AWS_REGION || 'eu-west-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
    
    let updatedCount = 0
    
    // Check each video's job status with rate limiting
    for (const video of processingVideos) {
      if (video.metadata?.jobId) {
        try {
          await rateLimitDelay()
          
          const command = new GetJobCommand({ Id: video.metadata.jobId })
          const response = await mediaConvertClient.send(command)
          
          console.log(`Job ${video.metadata.jobId}: ${response.Job.Status}`)
          
          if (response.Job.Status === 'COMPLETE') {
            // Construct the correct transcoded URL
            const transcodedUrl = constructTranscodedUrl(video)
            await updatePoolVideoAfterTranscode({
              poolVideoId: video.id,
              transcodedUrl: transcodedUrl,
              originalUrl: video.video_url,
              originalFilename: video.original_filename
            })
            console.log(`✅ Updated video ${video.id} with URL: ${transcodedUrl}`)
            updatedCount++
          } else if (response.Job.Status === 'ERROR' || response.Job.Status === 'CANCELED') {
            await supabaseAdmin
              .from('video_pool')
              .update({ 
                status: 'error',
                metadata: {
                  ...video.metadata,
                  transcodeError: response.Job.ErrorMessage || 'Job failed',
                  transcodeFailedAt: new Date().toISOString()
                }
              })
              .eq('id', video.id)
            console.log(`❌ Marked video ${video.id} as error`)
          }
        } catch (error) {
          console.error(`Error checking job ${video.metadata.jobId}:`, error.message)
        }
      }
    }
    
    return { 
      success: true, 
      message: `Checked ${processingVideos.length} videos, updated ${updatedCount}` 
    }
    
  } catch (error) {
    console.error('Error checking processing videos:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Construct the correct transcoded URL
 */
function constructTranscodedUrl(video) {
  const outputBucket = process.env.AWS_S3_OUTPUT_BUCKET || 'video-analysis-transcoded'
  const s3Region = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'eu-west-2'
  
  // Extract the original filename from the video URL
  const urlParts = video.video_url.split('/')
  const originalFilename = urlParts[urlParts.length - 1]
  // Remove extension and add resolution suffix
  const baseFilename = originalFilename.replace(/\.[^/.]+$/, '')
  
  // Construct the correct path (without duplicated pool/project_id)
  const transcodedPath = `transcoded/pool/${video.project_id}/${baseFilename}-${TARGET_RESOLUTION}p.mp4`
  
  return `https://${outputBucket}.s3.${s3Region}.amazonaws.com/${transcodedPath}`
}

/**
 * Start a single transcode job for a pool video
 */
async function startTranscodeJob(poolVideo) {
  try {
    console.log(`🎬 Starting transcode for: ${poolVideo.original_filename} to ${TARGET_RESOLUTION}p`)
    
    // Update status to processing with job metadata
    const jobMetadata = {
      ...poolVideo.metadata,
      transcodeStartedAt: new Date().toISOString(),
      targetResolution: TARGET_RESOLUTION
    }
    
    const { error: updateError } = await supabaseAdmin
      .from('video_pool')
      .update({ 
        status: 'processing',
        metadata: jobMetadata
      })
      .eq('id', poolVideo.id)
    
    if (updateError) {
      console.error(`Failed to update status for ${poolVideo.id}:`, updateError)
    }
    
    // Extract filename from the video URL
    const urlParts = poolVideo.video_url.split('/')
    const s3Filename = urlParts[urlParts.length - 1]
    const fileNameWithoutExt = s3Filename.replace(/\.[^/.]+$/, '')
    
    // Create output key WITHOUT duplicating the path
    const outputKey = `${fileNameWithoutExt}`
    
    // Create the MediaConvert job
    const transcodeResult = await createPoolTranscodeJob({
      inputUrl: poolVideo.video_url,
      outputKey,
      poolVideoId: poolVideo.id,
      projectId: poolVideo.project_id,
      userId: poolVideo.user_id,
      originalFilename: poolVideo.original_filename,
      metadata: {
        originalFormat: poolVideo.format,
        originalSize: poolVideo.file_size,
        sourceHeight: poolVideo.height || 1080,
        targetHeight: TARGET_RESOLUTION,
        isPoolVideo: true
      }
    })
    
    if (!transcodeResult.success) {
      throw new Error(transcodeResult.error || 'Failed to create transcode job')
    }
    
    // Save job ID and expected output URL
    await supabaseAdmin
      .from('video_pool')
      .update({ 
        metadata: {
          ...jobMetadata,
          jobId: transcodeResult.jobId,
          expectedOutputUrl: transcodeResult.outputUrl
        }
      })
      .eq('id', poolVideo.id)
    
    console.log(`✅ MediaConvert job created: ${transcodeResult.jobId}`)
    
    return {
      poolVideoId: poolVideo.id,
      jobId: transcodeResult.jobId,
      outputUrl: transcodeResult.outputUrl,
      originalUrl: poolVideo.video_url,
      originalFilename: poolVideo.original_filename,
      status: 'started'
    }
    
  } catch (error) {
    console.error(`❌ Error starting transcode for video ${poolVideo.id}:`, error)
    
    await supabaseAdmin
      .from('video_pool')
      .update({ 
        status: 'error',
        metadata: {
          ...poolVideo.metadata,
          transcodeError: error.message,
          transcodeFailedAt: new Date().toISOString()
        }
      })
      .eq('id', poolVideo.id)
    
    return {
      poolVideoId: poolVideo.id,
      originalFilename: poolVideo.original_filename,
      success: false,
      error: error.message
    }
  }
}

/**
 * Create a MediaConvert job specifically for pool videos
 */
async function createPoolTranscodeJob(params) {
  try {
    const { 
      inputUrl,
      outputKey,
      poolVideoId,
      projectId,
      userId,
      originalFilename,
      metadata = {}
    } = params
    
    // Import AWS SDK
    const { 
      MediaConvertClient, 
      CreateJobCommand, 
      DescribeEndpointsCommand 
    } = await import('@aws-sdk/client-mediaconvert')
    
    // Get MediaConvert endpoint
    const client = new MediaConvertClient({
      region: process.env.AWS_REGION || 'eu-west-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
    
    const endpointCommand = new DescribeEndpointsCommand({})
    const endpointResponse = await client.send(endpointCommand)
    const endpoint = endpointResponse.Endpoints[0].Url
    
    const mediaConvertClient = new MediaConvertClient({
      endpoint,
      region: process.env.AWS_REGION || 'eu-west-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
    
    // Generate S3 output path - FIXED to avoid duplication
    const outputBucket = process.env.AWS_S3_OUTPUT_BUCKET || 'video-analysis-transcoded'
    const outputPrefix = `transcoded/pool/${projectId}/`
    
    // Use target resolution from config
    const targetHeight = TARGET_RESOLUTION
    
    console.log(`📹 Creating ${targetHeight}p transcode job for ${originalFilename}`)
    console.log(`   Output: s3://${outputBucket}/${outputPrefix}${outputKey}-${targetHeight}p.mp4`)
    
    // MediaConvert job settings
    const jobSettings = {
      Role: process.env.AWS_MEDIACONVERT_ROLE,
      Settings: {
        OutputGroups: [
          {
            Name: `${targetHeight}p MP4 Output`,
            OutputGroupSettings: {
              Type: 'FILE_GROUP_SETTINGS',
              FileGroupSettings: {
                Destination: `s3://${outputBucket}/${outputPrefix}`,
                DestinationSettings: {
                  S3Settings: {
                    AccessControl: {
                      CannedAcl: 'PUBLIC_READ'
                    }
                  }
                }
              }
            },
            Outputs: [
              {
                NameModifier: `-${targetHeight}p`,
                ContainerSettings: {
                  Container: 'MP4',
                  Mp4Settings: {
                    CslgAtom: 'INCLUDE',
                    FreeSpaceBox: 'EXCLUDE',
                    MoovPlacement: 'PROGRESSIVE_DOWNLOAD'
                  }
                },
                VideoDescription: {
                  Height: targetHeight,
                  ScalingBehavior: 'DEFAULT',
                  TimecodeInsertion: 'DISABLED',
                  AntiAlias: 'ENABLED',
                  Sharpness: 50,
                  CodecSettings: {
                    Codec: 'H_264',
                    H264Settings: {
                      InterlaceMode: 'PROGRESSIVE',
                      NumberReferenceFrames: 3,
                      Syntax: 'DEFAULT',
                      GopClosedCadence: 1,
                      GopSize: 60,
                      Slices: 1,
                      GopBReference: 'DISABLED',
                      RateControlMode: 'QVBR',
                      QualityTuneLevel: 'SINGLE_PASS_HQ',
                      MaxBitrate: 2000000, // 2Mbps for 480p
                      QvbrSettings: {
                        QvbrQualityLevel: 5
                      },
                      CodecProfile: 'MAIN',
                      CodecLevel: 'AUTO',
                      SceneChangeDetect: 'ENABLED',
                      FramerateControl: 'INITIALIZE_FROM_SOURCE',
                      FramerateConversionAlgorithm: 'DUPLICATE_DROP',
                      ParControl: 'INITIALIZE_FROM_SOURCE',
                      NumberBFramesBetweenReferenceFrames: 2,
                      DynamicSubGop: 'STATIC'
                    }
                  }
                },
                AudioDescriptions: [
                  {
                    AudioTypeControl: 'FOLLOW_INPUT',
                    CodecSettings: {
                      Codec: 'AAC',
                      AacSettings: {
                        AudioDescriptionBroadcasterMix: 'NORMAL',
                        Bitrate: 96000, // Reduced for 480p
                        RateControlMode: 'CBR',
                        CodecProfile: 'LC',
                        CodingMode: 'CODING_MODE_2_0',
                        RawFormat: 'NONE',
                        SampleRate: 48000,
                        Specification: 'MPEG4'
                      }
                    },
                    AudioSourceName: 'Audio Selector 1'
                  }
                ]
              }
            ]
          }
        ],
        Inputs: [
          {
            AudioSelectors: {
              'Audio Selector 1': {
                DefaultSelection: 'DEFAULT',
                ProgramSelection: 1
              }
            },
            VideoSelector: {
              ColorSpace: 'FOLLOW',
              Rotate: 'AUTO'
            },
            TimecodeSource: 'ZEROBASED',
            FileInput: inputUrl
          }
        ],
        AccelerationSettings: {
          Mode: 'PREFERRED'
        }
      },
      UserMetadata: {
        poolVideoId,
        projectId,
        userId,
        targetHeight: targetHeight.toString(),
        originalFilename,
        ...metadata
      },
      Queue: 'Default',
      StatusUpdateInterval: 'SECONDS_10',
      Priority: 0
    }
    
    // Create the job
    const command = new CreateJobCommand(jobSettings)
    const response = await mediaConvertClient.send(command)
    
    // Get the S3 bucket region
    const s3Region = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'eu-west-2'
    
    // Construct the full output URL
    const outputFilename = `${outputKey}-${targetHeight}p.mp4`
    const fullOutputUrl = `https://${outputBucket}.s3.${s3Region}.amazonaws.com/${outputPrefix}${outputFilename}`
    
    return {
      success: true,
      jobId: response.Job.Id,
      status: response.Job.Status,
      outputUrl: fullOutputUrl
    }
    
  } catch (error) {
    console.error('❌ Error creating pool transcode job:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Monitor batch jobs with rate limiting
 */
async function monitorBatchJobs(jobs) {
  const results = []
  const activeJobs = new Map()
  
  // Filter out failed jobs
  jobs.forEach(job => {
    if (job.jobId) {
      activeJobs.set(job.jobId, job)
    } else {
      results.push({
        poolVideoId: job.poolVideoId,
        success: false,
        error: job.error || 'Failed to create job'
      })
    }
  })
  
  if (activeJobs.size === 0) {
    return results
  }
  
  console.log(`\n📊 Monitoring ${activeJobs.size} transcode jobs...`)
  
  // Import AWS SDK
  const { MediaConvertClient, GetJobCommand, DescribeEndpointsCommand } = await import('@aws-sdk/client-mediaconvert')
  
  const client = new MediaConvertClient({
    region: process.env.AWS_REGION || 'eu-west-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  })
  
  const endpointCommand = new DescribeEndpointsCommand({})
  const endpointResponse = await client.send(endpointCommand)
  const endpoint = endpointResponse.Endpoints[0].Url
  
  const mediaConvertClient = new MediaConvertClient({
    endpoint,
    region: process.env.AWS_REGION || 'eu-west-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  })
  
  let attempts = 0
  
  while (activeJobs.size > 0 && attempts < MAX_CHECK_ATTEMPTS) {
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL))
    attempts++
    
    console.log(`\n🔄 Status check ${attempts}/${MAX_CHECK_ATTEMPTS} - ${activeJobs.size} jobs remaining`)
    
    for (const job of activeJobs.values()) {
      try {
        await rateLimitDelay()
        
        const command = new GetJobCommand({ Id: job.jobId })
        const response = await mediaConvertClient.send(command)
        
        const jobStatus = response.Job.Status
        const progress = response.Job.JobPercentComplete || 0
        
        console.log(`  Job ${job.jobId}: ${jobStatus} (${progress}%)`)
        
        if (jobStatus === 'COMPLETE') {
          console.log(`✅ Job ${job.jobId} completed for ${job.originalFilename}`)
          
          // Use the correct transcoded URL
          const transcodedUrl = constructTranscodedUrl({
            video_url: job.originalUrl,
            project_id: response.Job.UserMetadata.projectId
          })
          
          await updatePoolVideoAfterTranscode({
            poolVideoId: job.poolVideoId,
            transcodedUrl: transcodedUrl,
            originalUrl: job.originalUrl,
            originalFilename: job.originalFilename
          })
          
          results.push({
            poolVideoId: job.poolVideoId,
            success: true,
            transcodedUrl: transcodedUrl
          })
          
          activeJobs.delete(job.jobId)
          
        } else if (jobStatus === 'ERROR' || jobStatus === 'CANCELED') {
          console.error(`❌ Job ${job.jobId} failed: ${response.Job.ErrorMessage}`)
          
          await supabaseAdmin
            .from('video_pool')
            .update({ 
              status: 'error',
              metadata: {
                transcodeError: response.Job.ErrorMessage || 'Job failed',
                transcodeFailedAt: new Date().toISOString()
              }
            })
            .eq('id', job.poolVideoId)
          
          results.push({
            poolVideoId: job.poolVideoId,
            success: false,
            error: response.Job.ErrorMessage
          })
          
          activeJobs.delete(job.jobId)
        }
        
      } catch (error) {
        if (error.name === 'TooManyRequestsException') {
          console.log('⚠️ Rate limit hit, waiting longer...')
          await new Promise(resolve => setTimeout(resolve, 5000))
        } else {
          console.error(`Failed to check job ${job.jobId}:`, error.message)
        }
      }
    }
  }
  
  // Handle timeouts
  for (const job of activeJobs.values()) {
    console.log(`⏱️ Job ${job.jobId} still processing after ${MAX_CHECK_ATTEMPTS} checks`)
    results.push({
      poolVideoId: job.poolVideoId,
      success: false,
      error: 'Job still processing - check status later'
    })
  }
  
  return results
}

/**
 * Update pool video record after successful transcoding
 */
async function updatePoolVideoAfterTranscode(params) {
  try {
    const { poolVideoId, transcodedUrl, originalUrl, originalFilename } = params
    
    // Update the filename to .mp4
    const newFilename = originalFilename.replace(/\.[^/.]+$/, '.mp4')
    
    console.log(`📝 Updating pool video ${poolVideoId}`)
    console.log(`   New URL: ${transcodedUrl}`)
    console.log(`   New filename: ${newFilename}`)
    
    // Update the pool video record
    const { error: updateError } = await supabaseAdmin
      .from('video_pool')
      .update({
        video_url: transcodedUrl,
        original_filename: newFilename, // Update to .mp4 extension
        status: 'ready',
        format: 'mp4',
        codec: 'h264',
        width: 854,  // 480p width
        height: TARGET_RESOLUTION,
        metadata: {
          original_url: originalUrl,
          original_filename: originalFilename,
          transcoded_url: transcodedUrl,
          transcodedAt: new Date().toISOString(),
          transcoded: true,
          needsTranscoding: false,
          resolution: `${TARGET_RESOLUTION}p`
        }
      })
      .eq('id', poolVideoId)
    
    if (updateError) {
      throw updateError
    }
    
    console.log(`✅ Pool video ${poolVideoId} updated successfully`)
    
  } catch (error) {
    console.error('❌ Error updating pool video after transcode:', error)
    throw error
  }
}

/**
 * Get pool transcoding status
 */
export async function getPoolTranscodingStatus(projectId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('video_pool')
      .select('status, metadata')
      .eq('project_id', projectId)
    
    if (error) throw error
    
    const stats = {
      total: data.length,
      ready: 0,
      processing: 0,
      error: 0,
      needsTranscoding: 0
    }
    
    data.forEach(video => {
      stats[video.status]++
      if (video.metadata?.needsTranscoding && video.status === 'ready') {
        stats.needsTranscoding++
      }
    })
    
    return {
      success: true,
      stats
    }
    
  } catch (error) {
    console.error('Error getting transcoding status:', error)
    return {
      success: false,
      error: error.message
    }
  }
}