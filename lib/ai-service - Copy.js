// lib/ai-service.js - UPDATED FOR NEW RUNPOD ENDPOINT

/**
 * AI Service for calling RunPod YOLO + OCR model
 * Updated to use new endpoint: voejm0cy20ca2m
 */

const RUNPOD_ENDPOINT = 'https://api.runpod.ai/v2/voejm0cy20ca2m'  // NEW ENDPOINT
const REQUEST_TIMEOUT = 30000 // Increased to 30 seconds for OCR processing

export class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.isEnabled = false
  }

  /**
   * Enable/disable AI processing
   */
  setEnabled(enabled) {
    this.isEnabled = enabled
  }

  /**
   * Convert image file to base64 for API submission
   */
  async imageToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        // Remove data URL prefix (data:image/jpeg;base64,)
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * Call RunPod API with timeout
   */
  async callRunPodAPI(imageBase64) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const payload = { input: { image: imageBase64 } }

      console.log('🤖 Calling RunPod API (new endpoint)...')
      
      const response = await fetch(`${RUNPOD_ENDPOINT}/runsync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      console.log('📡 RunPod Response Status:', response.status)

      const data = await response.json()
      console.log('📡 RunPod Response:', data)
      
      if (response.ok && data.status === 'COMPLETED') {
        console.log('✅ RunPod API success - parsing response...')
        clearTimeout(timeoutId)
        return this.parseAPIResponse(data)
      } else if (response.ok && data.status) {
        throw new Error(`RunPod job status: ${data.status}`)
      } else {
        throw new Error(`RunPod API error: ${response.status} - ${JSON.stringify(data)}`)
      }

    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        throw new Error('AI analysis timed out (30 seconds)')
      }
      
      throw error
    }
  }

  /**
   * Parse RunPod API response - UPDATED FOR NEW FORMAT
   */
  parseAPIResponse(apiResponse) {
    console.log('🔍 Parsing RunPod response...')

    const predictions = {
      objects: [],
      text: [],
      distances: [],
      confidence: 0
    }

    // Handle the nested output structure in new endpoint
    const modelOutput = apiResponse?.output?.output
    if (!modelOutput) {
      console.warn('🔍 No model output found in response')
      return predictions
    }

    console.log('🔍 Model output:', modelOutput)

    // Parse YOLO detections - structure is compatible
    if (modelOutput.detections && Array.isArray(modelOutput.detections)) {
      console.log('🎯 Processing YOLO detections:', modelOutput.detections)
      
      predictions.objects = modelOutput.detections.map(detection => ({
        class: detection.class,
        confidence: detection.confidence,
        bbox: detection.bbox
      }))
      
      console.log('🎯 Processed objects:', predictions.objects)
    }

    // Parse OCR results - UPDATED FOR NEW FORMAT
    if (modelOutput.ocr) {
      console.log('📝 Processing OCR results:', modelOutput.ocr)
      
      if (modelOutput.ocr.texts && Array.isArray(modelOutput.ocr.texts)) {
        predictions.text = modelOutput.ocr.texts.map(textItem => ({
          text: textItem.text,
          confidence: textItem.confidence,
          bbox: textItem.bbox.points ? textItem.bbox.points : textItem.bbox  // Handle both formats
        }))
      }

      // Check for pre-extracted distance - NEW LOCATION
      if (modelOutput.ocr.extracted_data?.distance) {
        const distanceText = modelOutput.ocr.extracted_data.distance
        console.log('📏 Found pre-extracted distance:', distanceText)
        
        const distanceMatch = distanceText.match(/(\d+\.?\d*)/);
        if (distanceMatch) {
          const distanceValue = parseFloat(distanceMatch[1])
          predictions.distances.push({
            value: distanceValue,
            originalText: distanceText,
            confidence: 1.0
          })
          console.log('📏 Added pre-extracted distance:', distanceValue)
        }
      }
    }

    // If no pre-extracted distance, try to extract from OCR text
    if (predictions.distances.length === 0) {
      console.log('📏 No pre-extracted distance, extracting from OCR text...')
      predictions.distances = this.extractDistances(predictions.text)
    }

    // Calculate overall confidence
    const allConfidences = [
      ...predictions.objects.map(o => o.confidence),
      ...predictions.text.map(t => t.confidence)
    ]
    predictions.confidence = allConfidences.length > 0 
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length 
      : 0

    // Log execution time if available
    if (apiResponse.executionTime) {
      console.log(`⏱️ Model execution time: ${apiResponse.executionTime}ms`)
    }

    return predictions
  }

  /**
   * Extract distance measurements from OCR text
   */
  extractDistances(textResults) {
    const distances = []
    const distancePatterns = [
      /(\d+\.?\d*)\s*m(?:eters?)?/gi,
      /(\d+\.?\d*)\s*cm/gi,
      /(\d+\.?\d*)\s*mm/gi,
      /(\d+\.?\d*)\s*ft/gi,
    ]

    textResults.forEach(textItem => {
      const text = textItem.text || ''
      
      distancePatterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)]
        matches.forEach(match => {
          let value = parseFloat(match[1])
          let unit = match[0].replace(match[1], '').trim()
          
          // Convert to meters
          if (unit.includes('cm')) {
            value = value / 100
          } else if (unit.includes('mm')) {
            value = value / 1000
          } else if (unit.includes('ft')) {
            value = value * 0.3048
          }
          
          if (value > 0 && value < 1000) {
            distances.push({
              value: parseFloat(value.toFixed(2)),
              originalText: match[0],
              confidence: textItem.confidence || 0
            })
          }
        })
      })
    })

    return distances
  }

  /**
   * Get mapped observation code from detected object class
   */
  async getObservationCodeFromObject(objectClass) {
    try {
      const { supabase } = await import('./supabase.js')
      
      const { data, error } = await supabase
        .from('ai_object_mappings')
        .select('observation_code')
        .eq('object_class', objectClass.toLowerCase())
        .eq('is_active', true)
        .single()

      if (error || !data) {
        console.log(`🔍 No mapping found for object class: ${objectClass}`)
        return null
      }

      console.log(`🎯 Found mapping: ${objectClass} → ${data.observation_code}`)
      return data.observation_code
    } catch (error) {
      console.error('Error getting observation code mapping:', error)
      return null
    }
  }

  /**
   * Main analysis function
   */
  async analyzeImage(imageFile) {
    if (!this.isEnabled) {
      throw new Error('AI analysis is disabled')
    }

    if (!this.apiKey) {
      throw new Error('AI API key not configured')
    }

    console.log('🚀 Starting AI analysis with new endpoint...')

    try {
      const imageBase64 = await this.imageToBase64(imageFile)
      console.log('🖼️ Image converted to base64, length:', imageBase64.length)
      
      const predictions = await this.callRunPodAPI(imageBase64)
      
      // Get the best distance prediction
      const bestDistance = predictions.distances.length > 0 
        ? predictions.distances.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
          )
        : null

      // Get the best object detection and map to observation code
      let bestObjectCode = null
      if (predictions.objects.length > 0) {
        const bestObject = predictions.objects.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        )
        console.log('🎯 Best detected object:', bestObject)
        bestObjectCode = await this.getObservationCodeFromObject(bestObject.class)
      }

      const result = {
        success: true,
        predictions,
        suggestions: {
          distance: bestDistance?.value || null,
          observationCode: bestObjectCode || null,
          confidence: predictions.confidence
        },
        rawResponse: predictions
      }

      console.log('🎉 === AI ANALYSIS COMPLETE ===')
      console.log('🎉 Suggested distance:', result.suggestions.distance)
      console.log('🎉 Suggested code:', result.suggestions.observationCode)
      console.log('🎉 Overall confidence:', result.suggestions.confidence)
      console.log('🎉 Text regions found:', predictions.text.length)

      return result

    } catch (error) {
      console.error('❌ AI analysis failed:', error)
      return {
        success: false,
        error: error.message,
        predictions: null,
        suggestions: {
          distance: null,
          observationCode: null,
          confidence: 0
        }
      }
    }
  }
}

// Export singleton instance
let aiServiceInstance = null

export const getAIService = (apiKey = null) => {
  // Use environment variable if no API key provided
  const key = apiKey || process.env.NEXT_PUBLIC_RUNPOD_API_KEY
  
  if (!aiServiceInstance || (key && aiServiceInstance.apiKey !== key)) {
    aiServiceInstance = new AIService(key)
  }
  return aiServiceInstance
}

// SIMPLIFIED: Get AI settings from environment variables only
export const getUserAISettings = async () => {
  // Check if AI is enabled via environment variable
  const isEnabled = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'
  const apiKey = process.env.NEXT_PUBLIC_RUNPOD_API_KEY
  
  console.log('🔧 AI Settings from environment:', {
    enabled: isEnabled,
    hasApiKey: !!apiKey
  })
  
  // Return settings based on environment variables
  return {
    ai_enabled: isEnabled && !!apiKey,
    auto_populate_enabled: true,
    confidence_threshold: 0.7,
    distance_ocr_enabled: true,
    object_detection_enabled: true,
    runpod_api_key: apiKey || null
  }
}

// SIMPLIFIED: No saving needed - settings come from environment
export const saveAISettings = async (settings) => {
  console.log('ℹ️ AI settings are controlled by environment variables')
  // No-op - settings are read-only from environment
  return settings
}

export default AIService