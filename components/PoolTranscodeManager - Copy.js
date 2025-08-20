// components/PoolTranscodeManager.js
'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Film, Loader2, CheckCircle, XCircle, Play, RefreshCw, Clock, AlertCircle } from 'lucide-react'

// Import the transcoding functions from the enhanced service
async function loadTranscodingFunctions() {
  console.log('🔍 Attempting to load transcoding functions...')
  try {
    console.log('🔍 Importing from video-pool-transcode-enhanced...')
    const service = await import('@/lib/actions/video-pool-transcode-enhanced')
    console.log('✅ Import successful:', service)
    console.log('✅ Available functions:', Object.keys(service))
    return service
  } catch (err) {
    console.error('❌ Enhanced transcoding service failed to load:', err)
    console.error('❌ Error details:', err.message, err.stack)
    return null
  }
}

export default function PoolTranscodeManager({ projectId, onTranscodeComplete }) {
  const [status, setStatus] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [autoPolling, setAutoPolling] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState(null)
  const [transcodeService, setTranscodeService] = useState(null)
  
  // Refs for cleanup
  const pollingIntervalRef = useRef(null)
  
  console.log('🔍 Current transcodeService state:', transcodeService)

  // Load transcoding service on mount
  useEffect(() => {
    console.log('🔍 useEffect: Loading transcoding service...')
    loadTranscodingFunctions().then(service => {
      console.log('🔍 loadTranscodingFunctions resolved with:', service)
      console.log('🔍 service truthy?', !!service)
      
      if (service) {
        console.log('✅ Setting transcodeService state')
        setTranscodeService(service)
      } else {
        console.log('❌ Service is null/undefined')
      }
    }).catch(err => {
      console.error('❌ Failed to load transcoding service:', err)
    })
  }, [])

  // Load transcoding status on mount and when projectId changes
  useEffect(() => {
    if (projectId && transcodeService) {
      loadStatus()
    }
  }, [projectId, transcodeService])

  // Auto-polling effect
  useEffect(() => {
    if (autoPolling && status?.processing > 0 && transcodeService) {
      startAutoPolling()
    } else {
      stopAutoPolling()
    }
    
    return () => stopAutoPolling()
  }, [autoPolling, status?.processing, transcodeService])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      componentMountedRef.current = false
      stopAutoPolling()
    }
  }, [])

  const startAutoPolling = () => {
    stopAutoPolling() // Clear any existing interval
    
    console.log('🔄 Starting auto-polling for transcoding status')
    pollingIntervalRef.current = setInterval(async () => {
      if (componentMountedRef.current && status?.processing > 0) {
        console.log('📡 Auto-polling transcoding status...')
        await checkStatus(false) // Silent check (no loading states)
      } else {
        stopAutoPolling()
      }
    }, 30000) // Poll every 30 seconds
  }

  const stopAutoPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      console.log('⏹️ Stopped auto-polling')
    }
  }

  const loadStatus = async () => {
    if (!transcodeService?.getPoolTranscodingStatus) return
    
    try {
      const result = await transcodeService.getPoolTranscodingStatus(projectId)
      if (result.success && componentMountedRef.current) {
        setStatus(result.stats)
        setLastUpdateTime(new Date())
        
        // Start auto-polling if videos are processing
        if (result.stats.processing > 0) {
          setAutoPolling(true)
        } else {
          setAutoPolling(false)
        }
      }
    } catch (err) {
      console.error('Error loading transcode status:', err)
    }
  }

  const handleStartTranscoding = async () => {
    if (!transcodeService?.processPoolVideosForTranscoding) {
      setError('Transcoding service not available')
      return
    }

    setProcessing(true)
    setError(null)
    setResults(null)

    try {
      const result = await transcodeService.processPoolVideosForTranscoding(projectId)
      
      if (result.success && componentMountedRef.current) {
        setResults(result.results)
        
        // Show success message with details
        const startedCount = result.results?.successful?.length || 0
        const failedCount = result.results?.failed?.length || 0
        
        if (startedCount > 0) {
          setResults({
            ...result.results,
            message: `Started transcoding ${startedCount} video${startedCount !== 1 ? 's' : ''}. Jobs will process in the background.`
          })
          
          // Start auto-polling immediately
          setAutoPolling(true)
        }
        
        if (failedCount > 0) {
          setError(`${failedCount} video${failedCount !== 1 ? 's' : ''} failed to start transcoding`)
        }
        
        // Reload status after processing
        await loadStatus()
        // Notify parent component if needed
        onTranscodeComplete?.(result)
      } else {
        setError(result.error || 'Transcoding failed to start')
      }
    } catch (err) {
      console.error('Transcoding error:', err)
      setError(err.message || 'An error occurred starting transcoding')
    } finally {
      if (componentMountedRef.current) {
        setProcessing(false)
      }
    }
  }

  const checkStatus = async (showLoading = true) => {
    if (!transcodeService?.checkProcessingVideos) return

    if (showLoading) {
      setCheckingStatus(true)
    }
    setError(null)

    try {
      const result = await transcodeService.checkProcessingVideos(projectId)
      
      if (result.success && componentMountedRef.current) {
        // Reload status after checking
        await loadStatus()
        
        // Show results if any videos were updated
        if (result.details?.updated > 0) {
          setResults({
            message: `Updated ${result.details.updated} video${result.details.updated !== 1 ? 's' : ''}`,
            successful: Array(result.details.updated).fill({ success: true }),
            failed: []
          })
          
          // Notify parent component
          onTranscodeComplete?.()
        }
        
        // Show warning if stuck jobs detected
        if (result.details?.possiblyStuck > 0) {
          console.warn(`⚠️ ${result.details.possiblyStuck} videos may be stuck in processing`)
        }
        
      } else {
        setError(result.error || 'Status check failed')
      }
    } catch (err) {
      console.error('Status check error:', err)
      setError(err.message || 'An error occurred checking status')
    } finally {
      if (showLoading && componentMountedRef.current) {
        setCheckingStatus(false)
      }
    }
  }

  const handleManualStatusCheck = () => {
    checkStatus(true) // Manual check with loading states
  }

  // Don't show anything if transcoding service isn't loaded
  if (!transcodeService) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          <span className="text-sm text-gray-600">Loading transcoding service...</span>
        </div>
      </div>
    )
  }

  // Don't show anything if no videos need transcoding and none are processing
  if (!status || (status.needsTranscoding === 0 && status.processing === 0)) {
    return null
  }

  const formatTime = (date) => {
    return date ? new Intl.DateTimeFormat('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    }).format(date) : ''
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
      {/* Status Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-900">
              Video Processing {status.processing > 0 ? 'In Progress' : 'Required'}
              {autoPolling && status.processing > 0 && (
                <span className="ml-2 inline-flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="ml-1 text-xs text-green-600">Auto-monitoring</span>
                </span>
              )}
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              {status.needsTranscoding > 0 && (
                <span>{status.needsTranscoding} video{status.needsTranscoding !== 1 ? 's' : ''} need{status.needsTranscoding === 1 ? 's' : ''} to be converted for web playback</span>
              )}
              {status.needsTranscoding > 0 && status.processing > 0 && ' • '}
              {status.processing > 0 && (
                <span className="text-blue-700">{status.processing} video{status.processing !== 1 ? 's are' : ' is'} currently processing</span>
              )}
            </p>
            {lastUpdateTime && (
              <p className="text-xs text-gray-500 mt-1">
                <Clock className="inline w-3 h-3 mr-1" />
                Last updated: {formatTime(lastUpdateTime)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Status Details */}
      <div className="grid grid-cols-4 gap-3 text-sm">
        <div className="bg-white rounded px-3 py-2">
          <div className="text-gray-500">Total</div>
          <div className="font-semibold">{status.total}</div>
        </div>
        <div className="bg-white rounded px-3 py-2">
          <div className="text-gray-500">Ready</div>
          <div className="font-semibold text-green-600">{status.ready - status.needsTranscoding}</div>
        </div>
        {status.processing > 0 && (
          <div className="bg-white rounded px-3 py-2">
            <div className="text-gray-500">Processing</div>
            <div className="font-semibold text-blue-600">
              {status.processing}
              {status.possiblyStuck > 0 && (
                <span className="ml-1 text-orange-500 text-xs">
                  ({status.possiblyStuck} stuck?)
                </span>
              )}
            </div>
          </div>
        )}
        {status.needsTranscoding > 0 && (
          <div className="bg-white rounded px-3 py-2">
            <div className="text-gray-500">Need Conversion</div>
            <div className="font-semibold text-amber-600">{status.needsTranscoding}</div>
          </div>
        )}
        {status.error > 0 && (
          <div className="bg-white rounded px-3 py-2">
            <div className="text-gray-500">Errors</div>
            <div className="font-semibold text-red-600">{status.error}</div>
          </div>
        )}
        {status.recentlyCompleted > 0 && (
          <div className="bg-white rounded px-3 py-2">
            <div className="text-gray-500">Recently Done</div>
            <div className="font-semibold text-green-600">{status.recentlyCompleted}</div>
          </div>
        )}
      </div>

      {/* Processing Results */}
      {results && (
        <div className="bg-white rounded-lg p-3 space-y-2">
          <div className="text-sm font-medium text-gray-700">
            {results.message || 'Processing Results'}
          </div>
          <div className="flex items-center space-x-4 text-sm">
            {results.successful?.length > 0 && (
              <div className="flex items-center space-x-1 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>{results.successful.length} successful</span>
              </div>
            )}
            {results.failed?.length > 0 && (
              <div className="flex items-center space-x-1 text-red-600">
                <XCircle className="w-4 h-4" />
                <span>{results.failed.length} failed</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stuck Jobs Warning */}
      {status.possiblyStuck > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800">
                {status.possiblyStuck} video{status.possiblyStuck !== 1 ? 's' : ''} may be stuck
              </p>
              <p className="text-sm text-orange-700">
                These videos have been processing for over 15 minutes. They may have completed but need status verification.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-amber-600">
          {status.processing > 0 ? (
            <div className="flex items-center space-x-2">
              <span>Videos converting in AWS MediaConvert</span>
              {autoPolling && (
                <span className="text-green-600">• Auto-updating every 30s</span>
              )}
            </div>
          ) : (
            'Videos will be converted to 480p MP4 format'
          )}
        </div>
        
        <div className="flex gap-2">
          {/* Check Status Button - Enhanced */}
          {status.processing > 0 && (
            <button
              onClick={handleManualStatusCheck}
              disabled={checkingStatus}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm
                ${checkingStatus 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}
            >
              {checkingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Check Status</span>
                </>
              )}
            </button>
          )}
          
          {/* Start Conversion Button - Enhanced */}
          {status.needsTranscoding > 0 && (
            <button
              onClick={handleStartTranscoding}
              disabled={processing}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm
                ${processing 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-amber-600 text-white hover:bg-amber-700'
                }
              `}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Start Conversion</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Enhanced Processing Information */}
      {(processing || status.processing > 0 || autoPolling) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <Film className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">
                {processing ? 'Starting video conversion...' : 'Videos processing in AWS MediaConvert'}
              </p>
              <p className="mt-1">
                {processing ? (
                  'Videos will be processed in small batches with proper rate limiting to avoid "Too Many Requests" errors.'
                ) : autoPolling ? (
                  'Status updates automatically every 30 seconds. You can also manually check for immediate updates.'
                ) : (
                  'Click "Check Status" to update the progress of videos currently being transcoded.'
                )}
              </p>
              {status.processing > 0 && !autoPolling && (
                <p className="mt-1 text-xs">
                  💡 Tip: The system auto-monitors processing videos every 30 seconds when active.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}