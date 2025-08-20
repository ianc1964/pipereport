// lib/actions/video-pool-transcode.js
'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

// Configuration
const MAX_CONCURRENT_JOBS = 5 // Reduced from 10 to avoid rate limits
const BATCH_SIZE = 20
const CHECK_INTERVAL = 15000 // Increased from 10 seconds to 15
const MAX_CHECK_ATTEMPTS = 60
const API_CALL_DELAY = 500 // 500ms delay between API calls to respect rate limits

/**
 * Add delay to respect AWS rate limits
 */
async function rateLimitDelay() {
  await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY))
}

/**
 * Process videos in the pool that need transcoding
 * @param {string} projectId - Optional: Process only videos for a specific project
 * @returns {Promise<Object>} Processing results
 */
export async function processPoolVideosForTranscoding(projectId = null) {
  try {
    console.log('🎬 Starting batch transcoding process...')
    
    // Step 1: Find videos that need transcoding
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
    
    console.log(`📊 Found ${videosToProcess.length} videos to transcode`)
    
    // Step 2: Process videos in smaller batches to avoid rate limits
    const results = {
      successful: [],
      failed: [],
      total: videosToProcess.length
    }
    
    // Process in smaller chunks
    for (let i = 0; i < videosToProcess.length; i += MAX_CONCURRENT_JOBS) {
      const batch = videosToProcess.slice(i, i + MAX_CONCURRENT_JOBS)
      console.log(`\n🔄 Processing batch ${Math.floor(i / MAX_CONCURRENT_JOBS) + 1} (${batch.length} videos)...`)
      
      // Start jobs with delay between each to avoid rate limits
      const batchJobs = []
      for (const video of batch) {
        const job = await startTranscodeJob(video)
        batchJobs.push(job)
        await rateLimitDelay() // Add delay between job creations
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
 * Can be called separately to update stuck videos
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
    
    // Check each video's job status with rate limiting
    for (const video of processingVideos) {
      if (video.metadata?.jobId) {
        try {
          await rateLimitDelay() // Rate limit before each API call
          
          const command = new GetJobCommand({ Id: video.metadata.jobId })
          const response = await mediaConvertClient.send(command)
          
          console.log(`Job ${video.metadata.jobId}: ${response.Job.Status}`)
          
          if (response.Job.Status === 'COMPLETE') {
            // Update video as complete
            await updatePoolVideoAfterTranscode({
              poolVideoId: video.id,
              transcodedUrl: video.metadata.outputUrl || constructOutputUrl(video),
              originalUrl: video.video_url
            })
            console.log(`✅ Updated video ${video.id} as complete`)
          } else if (response.Job.Status === 'ERROR' || response.Job.Status === 'CANCELED') {
            // Mark as error
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
          // If PROGRESSING or SUBMITTED, leave as is
        } catch (error) {
          console.error(`Error checking job ${video.metadata.jobId}:`, error.message)
        }
      }
    }
    
    return { success: true, message: `Checked ${processingVideos.length} videos` }
    
  } catch (error) {
    console.error('Error checking processing videos:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Construct output URL for transcoded video
 */
function constructOutputUrl(video) {
  const outputBucket = process.env.AWS_S3_OUTPUT_BUCKET || 'video-analysis-transcoded'
  const s3Region = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'eu-west-2'
  
  // Extract filename from original URL
  const urlParts = video.video_url.split('/')
  const filename = urlParts[urlParts.length - 1].replace(/\.[^/.]+$/, '')
  
  return `https://${outputBucket}.s3.${s3Region}.amazonaws.com/transcoded/pool/${video.project_id}/pool/${video.project_id}/${filename}-720p.mp4`
}

/**
 * Start a single transcode job for a pool video
 */
async function startTranscodeJob(poolVideo) {
  try {
    console.log(`🎬 Starting transcode for: ${poolVideo.original_filename}`)
    
    // Update status to processing
    const { error: updateError } = await supabaseAdmin
      .from('video_pool')
      .update({ 
        status: 'processing',
        metadata: {
          ...poolVideo.metadata,
          transcodeStartedAt: new Date().toISOString()
        }
      })
      .eq('id', poolVideo.id)
    
    if (updateError) {
      console.error(`Failed to update status for ${poolVideo.id}:`, updateError)
    }
    
    // Extract filename from the video URL
    const urlParts = poolVideo.video_url.split('/')
    const s3Filename = urlParts[urlParts.length - 1]
    const fileNameWithoutExt = s3Filename.replace(/\.[^/.]+$/, '')
    
    // Create output key for transcoded video
    const outputKey = `pool/${poolVideo.project_id}/${fileNameWithoutExt}`
    
    // Determine target height
    const sourceHeight = poolVideo.height || poolVideo.metadata?.height || 720
    const targetHeight = sourceHeight > 720 ? 720 : sourceHeight
    
    // Create the MediaConvert job
    const transcodeResult = await createPoolTranscodeJob({
      inputUrl: poolVideo.video_url,
      outputKey,
      poolVideoId: poolVideo.id,
      projectId: poolVideo.project_id,
      userId: poolVideo.user_id,
      metadata: {
        originalFormat: poolVideo.format,
        originalSize: poolVideo.file_size,
        sourceHeight: sourceHeight,
        targetHeight: targetHeight,
        isPoolVideo: true
      }
    })
    
    if (!transcodeResult.success) {
      throw new Error(transcodeResult.error || 'Failed to create transcode job')
    }
    
    // Save job ID to metadata for later status checking
    await supabaseAdmin
      .from('video_pool')
      .update({ 
        metadata: {
          ...poolVideo.metadata,
          jobId: transcodeResult.jobId,
          outputUrl: transcodeResult.outputUrl
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
    
    // Mark as error in database
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
    
    // Create client with endpoint
    const mediaConvertClient = new MediaConvertClient({
      endpoint,
      region: process.env.AWS_REGION || 'eu-west-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
    
    // Generate S3 output path
    const outputBucket = process.env.AWS_S3_OUTPUT_BUCKET || 'video-analysis-transcoded'
    const outputPrefix = `transcoded/pool/${projectId}/`
    
    // Determine target height
    const targetHeight = metadata.targetHeight || 720
    
    // MediaConvert job settings (simplified for clarity)
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
                      MaxBitrate: targetHeight >= 720 ? 3000000 : 2000000,
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
                        Bitrate: 128000,
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
    
    // MediaConvert appends the NameModifier and extension
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
 * Monitor a batch of transcode jobs until completion
 * With proper rate limiting to avoid AWS throttling
 */
async function monitorBatchJobs(jobs) {
  const results = []
  const activeJobs = new Map()
  
  // Filter out failed jobs and add successful ones to monitoring
  jobs.forEach(job => {
    if (job.jobId) {
      activeJobs.set(job.jobId, job)
    } else {
      // Job creation failed
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
  console.log('⏱️ This may take several minutes. Jobs are processing in the background.')
  
  // Import AWS SDK for status checking
  const { MediaConvertClient, GetJobCommand, DescribeEndpointsCommand } = await import('@aws-sdk/client-mediaconvert')
  
  // Get MediaConvert endpoint for status checks
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
    // Wait before checking
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL))
    attempts++
    
    console.log(`\n🔄 Status check ${attempts}/${MAX_CHECK_ATTEMPTS} - ${activeJobs.size} jobs remaining`)
    
    // Check jobs one by one with rate limiting
    for (const job of activeJobs.values()) {
      try {
        await rateLimitDelay() // Rate limit before each API call
        
        const command = new GetJobCommand({ Id: job.jobId })
        const response = await mediaConvertClient.send(command)
        
        const jobStatus = response.Job.Status
        const progress = response.Job.JobPercentComplete || 0
        
        console.log(`  Job ${job.jobId}: ${jobStatus} (${progress}%)`)
        
        if (jobStatus === 'COMPLETE') {
          // Job completed successfully
          console.log(`✅ Job ${job.jobId} completed for ${job.originalFilename}`)
          
          await updatePoolVideoAfterTranscode({
            poolVideoId: job.poolVideoId,
            transcodedUrl: job.outputUrl,
            originalUrl: job.originalUrl
          })
          
          results.push({
            poolVideoId: job.poolVideoId,
            success: true,
            transcodedUrl: job.outputUrl
          })
          
          activeJobs.delete(job.jobId)
          
        } else if (jobStatus === 'ERROR' || jobStatus === 'CANCELED') {
          // Job failed
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
        // Jobs still processing will remain in activeJobs
        
      } catch (error) {
        if (error.name === 'TooManyRequestsException') {
          console.log('⚠️ Rate limit hit, waiting longer before next check...')
          await new Promise(resolve => setTimeout(resolve, 5000)) // Extra delay on rate limit
        } else {
          console.error(`Failed to check job ${job.jobId}:`, error.message)
        }
      }
    }
  }
  
  // Handle any jobs that timed out
  for (const job of activeJobs.values()) {
    console.log(`⏱️ Job ${job.jobId} still processing after ${MAX_CHECK_ATTEMPTS} checks`)
    console.log(`   Video will continue processing in background. Use 'Check Status' to update later.`)
    
    // Don't mark as error - job is likely still running
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
    const { poolVideoId, transcodedUrl, originalUrl } = params
    
    // Update the pool video record
    const { error: updateError } = await supabaseAdmin
      .from('video_pool')
      .update({
        video_url: transcodedUrl, // Use transcoded as primary
        status: 'ready', // Back to ready status
        metadata: {
          original_url: originalUrl,
          transcoded_url: transcodedUrl,
          transcodedAt: new Date().toISOString(),
          transcoded: true,
          needsTranscoding: false, // No longer needs transcoding
          format: 'mp4', // Now it's a standard MP4
          codec: 'h264' // Standard codec after transcoding
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
 * Check the status of pool transcoding for a project
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