// lib/video/mediaconvert-service.js
'use server'

import { MediaConvertClient, CreateJobCommand, GetJobCommand, DescribeEndpointsCommand } from '@aws-sdk/client-mediaconvert'
import { supabaseAdmin } from '@/lib/supabase-server'

// Cache the MediaConvert endpoint
let cachedEndpoint = null

/**
 * Get MediaConvert endpoint for the region
 * MediaConvert requires account-specific endpoints
 */
async function getMediaConvertEndpoint() {
  if (cachedEndpoint) return cachedEndpoint
  
  const client = new MediaConvertClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  })
  
  try {
    const command = new DescribeEndpointsCommand({})
    const response = await client.send(command)
    cachedEndpoint = response.Endpoints[0].Url
    return cachedEndpoint
  } catch (error) {
    console.error('Error getting MediaConvert endpoint:', error)
    throw new Error('Failed to get MediaConvert endpoint')
  }
}

/**
 * Create MediaConvert client with account-specific endpoint
 */
async function getMediaConvertClient() {
  const endpoint = await getMediaConvertEndpoint()
  
  return new MediaConvertClient({
    endpoint,
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  })
}

/**
 * Create a MediaConvert job to transcode video
 * Optimized for faster encoding while maintaining good quality
 * @param {Object} params - Job parameters
 * @returns {Promise<Object>} Job creation result
 */
export async function createTranscodeJob(params) {
  try {
    const { 
      inputUrl,
      outputKey,
      sectionId,
      userId,
      metadata = {}
    } = params
    
    // Verify user has access to section
    const { data: section, error: sectionError } = await supabaseAdmin
      .from('sections')
      .select('id, project_id, projects(user_id)')
      .eq('id', sectionId)
      .single()
    
    if (sectionError || !section) {
      throw new Error('Section not found')
    }
    
    const client = await getMediaConvertClient()
    
    // Generate S3 output path
    const outputBucket = process.env.AWS_S3_OUTPUT_BUCKET || 'video-analysis-transcoded'
    const outputPrefix = `transcoded/${sectionId}/`
    
    // Determine target height (max 720p, but keep smaller resolutions)
    const targetHeight = metadata.sourceHeight > 720 ? 720 : metadata.sourceHeight || 720
    
    // MediaConvert job settings optimized for speed
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
                      GopSize: 60, // Reduced from 90 for faster encoding
                      Slices: 1,
                      GopBReference: 'DISABLED',
                      SlowPal: 'DISABLED',
                      SpatialAdaptiveQuantization: 'ENABLED',
                      TemporalAdaptiveQuantization: 'ENABLED',
                      FlickerAdaptiveQuantization: 'DISABLED',
                      EntropyEncoding: 'CABAC',
                      FramerateControl: 'INITIALIZE_FROM_SOURCE',
                      RateControlMode: 'QVBR',
                      QualityTuneLevel: 'SINGLE_PASS_HQ', // Better quality than SINGLE_PASS
                      MaxBitrate: targetHeight >= 720 ? 3000000 : 2000000, // 3Mbps for 720p, 2Mbps for lower
                      QvbrSettings: {
                        QvbrQualityLevel: 5 // Reduced from 7 for faster encoding
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
                      // Additional speed optimizations
                      MinIInterval: 0,
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
                        Bitrate: 128000, // Increased from 96000 for better quality
                        RateControlMode: 'CBR',
                        CodecProfile: 'LC',
                        CodingMode: 'CODING_MODE_2_0',
                        RawFormat: 'NONE',
                        SampleRate: 48000,
                        Specification: 'MPEG4'
                      }
                    },
                    // Skip audio re-encoding if possible
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
                // This will pass through AAC audio without re-encoding when possible
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
        // Speed optimization settings
        AccelerationSettings: {
          Mode: 'PREFERRED' // Use accelerated transcoding when available
        }
      },
      UserMetadata: {
        sectionId,
        userId,
        targetHeight: targetHeight.toString(),
        ...metadata
      },
      Queue: 'Default',
      StatusUpdateInterval: 'SECONDS_10',
      Priority: 0 // Normal priority
    }
    
    // Create the job
    const command = new CreateJobCommand(jobSettings)
    const response = await client.send(command)
    
    // Get the S3 bucket region from environment or detect from bucket
    const s3Region = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'eu-west-2'
    
    // MediaConvert appends the NameModifier and extension to the base filename
    const outputFilename = `${outputKey}-${targetHeight}p.mp4`
    
    console.log('MediaConvert Job Created:', {
      jobId: response.Job.Id,
      targetHeight,
      outputFilename
    })
    
    return {
      success: true,
      jobId: response.Job.Id,
      status: response.Job.Status,
      outputUrl: `https://${outputBucket}.s3.${s3Region}.amazonaws.com/${outputPrefix}${outputFilename}`
    }
  } catch (error) {
    console.error('Error creating transcode job:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Check MediaConvert job status
 * @param {string} jobId - MediaConvert job ID
 * @returns {Promise<Object>} Job status
 */
export async function checkTranscodeStatus(jobId) {
  try {
    const client = await getMediaConvertClient()
    
    const command = new GetJobCommand({ Id: jobId })
    const response = await client.send(command)
    
    const job = response.Job
    const isComplete = job.Status === 'COMPLETE'
    const hasFailed = job.Status === 'ERROR'
    
    // Calculate progress percentage
    let progress = 0
    if (job.JobPercentComplete) {
      progress = job.JobPercentComplete
    } else if (isComplete) {
      progress = 100
    }
    
    return {
      success: true,
      status: job.Status,
      ready: isComplete,
      failed: hasFailed,
      progress,
      errorMessage: job.ErrorMessage,
      outputUrl: isComplete ? job.UserMetadata?.outputUrl : null
    }
  } catch (error) {
    console.error('Error checking transcode status:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Update section with transcoded video URL
 * @param {Object} params - Update parameters
 * @returns {Promise<Object>} Update result
 */
export async function updateSectionWithTranscodedVideo(params) {
  try {
    const { sectionId, transcodedUrl, originalUrl, userId } = params
    
    // Update section to include both URLs
    const { error: updateError } = await supabaseAdmin
      .from('sections')
      .update({
        video_url: transcodedUrl, // Use transcoded as primary
        video_metadata: {
          original_url: originalUrl,
          transcoded_url: transcodedUrl,
          transcoded_at: new Date().toISOString(),
          format: '720p_mp4_optimized',
          storage_provider: 'aws-s3'
        }
      })
      .eq('id', sectionId)
    
    if (updateError) {
      throw updateError
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error updating section with transcoded video:', error)
    return {
      success: false,
      error: error.message
    }
  }
}