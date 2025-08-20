// components/reports/GenerateRecommendationsButton.js
// AI-powered repair recommendations generation

import { useState, useEffect } from 'react'
import { Bot, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { generateRepairRecommendations, checkGenerationStatus } from '@/lib/services/llm-report-service'
import { useAuth } from '@/lib/auth-context'

export default function GenerateRecommendationsButton({ 
  report, 
  onRecommendationsGenerated, 
  disabled = false,
  existingRecommendations = []
}) {
  const { user } = useAuth()
  
  const [generationState, setGenerationState] = useState({
    status: 'idle', // idle|generating|queued|processing|completed|error
    queueId: null,
    position: 0,
    estimatedWait: '',
    error: null,
    result: null
  })

  // Check if we should show confirmation for existing content
  const hasExistingRecommendations = existingRecommendations.length > 0

  // Poll for status updates when in queue or processing
  useEffect(() => {
    if (generationState.queueId && 
        (generationState.status === 'queued' || generationState.status === 'processing')) {
      
      const pollStatus = async () => {
        try {
          const status = await checkGenerationStatus(generationState.queueId)
          
          if (status.success) {
            setGenerationState(prev => ({
              ...prev,
              status: status.status,
              position: status.position || 0,
              estimatedWait: status.estimatedWait || '',
              result: status.result,
              error: status.error
            }))
            
            // If completed, parse and apply recommendations
            if (status.status === 'completed' && status.result) {
              const recommendations = parseAIRecommendations(status.result)
              if (recommendations.length > 0) {
                onRecommendationsGenerated(recommendations)
                setGenerationState(prev => ({ ...prev, status: 'completed' }))
              }
            }
          }
        } catch (error) {
          console.error('Error checking generation status:', error)
          setGenerationState(prev => ({
            ...prev,
            status: 'error',
            error: 'Failed to check generation status'
          }))
        }
      }
      
      // Poll every 3 seconds
      const interval = setInterval(pollStatus, 3000)
      
      // Cleanup
      return () => clearInterval(interval)
    }
  }, [generationState.queueId, generationState.status, onRecommendationsGenerated])

  const handleGenerate = async (force = false) => {
    // Show confirmation if there are existing recommendations
    if (!force && hasExistingRecommendations) {
      const confirmed = window.confirm(
        `This will generate new repair recommendations. You currently have ${existingRecommendations.length} existing recommendation${existingRecommendations.length !== 1 ? 's' : ''}.\n\nDo you want to continue? The AI recommendations will be added to your existing ones.`
      )
      if (!confirmed) return
    }

    setGenerationState({
      status: 'generating',
      queueId: null,
      position: 0,
      estimatedWait: '',
      error: null,
      result: null
    })

    try {
      // Use user ID from auth context
      const userId = user?.id
      
      if (!userId) {
        throw new Error('User not authenticated')
      }
      
      const result = await generateRepairRecommendations(report, userId)
      
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
          error: result.error || 'Failed to start generation',
          result: null
        })
      }
    } catch (error) {
      console.error('Error generating recommendations:', error)
      setGenerationState({
        status: 'error',
        queueId: null,
        position: 0,
        estimatedWait: '',
        error: 'Failed to generate recommendations. Please try again.',
        result: null
      })
    }
  }

  const handleRetry = () => {
    setGenerationState({
      status: 'idle',
      queueId: null,
      position: 0,
      estimatedWait: '',
      error: null,
      result: null
    })
  }

  // Parse AI recommendations as editorial narrative - FIXED (no project name references)
  const parseAIRecommendations = (aiText) => {
    const recommendations = []
    
    try {
      console.log('📝 Parsing AI editorial narrative:', aiText.substring(0, 200) + '...')
      
      // Clean up the AI response
      const cleanedText = aiText
        .trim()
        .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
        .replace(/\t/g, '') // Remove tabs
      
      // Check if this is a "no defects" response
      if (cleanedText.toLowerCase().includes('no defects requiring remedial works') ||
          cleanedText.toLowerCase().includes('no immediate repair recommendations required')) {
        
        recommendations.push({
          category: 'monitoring',
          priority: 'low',
          title: 'System Assessment - No Defects Found',
          description: 'CCTV inspection completed with no immediate remedial works required.',
          detailed_action: cleanedText
        })
        
        console.log('✅ Parsed no-defects recommendation')
        return recommendations
      }
      
      // Split into sections - look for section headers with new format
      const sections = cleanedText.split(/(?=\*\*[^*]+:[^*]+\*\*|^[A-Za-z0-9\s]+:[A-Za-z0-9\s]+to[A-Za-z0-9\s]+$)/m)
      
      // Process each section
      sections.forEach((sectionText, index) => {
        const trimmedSection = sectionText.trim()
        if (trimmedSection.length < 50) return // Skip very short sections
        
        // Extract section header with new format
        const sectionHeaderMatch = trimmedSection.match(/^\*\*([^*]+)\*\*|^([^*\n]+:[^*\n]+to[^*\n]+)/m)
        
        let sectionHeader = 'Section Assessment'
        if (sectionHeaderMatch) {
          sectionHeader = (sectionHeaderMatch[1] || sectionHeaderMatch[2] || '').trim()
        } else {
          sectionHeader = `Section ${index + 1} Assessment`
        }
        
        // Format the text for better display
        const formattedText = trimmedSection
        
        // Determine priority based on content
        let priority = 'medium'
        let category = 'short_term'
        
        if (formattedText.toLowerCase().includes('immediate') || 
            formattedText.toLowerCase().includes('24-48 hours') ||
            formattedText.toLowerCase().includes('critical') ||
            formattedText.toLowerCase().includes('excavation')) {
          priority = 'critical'
          category = 'immediate'
        } else if (formattedText.toLowerCase().includes('broken') ||
                  formattedText.toLowerCase().includes('collapsed') ||
                  formattedText.toLowerCase().includes('structural')) {
          priority = 'high'
          category = 'short_term'
        } else if (formattedText.toLowerCase().includes('cleaning') ||
                  formattedText.toLowerCase().includes('jetting') ||
                  formattedText.toLowerCase().includes('deposits')) {
          priority = 'low'
          category = 'long_term'
        }
        
        // Create a recommendation for this section (no project name)
        recommendations.push({
          category,
          priority,
          title: sectionHeader,
          description: `Professional engineering assessment and repair recommendations for ${sectionHeader.toLowerCase()}.`,
          detailed_action: formattedText,
          //is_ai_narrative: true
        })
      })
      
      // If no sections were parsed, create a single narrative recommendation
      if (recommendations.length === 0) {
        console.log('⚠️ No sections found, creating single narrative recommendation')
        
        const formattedText = cleanedText
        
        recommendations.push({
          category: 'short_term',
          priority: 'medium',
          title: 'Repair Recommendations Summary',
          description: 'Comprehensive professional assessment of inspection findings with detailed repair recommendations.',
          detailed_action: formattedText
        })
      }
      
    } catch (error) {
      console.error('❌ Error parsing AI narrative:', error)
      
      // Fallback: create a single recommendation with the full text
      recommendations.push({
        category: 'short_term',
        priority: 'medium',
        title: 'AI Repair Recommendations',
        description: 'Professional repair recommendations based on CCTV inspection analysis.',
        detailed_action: aiText,
        //is_ai_narrative: true
      })
    }
    
    console.log(`✅ Parsed ${recommendations.length} narrative section(s)`)
    return recommendations
  }

  
  const parseRecommendationSection = (sectionText, category, priority) => {
    const recommendations = []
    
    // Split by bullet points or line breaks
    const items = sectionText
      .split(/[-•\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 10) // Filter out short/empty lines
    
    items.forEach((item, index) => {
      // Extract title (first sentence) and description (rest)
      const sentences = item.split(/[.!?]+/)
      const title = sentences[0]?.trim() || `${category.replace('_', ' ')} Recommendation ${index + 1}`
      const description = sentences.slice(1).join('. ').trim() || item
      
      recommendations.push({
        category,
        priority,
        title: title.substring(0, 200), // Limit title length
        description: description.substring(0, 500), // Limit description
        detailed_action: item
      })
    })
    
    return recommendations
  }

  // Don't render if user is not authenticated
  if (!user) {
    return null
  }

  // Render different states
  const renderButton = () => {
    switch (generationState.status) {
      case 'idle':
        return (
          <button
            onClick={() => handleGenerate()}
            disabled={disabled}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              disabled 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-sm'
            }`}
          >
            <Bot className="h-4 w-4 mr-2" />
            Generate AI Recommendations
          </button>
        )

      case 'generating':
        return (
          <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-md">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            ✨ Analyzing Your Inspection Data...
          </div>
        )

      case 'queued':
        return (
          <div className="inline-flex items-center px-4 py-2 bg-amber-50 text-amber-700 rounded-md">
            <Clock className="h-4 w-4 mr-2" />
            🚦 Position {generationState.position} in queue • Est. {generationState.estimatedWait}
          </div>
        )

      case 'processing':
        return (
          <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-md">
            <div className="animate-pulse h-4 w-4 bg-blue-600 rounded-full mr-2"></div>
            ⚡ AI is Creating Your Recommendations...
          </div>
        )

      case 'completed':
        return (
          <div className="inline-flex items-center px-4 py-2 bg-green-50 text-green-700 rounded-md">
            <CheckCircle className="h-4 w-4 mr-2" />
            ✅ Repair Recommendations Generated!
          </div>
        )

      case 'error':
        return (
          <div className="space-y-2">
            <div className="inline-flex items-center px-4 py-2 bg-red-50 text-red-700 rounded-md">
              <XCircle className="h-4 w-4 mr-2" />
              ❌ Generation Failed
            </div>
            <p className="text-sm text-red-600">{generationState.error}</p>
            <button
              onClick={handleRetry}
              className="text-sm text-red-600 hover:text-red-700 underline"
            >
              Try Again
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex flex-col space-y-2">
      {renderButton()}
      
      {/* Show warning for existing content */}
      {generationState.status === 'idle' && hasExistingRecommendations && (
        <p className="text-xs text-amber-600">
          ⚠️ AI recommendations will be added to your {existingRecommendations.length} existing recommendation{existingRecommendations.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}