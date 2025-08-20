// lib/actions/video-pool-transcode-enhanced.js
'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

// Enhanced Configuration for better reliability
const MAX_CONCURRENT_JOBS = 3        // More jobs per batch (was 3)
const BATCH_SIZE = 20
const CHECK_INTERVAL = 30000         // 30 seconds between status checks
const MAX_CHECK_ATTEMPTS = 40        // 20 minutes max (40 * 30s)
const API_CALL_DELAY = 500           // Very short delay (was 1500ms)
const BATCH_DELAY = 5000             // Only 2 seconds between batches (was 2 minutes!)
const TARGET_RESOLUTION = 480
const STUCK_JOB_TIMEOUT = 900000     // 15 minutes - consider job stuck after this

/**
 * Enhanced delay function with jitter to avoid thundering herd
 */
async function rateLimitDelay(baseDelay = API_CALL_DELAY) {
  const jitter = Math.random() * 500 // Add 0-500ms random jitter
  await new Promise(resolve => setTimeout(resolve, baseDelay + jitter))
}

/**
 * Process videos in the pool that need transcoding with enhanced error handling
 */
export async function processPoolVideosForTranscoding(projectId = null) {
  try {
    console.log('🎬 Starting enhanced batch transcoding process...')
    
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
      started: [],
      total: videosToProcess.length
    }
    
    // Process in smaller chunks with longer delays
    for (let i = 0; i < videosToProcess.length; i += MAX_CONCURRENT_JOBS) {
      const batch = videosToProcess.slice(i, i + MAX_CONCURRENT_JOBS)
      const batchNumber = Math.floor(i / MAX_CONCURRENT_JOBS) + 1
      const totalBatches = Math.ceil(videosToProcess.length / MAX_CONCURRENT_JOBS)
      
      console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} videos)...`)
      
      // Start jobs with enhanced spacing
      const batchJobs = []
      for (const [index, video] of batch.entries()) {
        console.log(`  Starting job ${index + 1}/${batch.length} for: ${video.original_filename}`)
        
        const job = await startTranscodeJob(video)
        batchJobs.push(job)
        
        if (job.success && job.jobId) {
          results.started.push(job)
        } else {
          results.failed.push({
            poolVideoId: video.id,
            originalFilename: video.original_filename,
            success: false,
            error: job.error || 'Failed to start transcode job'
          })
        }
        
        // Enhanced delay between job starts
        if (index < batch.length - 1) {
          await rateLimitDelay()
        }
      }
      
      // Enhanced delay between batches (except for the last one)
      if (i + MAX_CONCURRENT_JOBS < videosToProcess.length) {
        console.log(`⏳ Waiting ${BATCH_DELAY/1000} seconds before next batch...`)
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
      }
    }
    
    console.log(`\n🎉 Transcoding batch initiated:`)
    console.log(`  Started: ${results.started.length}`)
    console.log(`  Failed to start: ${results.failed.length}`)
    console.log(`  Total: ${results.total}`)
    
    // Note: We don't wait for completion here - jobs will be monitored separately
    return {
      success: true,
      results: {
        successful: results.started, // Jobs that started successfully
        failed: results.failed,      // Jobs that failed to start
        total: results.total
      },
      message: `Started transcoding ${results.started.length} of ${results.total} videos. Jobs will process in the background.`
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
 * Enhanced status checking with stuck job detection and automatic recovery
 */
export async function checkProcessingVideos(projectId = null) {
  try {
    console.log('🔍 Enhanced processing videos check...')
    
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
    
    // Import AWS SDK with error handling
    let MediaConvertClient, GetJobCommand, DescribeEndpointsCommand
    try {
      const awsImport = await import('@aws-sdk/client-mediaconvert')
      MediaConvertClient = awsImport.MediaConvertClient
      GetJobCommand = awsImport.GetJobCommand
      DescribeEndpointsCommand = awsImport.DescribeEndpointsCommand
    } catch (importError) {
      console.error('❌ Failed to import AWS SDK:', importError)
      return { success: false, error: 'AWS SDK not available' }
    }
    
    // Get MediaConvert client with enhanced error handling
    const client = new MediaConvertClient({
      region: process.env.AWS_REGION || 'eu-west-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
    
    let endpoint
    try {
      const endpointCommand = new DescribeEndpointsCommand({})
      const endpointResponse = await client.send(endpointCommand)
      endpoint = endpointResponse.Endpoints[0].Url
    } catch (endpointError) {
      console.error('❌ Failed to get MediaConvert endpoint:', endpointError)
      return { success: false, error: 'Failed to connect to AWS MediaConvert' }
    }
    
    const mediaConvertClient = new MediaConvertClient({
      endpoint,
      region: process.env.AWS_REGION || 'eu-west-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
    
    let updatedCount = 0
    let stuckJobsCount = 0
    const now = new Date()
    
    // Check each video's job status with enhanced rate limiting and stuck job detection
    for (const [index, video] of processingVideos.entries()) {
      if (video.metadata?.jobId) {
        try {
          // Enhanced rate limiting - wait between each API call
          if (index > 0) {
            await rateLimitDelay()
          }
          
          // Check if job might be stuck (processing for more than 15 minutes)
          const startTime = new Date(video.metadata?.transcodeStartedAt || video.updated_at || video.created_at)
          const processingTime = now - startTime
          const isStuck = processingTime > STUCK_JOB_TIMEOUT
          
          if (isStuck) {
            console.log(`⚠️ Video ${video.id} has been processing for ${Math.round(processingTime/60000)} minutes - checking if stuck`)
          }
          
          const command = new GetJobCommand({ Id: video.metadata.jobId })
          const response = await mediaConvertClient.send(command)
          
          const jobStatus = response.Job.Status
          const progress = response.Job.JobPercentComplete || 0
          
          console.log(`Job ${video.metadata.jobId} (${video.original_filename}): ${jobStatus} (${progress}%)`)
          
          if (jobStatus === 'COMPLETE') {
            // Job completed successfully
            const transcodedUrl = constructTranscodedUrl(video)
            await updatePoolVideoAfterTranscode({
              poolVideoId: video.id,
              transcodedUrl: transcodedUrl,
              originalUrl: video.video_url,
              originalFilename: video.original_filename
            })
            console.log(`✅ Updated video ${video.id} with URL: ${transcodedUrl}`)
            updatedCount++
            
          } else if (jobStatus === 'ERROR' || jobStatus === 'CANCELED') {
            // Job failed
            const errorMessage = response.Job.ErrorMessage || 'Job failed'
            await supabaseAdmin
              .from('video_pool')
              .update({ 
                status: 'error',
                metadata: {
                  ...video.metadata,
                  transcodeError: errorMessage,
                  transcodeFailedAt: new Date().toISOString(),
                  finalJobStatus: jobStatus
                }
              })
              .eq('id', video.id)
            console.log(`❌ Marked video ${video.id} as error: ${errorMessage}`)
            
          } else if (isStuck && (jobStatus === 'SUBMITTED' || jobStatus === 'PROGRESSING')) {
            // Job might be stuck - but let's be conservative and just log it
            console.log(`🐌 Job ${video.metadata.jobId} has been ${jobStatus} for ${Math.round(processingTime/60000)} minutes`)
            stuckJobsCount++
            
            // Update metadata to track stuck status but don't mark as error yet
            await supabaseAdmin
              .from('video_pool')
              .update({
                metadata: {
                  ...video.metadata,
                  possiblyStuck: true,
                  stuckDetectedAt: new Date().toISOString(),
                  processingTimeMinutes: Math.round(processingTime/60000)
                }
              })
              .eq('id', video.id)
          }
          
        } catch (error) {
          if (error.name === 'TooManyRequestsException') {
            console.log('⚠️ Rate limit hit during status check, waiting longer...')
            await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
          } else {
            console.error(`Failed to check job ${video.metadata.jobId}:`, error.message)
          }
        }
      } else {
        // Video doesn't have a job ID - this shouldn't happen
        console.log(`⚠️ Video ${video.id} has no job ID, marking as error`)
        await supabaseAdmin
          .from('video_pool')
          .update({ 
            status: 'error',
            metadata: {
              ...video.metadata,
              transcodeError: 'No job ID found',
              transcodeFailedAt: new Date().toISOString()
            }
          })
          .eq('id', video.id)
      }
    }
    
    let message = `Checked ${processingVideos.length} videos, updated ${updatedCount}`
    if (stuckJobsCount > 0) {
      message += `, detected ${stuckJobsCount} potentially stuck jobs`
    }
    
    return { 
      success: true, 
      message,
      details: {
        checked: processingVideos.length,
        updated: updatedCount,
        possiblyStuck: stuckJobsCount
      }
    }
    
  } catch (error) {
    console.error('Error checking processing videos:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get enhanced pool transcoding status with additional metrics
 */
export async function getPoolTranscodingStatus(projectId) {
  try {
    console.log('🔍 Getting transcoding status for project:', projectId)
    
    const { data, error } = await supabaseAdmin
      .from('video_pool')
      .select('status, metadata, created_at')
      .eq('project_id', projectId)
    
    console.log('🔍 Database query result:', { data, error, dataLength: data?.length })
    
    if (error) {
      console.error('🔍 Database error:', error)
      throw error
    }
    
    const stats = {
      total: data.length,
      ready: 0,
      processing: 0,
      error: 0,
      needsTranscoding: 0,
      possiblyStuck: 0,
      recentlyCompleted: 0
    }
    
    const now = new Date()
    const recentThreshold = 5 * 60 * 1000 // 5 minutes
    
    data.forEach(video => {
      console.log('🔍 Processing video:', { id: video.id, status: video.status, metadata: video.metadata })
      
      if (stats[video.status] !== undefined) {
        stats[video.status]++
      } else {
        console.warn('🔍 Unknown video status:', video.status)
      }
      
      if (video.metadata?.needsTranscoding && video.status === 'ready') {
        stats.needsTranscoding++
      }
      
      if (video.metadata?.possiblyStuck && video.status === 'processing') {
        stats.possiblyStuck++
      }
      
      // Check for recently completed transcoding
      if (video.metadata?.transcodedAt) {
        const completedAt = new Date(video.metadata.transcodedAt)
        if (now - completedAt < recentThreshold) {
          stats.recentlyCompleted++
        }
      }
    })
    
    console.log('🔍 Final stats:', stats)
    
    return {
      success: true,
      stats
    }
    
  } catch (error) {
    console.error('🔍 Error in getPoolTranscodingStatus:', error)
    console.error('🔍 Error message:', error?.message)
    console.error('🔍 Error details:', { name: error?.name, stack: error?.stack })
    return {
      success: false,
      error: error?.message || 'Unknown error occurred'
    }
  }
}
/**
 * Construct the correct transcoded URL (unchanged from original)
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
 * Start a single transcode job with enhanced error handling
 */
async function startTranscodeJob(poolVideo) {
  try {
    console.log(`🎬 Starting transcode for: ${poolVideo.original_filename} to ${TARGET_RESOLUTION}p`)
    
    // Update status to processing with enhanced metadata
    const jobMetadata = {
      ...poolVideo.metadata,
      transcodeStartedAt: new Date().toISOString(),
      targetResolution: TARGET_RESOLUTION,
      transcodeAttempt: (poolVideo.metadata?.transcodeAttempt || 0) + 1
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
      return { success: false, error: updateError.message }
    }
    
    // Create the MediaConvert job
    const transcodeResult = await createPoolTranscodeJob({
      inputUrl: poolVideo.video_url,
      outputKey: poolVideo.original_filename.replace(/\.[^/.]+$/, ''),
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
      // Job creation failed - revert status
      await supabaseAdmin
        .from('video_pool')
        .update({ 
          status: 'error',
          metadata: {
            ...jobMetadata,
            transcodeError: transcodeResult.error,
            transcodeFailedAt: new Date().toISOString()
          }
        })
        .eq('id', poolVideo.id)
      
      return { success: false, error: transcodeResult.error }
    }
    
    // Save job ID and expected output URL
    await supabaseAdmin
      .from('video_pool')
      .update({ 
        metadata: {
          ...jobMetadata,
          jobId: transcodeResult.jobId,
          expectedOutputUrl: transcodeResult.outputUrl,
          transcodeJobCreatedAt: new Date().toISOString()
        }
      })
      .eq('id', poolVideo.id)
    
    console.log(`✅ MediaConvert job created: ${transcodeResult.jobId}`)
    
    return {
      success: true,
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
      success: false,
      poolVideoId: poolVideo.id,
      originalFilename: poolVideo.original_filename,
      error: error.message
    }
  }
}

/**
 * Create a MediaConvert job (unchanged from original but with enhanced error handling)
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
    
    // Import AWS SDK with error handling
    let MediaConvertClient, CreateJobCommand, DescribeEndpointsCommand
    try {
      const awsImport = await import('@aws-sdk/client-mediaconvert')
      MediaConvertClient = awsImport.MediaConvertClient
      CreateJobCommand = awsImport.CreateJobCommand
      DescribeEndpointsCommand = awsImport.DescribeEndpointsCommand
    } catch (importError) {
      return { success: false, error: 'AWS SDK not available' }
    }
    
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
    
    // Generate S3 output path
    const outputBucket = process.env.AWS_S3_OUTPUT_BUCKET || 'video-analysis-transcoded'
    const outputPrefix = `transcoded/pool/${projectId}/`
    const targetHeight = TARGET_RESOLUTION
    
    console.log(`🔹 Creating ${targetHeight}p transcode job for ${originalFilename}`)
    console.log(`   Output: s3://${outputBucket}/${outputPrefix}${outputKey}-${targetHeight}p.mp4`)
    
    // MediaConvert job settings (same as original but with conservative quality settings)
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
        enhancedTranscoding: 'true',
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
 * Update pool video record after successful transcoding (unchanged from original)
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
          resolution: `${TARGET_RESOLUTION}p`,
          enhancedTranscoding: true
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