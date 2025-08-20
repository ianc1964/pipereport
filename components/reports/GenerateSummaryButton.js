// components/reports/GenerateSummaryButton.js
// Professional AI generation button with queue management UX

'use client'

import { useState, useEffect } from 'react'
import { 
  Sparkles, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Zap,
  Users,
  RefreshCw
} from 'lucide-react'
import { generateExecutiveSummary, checkGenerationStatus } from '@/lib/services/llm-report-service'

export default function GenerateSummaryButton({ 
  report, 
  onSummaryGenerated, 
  disabled = false,
  currentSummary = ''
}) {
  const [generationState, setGenerationState] = useState({
    status: 'idle', // 'idle', 'generating', 'queued', 'processing', 'completed', 'error'
    queueId: null,
    position: 0,
    estimatedWait: '',
    error: null,
    result: null
  })

  const [showConfirmation, setShowConfirmation] = useState(false)

  // Poll for status updates when in queue or processing
  useEffect(() => {
    if (!generationState.queueId || 
        generationState.status === 'completed' || 
        generationState.status === 'error' ||
        generationState.status === 'idle') {
      return
    }

    const interval = setInterval(async () => {
      try {
        const statusResult = await checkGenerationStatus(generationState.queueId)
        
        if (statusResult.success) {
          setGenerationState(prev => ({
            ...prev,
            status: statusResult.status,
            position: statusResult.position,
            estimatedWait: statusResult.estimatedWait,
            result: statusResult.result,
            error: statusResult.error
          }))

          // If completed, apply the result
          if (statusResult.status === 'completed' && statusResult.result) {
            onSummaryGenerated(statusResult.result)
            setGenerationState(prev => ({ ...prev, status: 'completed' }))
          }
        }
      } catch (error) {
        console.error('Status check failed:', error)
      }
    }, 2000) // Check every 2 seconds

    return () => clearInterval(interval)
  }, [generationState.queueId, generationState.status, onSummaryGenerated])

  const handleGenerate = async () => {
    try {
      setGenerationState({ status: 'generating', queueId: null, position: 0, estimatedWait: '', error: null, result: null })
      
      // Get user from auth context (you might need to pass this as prop)
      const user = { id: 'current-user-id' } // TODO: Get from auth context
      
      const result = await generateExecutiveSummary(report, user.id)
      
      if (result.success) {
        setGenerationState({
          status: 'queued',
          queueId: result.queueId,
          position: result.position,
          estimatedWait: result.estimatedWait,
          error: null,
          result: null
        })
      } else {
        setGenerationState({
          status: 'error',
          queueId: null,
          position: 0,
          estimatedWait: '',
          error: result.error,
          result: null
        })
      }
    } catch (error) {
      console.error('Generation failed:', error)
      setGenerationState({
        status: 'error',
        queueId: null,
        position: 0,
        estimatedWait: '',
        error: error.message,
        result: null
      })
    }
  }

  const handleGenerateClick = () => {
    if (currentSummary?.trim()) {
      setShowConfirmation(true)
    } else {
      handleGenerate()
    }
  }

  const confirmGenerate = () => {
    setShowConfirmation(false)
    handleGenerate()
  }

  const cancelGeneration = () => {
    setGenerationState({ status: 'idle', queueId: null, position: 0, estimatedWait: '', error: null, result: null })
  }

  const resetState = () => {
    setGenerationState({ status: 'idle', queueId: null, position: 0, estimatedWait: '', error: null, result: null })
    setShowConfirmation(false)
  }

  // Render confirmation dialog
  if (showConfirmation) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-orange-900">Replace Existing Summary?</h4>
            <p className="text-sm text-orange-700 mt-1">
              You already have content in the executive summary. AI generation will replace your current text.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={confirmGenerate}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                Generate New Summary
              </button>
              <button
                onClick={() => setShowConfirmation(false)}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render generation status
  if (generationState.status !== 'idle') {
    return (
      <div className="space-y-4">
        {/* Status Display */}
        <div className={`border rounded-lg p-4 ${
          generationState.status === 'error' ? 'bg-red-50 border-red-200' :
          generationState.status === 'completed' ? 'bg-green-50 border-green-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            {generationState.status === 'generating' && (
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
            )}
            {generationState.status === 'queued' && (
              <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
            )}
            {generationState.status === 'processing' && (
              <Zap className="h-5 w-5 text-blue-600 animate-pulse flex-shrink-0" />
            )}
            {generationState.status === 'completed' && (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            )}
            {generationState.status === 'error' && (
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            )}
            
            <div className="flex-1">
              <h4 className={`font-medium ${
                generationState.status === 'error' ? 'text-red-900' :
                generationState.status === 'completed' ? 'text-green-900' :
                'text-blue-900'
              }`}>
                {generationState.status === 'generating' && 'Analyzing Your Inspection Data...'}
                {generationState.status === 'queued' && 'Added to Generation Queue'}
                {generationState.status === 'processing' && 'AI is Writing Your Summary...'}
                {generationState.status === 'completed' && 'Executive Summary Generated!'}
                {generationState.status === 'error' && 'Generation Failed'}
              </h4>
              
              <p className={`text-sm mt-1 ${
                generationState.status === 'error' ? 'text-red-700' :
                generationState.status === 'completed' ? 'text-green-700' :
                'text-blue-700'
              }`}>
                {generationState.status === 'generating' && 'Setting up AI analysis of your observations and defects...'}
                {generationState.status === 'queued' && generationState.position > 1 && 
                  `Position ${generationState.position} in queue • Est. ${generationState.estimatedWait}`}
                {generationState.status === 'queued' && generationState.position <= 1 && 
                  'Next in line for processing...'}
                {generationState.status === 'processing' && 'AI is analyzing your findings and writing the summary...'}
                {generationState.status === 'completed' && 'Professional summary has been generated and applied to your report.'}
                {generationState.status === 'error' && (generationState.error || 'An unexpected error occurred.')}
              </p>
            </div>
          </div>
          
          {/* Progress bar for queued/processing */}
          {(generationState.status === 'queued' || generationState.status === 'processing') && (
            <div className="mt-3">
              <div className="bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: generationState.status === 'processing' ? '75%' : 
                           generationState.position <= 2 ? '50%' : '25%'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {(generationState.status === 'queued' || generationState.status === 'processing') && (
            <button
              onClick={cancelGeneration}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          
          {generationState.status === 'error' && (
            <>
              <button
                onClick={handleGenerate}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Try Again
              </button>
              <button
                onClick={resetState}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          )}
          
          {generationState.status === 'completed' && (
            <button
              onClick={resetState}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Done
            </button>
          )}
        </div>

        {/* High demand notice */}
        {generationState.status === 'queued' && generationState.position > 3 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-700">
                <strong>High Demand:</strong> Our AI service is experiencing high usage. 
                You can continue working on other parts of your report - we'll update the summary automatically when ready.
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render generate button (idle state)
  return (
    <button
      onClick={handleGenerateClick}
      disabled={disabled || !report?.observations_snapshot?.length}
      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all duration-200"
      title={!report?.observations_snapshot?.length ? 'No observations available to analyze' : 'Generate AI-powered executive summary'}
    >
      <Sparkles className="w-4 h-4 mr-2" />
      Generate Summary
    </button>
  )
}