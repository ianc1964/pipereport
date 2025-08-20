// lib/actions/video-pool-transcode-debug.js
'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

// Configuration
const MAX_CONCURRENT_JOBS = 10
const BATCH_SIZE = 20
const CHECK_INTERVAL = 10000
const MAX_CHECK_ATTEMPTS = 60

/**
 * Process videos in the pool that need transcoding
 * Enhanced with detailed logging for debugging
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
    videosToProcess.forEach(v => {
      console.log(`  - ${v.original_filename} (${v.format}) - ${v.width}x${v.height}`)
    })
    
    // Step 2: Process videos in batches
    const results = {
      successful: [],
      failed: [],
      total: videosToProcess.length
    }
    
    // Process in chunks to respect concurrent job limits
    for (let i = 0; i < videosToProcess.length; i += MAX_CONCURRENT_JOBS) {
      const batch = videosToProcess.slice(i, i + MAX_CONCURRENT_JOBS)
      console.log(`\n🔄 Processing batch ${Math.floor(i / MAX_CONCURRENT_JOBS) + 1} (${batch.length} videos)...`)
      
      // Start all jobs in parallel for this batch
      const batchJobs = await Promise.all(
        batch.map(video => startTranscodeJob(video))
      )
      
      // Log job creation results
      batchJobs.forEach(job => {
        if (job.jobId) {
          console.log(`✅ Job created: ${job.jobId} for ${job.originalFilename}`)
        } else {
          console.log(`❌ Failed to create job for video ${job.poolVideoId}: ${job.error}`)
        }
      })
      
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
 * Start a single transcode job for a pool video
 * @param {Object} poolVideo - Video record from video_pool table
 * @returns {Promise<Object>} Job information
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
    
    console.log(`  Source: ${poolVideo.video_url}`)
    console.log(`  Output: ${outputKey}`)
    console.log(`  Resolution: ${sourceHeight}p → ${targetHeight}p`)
    
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
    
    console.log('📹 Creating MediaConvert job with params:', {
      inputUrl,
      outputKey,
      poolVideoId,
      targetHeight: metadata.targetHeight
    })
    
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
    
    console.log('🔍 Getting MediaConvert endpoint...')
    const endpointCommand = new DescribeEndpointsCommand({})
    const endpointResponse = await client.send(endpointCommand)
    const endpoint = endpointResponse.Endpoints[0].Url
    console.log('✅ Got endpoint:', endpoint)
    
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
    
    console.log(`📦 Output will be: s3://${outputBucket}/${outputPrefix}${outputKey}-${targetHeight}p.mp4`)
    
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
                      Softness: 0,
                      GopClosedCadence: 1,
                      GopSize: 60,
                      Slices: 1,
                      GopBReference: 'DISABLED',
                      SlowPal: 'DISABLED',
                      SpatialAdaptiveQuantization: 'ENABLED',
                      TemporalAdaptiveQuantization: 'ENABLED',
                      FlickerAdaptiveQuantization: 'DISABLED',
                      EntropyEncoding: 'CABAC',
                      FramerateControl: 'INITIALIZE_FROM_SOURCE',
                      RateControlMode: 'QVBR',
                      QualityTuneLevel: 'SINGLE_PASS_HQ',
                      MaxBitrate: targetHeight >= 720 ? 3000000 : 2000000,
                      QvbrSettings: {
                        QvbrQualityLevel: 5
                      },
                      CodecProfile: 'MAIN',
                      Telecine: 'NONE',
                      MinIInterval: 0,
                      AdaptiveQuantization: 'HIGH',
                      CodecLevel: 'AUTO',
                      FieldEncoding: 'PAFF',
                      SceneChangeDetect: 'ENABLED',
                      FramerateConversionAlgorithm: 'DUPLICATE_DROP',
                      UnregisteredSeiTimecode: 'DISABLED',
                      GopSizeUnits: 'FRAMES',
                      ParControl: 'INITIALIZE_FROM_SOURCE',
                      NumberBFramesBetweenReferenceFrames: 2,
                      RepeatPps: 'DISABLED',
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
    console.log('🚀 Submitting job to MediaConvert...')
    const command = new CreateJobCommand(jobSettings)
    const response = await mediaConvertClient.send(command)
    
    // Get the S3 bucket region
    const s3Region = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'eu-west-2'
    
    // MediaConvert appends the NameModifier and extension
    const outputFilename = `${outputKey}-${targetHeight}p.mp4`
    const fullOutputUrl = `https://${outputBucket}.s3.${s3Region}.amazonaws.com/${outputPrefix}${outputFilename}`
    
    console.log('✅ MediaConvert Job Created:', {
      jobId: response.Job.Id,
      status: response.Job.Status,
      outputUrl: fullOutputUrl
    })
    
    return {
      success: true,
      jobId: response.Job.Id,
      status: response.Job.Status,
      outputUrl: fullOutputUrl
    }
    
  } catch (error) {
    console.error('❌ Error creating pool transcode job:', error)
    console.error('Error details:', error.message)
    if (error.$metadata) {
      console.error('AWS Error metadata:', error.$metadata)
    }
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Monitor a batch of transcode jobs until completion
 * @param {Array} jobs - Array of job objects with jobId and poolVideoId
 * @returns {Promise<Array>} Results for each job
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
  
  console.log(`\n📊 Monitoring ${activeJobs.size} transcode jobs...`)
  let attempts = 0
  
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
  
  while (activeJobs.size > 0 && attempts < MAX_CHECK_ATTEMPTS) {
    // Wait before checking
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL))
    attempts++
    
    console.log(`\n🔄 Status check ${attempts}/${MAX_CHECK_ATTEMPTS} - ${activeJobs.size} jobs remaining`)
    
    // Check all active jobs in parallel
    const statusChecks = await Promise.all(
      Array.from(activeJobs.values()).map(async (job) => {
        try {
          const command = new GetJobCommand({ Id: job.jobId })
          const response = await mediaConvertClient.send(command)
          
          return { 
            ...job, 
            status: response.Job.Status,
            progress: response.Job.JobPercentComplete || 0,
            errorMessage: response.Job.ErrorMessage
          }
        } catch (error) {
          console.error(`Failed to check status for job ${job.jobId}:`, error.message)
          return {
            ...job,
            status: 'ERROR',
            errorMessage: error.message
          }
        }
      })
    )
    
    // Process status updates
    for (const jobStatus of statusChecks) {
      console.log(`  Job ${jobStatus.jobId}: ${jobStatus.status} (${jobStatus.progress}%)`)
      
      if (jobStatus.status === 'COMPLETE') {
        // Job completed successfully
        console.log(`✅ Job ${jobStatus.jobId} completed for ${jobStatus.originalFilename}`)
        
        await updatePoolVideoAfterTranscode({
          poolVideoId: jobStatus.poolVideoId,
          transcodedUrl: jobStatus.outputUrl,
          originalUrl: jobStatus.originalUrl
        })
        
        results.push({
          poolVideoId: jobStatus.poolVideoId,
          success: true,
          transcodedUrl: jobStatus.outputUrl
        })
        
        activeJobs.delete(jobStatus.jobId)
        
      } else if (jobStatus.status === 'ERROR' || jobStatus.status === 'CANCELED') {
        // Job failed
        console.error(`❌ Job ${jobStatus.jobId} failed for ${jobStatus.originalFilename}: ${jobStatus.errorMessage}`)
        
        await supabaseAdmin
          .from('video_pool')
          .update({ 
            status: 'error',
            metadata: {
              transcodeError: jobStatus.errorMessage,
              transcodeFailedAt: new Date().toISOString()
            }
          })
          .eq('id', jobStatus.poolVideoId)
        
        results.push({
          poolVideoId: jobStatus.poolVideoId,
          success: false,
          error: jobStatus.errorMessage
        })
        
        activeJobs.delete(jobStatus.jobId)
      }
      // Jobs still processing will remain in activeJobs
    }
  }
  
  // Handle any jobs that timed out
  for (const job of activeJobs.values()) {
    console.error(`⏱️ Job ${job.jobId} timed out`)
    
    await supabaseAdmin
      .from('video_pool')
      .update({ 
        status: 'error',
        metadata: {
          transcodeError: 'Transcoding timeout',
          transcodeFailedAt: new Date().toISOString()
        }
      })
      .eq('id', job.poolVideoId)
    
    results.push({
      poolVideoId: job.poolVideoId,
      success: false,
      error: 'Transcoding timeout'
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
    
    console.log(`📝 Updating pool video ${poolVideoId} with transcoded URL`)
    
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
    
    console.log('📊 Pool transcoding status:', stats)
    
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