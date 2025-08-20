// lib/ai-service.js - UPDATED WITH ENHANCED DISTANCE EXTRACTION

/**
 * AI Service for calling RunPod YOLO + OCR model
 * Updated to use new endpoint: voejm0cy20ca2m
 * Enhanced with improved distance extraction logic
 */

const RUNPOD_ENDPOINT = 'https://api.runpod.ai/v2/voejm0cy20ca2m'  // NEW ENDPOINT
const REQUEST_TIMEOUT = 10000 // Increased to 10 seconds for OCR processing

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
   * Extract distance measurements from OCR text with improved accuracy
   * Prioritizes text based on position and format matching
   */
  extractDistances(textResults) {
    const distances = []
    
    // Define distance patterns in order of specificity
    const distancePatterns = [
      // HIGHEST: Decimal with M/m suffix (most likely to be distance)
      {
        pattern: /^\+?(\d{1,3}\.\d{1,2})[Mm]$/,
        confidence: 1.0,
        name: 'exact_decimal_with_m',
        hasDecimal: true
      },
      // HIGH: Decimal number without suffix
      {
        pattern: /^\+?(\d{1,3}\.\d{1,2})$/,
        confidence: 0.95,
        name: 'exact_decimal_no_suffix',
        hasDecimal: true
      },
      // GOOD: Decimal with M/m embedded in text
      {
        pattern: /\b\+?(\d{1,3}\.\d{1,2})[Mm]\b/,
        confidence: 0.9,
        name: 'embedded_decimal_with_m',
        hasDecimal: true
      },
      // MEDIUM-HIGH: Decimal with space and M/m
      {
        pattern: /\+?(\d{1,3}\.\d{1,2})\s*[Mm]\b/,
        confidence: 0.85,
        name: 'decimal_space_m',
        hasDecimal: true
      },
      // SPECIAL: Format like "4.0m" or "002.34m" (common in inspection videos)
      {
        pattern: /^0*(\d{1,3}\.\d{1,2})[Mm]$/,
        confidence: 0.98,
        name: 'inspection_format_decimal',
        hasDecimal: true
      },
      // MEDIUM: Integer with M/m (no decimal)
      {
        pattern: /\b\+?(\d{1,3})[Mm]\b/,
        confidence: 0.6,
        name: 'integer_with_m',
        hasDecimal: false
      },
      // LOW: Standalone integer (could be anything)
      {
        pattern: /^\+?(\d{1,3})$/,
        confidence: 0.4,
        name: 'standalone_integer',
        hasDecimal: false
      },
      // VERY LOW: Double M without space (likely millimeters written as MM)
      {
        pattern: /\+?(\d{1,3}\.?\d{0,2})MM\b/,
        confidence: 0.1,  // Very low confidence for MM
        name: 'double_M_millimeters',
        hasDecimal: false,
        isMillimeters: true
      },
      // LOW: mm suffix (millimeters - usually not main distance)
      // Also catches MM (double M uppercase)
      {
        pattern: /\+?(\d{1,3}\.?\d{0,2})\s*mm\b/i,
        confidence: 0.15,  // Even lower confidence
        name: 'millimeters',
        hasDecimal: false,
        isMillimeters: true
      },
      // MEDIUM: 'meters' word
      {
        pattern: /\+?(\d{1,3}\.?\d{0,2})\s*meters?\b/i,
        confidence: 0.7,
        name: 'number_meters_word',
        hasDecimal: false
      },
      // LOW: cm suffix (centimeters - usually not main distance)
      {
        pattern: /\+?(\d{1,3}\.?\d{0,2})\s*cm\b/i,
        confidence: 0.3,
        name: 'centimeters',
        hasDecimal: false
      }
    ]

    // Process each OCR text result
    textResults.forEach(textItem => {
      const text = textItem.text || ''
      const bbox = textItem.bbox
      const ocrConfidence = textItem.confidence || 0
      
      // Skip text that contains invalid characters for distances
      // Allow '+' at the beginning but not '/' or ':' anywhere
      if (text.includes('/') || text.includes(':')) {
        console.log(`🚫 Skipping text with invalid chars: "${text}"`)
        return
      }
      
      // Clean the text
      const cleanText = text.trim()
      
      // Log all text being analyzed for debugging
      console.log(`🔍 Analyzing text: "${cleanText}"`)
      
      // Special check for double M (MM) which is often millimeters
      if (cleanText.includes('MM') && !cleanText.includes('m')) {
        console.log(`  ⚠️ Text contains "MM" (likely millimeters): "${cleanText}"`)
      }
      
      // Calculate position score (very top or very bottom are strongly preferred)
      let positionScore = 0.3 // default middle score (lower base for middle positions)
      
      if (bbox && Array.isArray(bbox)) {
        // Get the vertical position (assuming bbox has points or is array of coordinates)
        let avgY = 0
        let avgX = 0
        
        if (bbox.points && Array.isArray(bbox.points)) {
          // Format: {points: [[x1,y1], [x2,y2], ...]}
          avgY = bbox.points.reduce((sum, point) => sum + (point[1] || 0), 0) / bbox.points.length
          avgX = bbox.points.reduce((sum, point) => sum + (point[0] || 0), 0) / bbox.points.length
        } else if (Array.isArray(bbox) && bbox.length >= 4) {
          // Format: [x1, y1, x2, y2] or [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
          if (Array.isArray(bbox[0])) {
            avgY = bbox.reduce((sum, point) => sum + point[1], 0) / bbox.length
            avgX = bbox.reduce((sum, point) => sum + point[0], 0) / bbox.length
          } else {
            avgY = (bbox[1] + bbox[3]) / 2
            avgX = (bbox[0] + bbox[2]) / 2
          }
        }
        
        // Normalize Y position (assuming image coordinates where 0,0 is top-left)
        // Assuming max Y is around 480-1080 pixels
        const normalizedY = Math.min(avgY / 1080, 1) // normalize to 0-1
        
        // Calculate distance from top and bottom edges
        // Very top (0-0.15) and very bottom (0.85-1.0) get highest scores
        let edgeScore = 0
        if (normalizedY <= 0.15) {
          // Very top of image (top 15%)
          edgeScore = 0.9 - (normalizedY * 2) // Score 0.9 at very top, decreasing to 0.6 at 15%
          console.log(`📍 Text at TOP of image`)
        } else if (normalizedY >= 0.85) {
          // Very bottom of image (bottom 15%)
          edgeScore = 0.6 + ((normalizedY - 0.85) * 2) // Score 0.6 at 85%, increasing to 0.9 at very bottom
          console.log(`📍 Text at BOTTOM of image`)
        } else {
          // Middle area gets low score
          edgeScore = 0.2 // Low score for middle positions
        }
        
        positionScore = edgeScore
        
        console.log(`📍 Position analysis for "${cleanText}": Y=${avgY.toFixed(0)} (normalized: ${normalizedY.toFixed(2)}), score=${positionScore.toFixed(2)}`)
      }
      
      // Try each pattern
      let bestMatch = null
      let bestPatternConfidence = 0
      
      for (const patternDef of distancePatterns) {
        const matches = cleanText.match(patternDef.pattern)
        if (matches) {
          const value = parseFloat(matches[1])
          
          // Validate the distance value (reasonable range for pipe inspection)
          if (value >= 0 && value <= 999) {
            let patternConfidence = patternDef.confidence
            
            // Check if the actual matched text has a decimal point
            const matchedText = matches[0]
            const actuallyHasDecimal = matchedText.includes('.')
            
            // Boost confidence if it has a decimal point (unless it's mm)
            if (actuallyHasDecimal && !patternDef.isMillimeters) {
              patternConfidence = Math.min(patternConfidence * 1.3, 1.0) // 30% boost for decimals, cap at 1.0
              console.log(`  📊 Decimal boost applied to "${matchedText}"`)
            }
            
            // Penalize mm/MM (millimeters) - already low, but ensure it stays low
            if (patternDef.isMillimeters || matchedText.includes('MM') || matchedText.toLowerCase().includes('mm')) {
              patternConfidence = Math.min(patternConfidence, 0.15)
              console.log(`  📉 Low score for millimeters: "${matchedText}" (conf: ${patternConfidence})`)
            }
            
            // Convert mm to meters if needed
            let convertedValue = value
            if (patternDef.isMillimeters) {
              convertedValue = value / 1000
            } else if (patternDef.name === 'centimeters') {
              convertedValue = value / 100
            }
            
            if (patternConfidence > bestPatternConfidence) {
              bestMatch = {
                value: convertedValue,
                originalText: matches[0], // This will include '+' if present
                patternName: patternDef.name,
                patternConfidence: patternConfidence,
                hasDecimal: actuallyHasDecimal
              }
              bestPatternConfidence = patternConfidence
            }
          }
        }
      }
      
      if (bestMatch) {
        // Calculate final confidence score
        // Combines: OCR confidence, pattern confidence, and position score
        const finalConfidence = (
          ocrConfidence * 0.3 +           // 30% from OCR confidence
          bestMatch.patternConfidence * 0.4 + // 40% from pattern match (includes decimal boost)
          positionScore * 0.3              // 30% from position
        )
        
        distances.push({
          value: bestMatch.value,
          originalText: bestMatch.originalText, // Will include '+' if present
          confidence: parseFloat(finalConfidence.toFixed(3)),
          details: {
            ocrConfidence: ocrConfidence,
            patternConfidence: bestMatch.patternConfidence,
            positionScore: positionScore,
            patternName: bestMatch.patternName,
            fullText: cleanText,
            position: bbox,
            hasDecimal: bestMatch.hasDecimal
          }
        })
        
        const decimalInfo = bestMatch.hasDecimal ? ' [HAS DECIMAL ✓]' : ''
        console.log(`✅ Distance found: ${bestMatch.value}m from "${cleanText}" (confidence: ${finalConfidence.toFixed(3)})${decimalInfo}`)
      }
    })
    
    // Sort by confidence and remove duplicates
    distances.sort((a, b) => b.confidence - a.confidence)
    
    // Remove duplicate values (keep highest confidence)
    const uniqueDistances = []
    const seenValues = new Set()
    
    for (const dist of distances) {
      const roundedValue = Math.round(dist.value * 100) / 100 // round to 2 decimals
      if (!seenValues.has(roundedValue)) {
        seenValues.add(roundedValue)
        uniqueDistances.push(dist)
      }
    }
    
    console.log(`📏 Found ${uniqueDistances.length} unique distances:`, 
      uniqueDistances.map(d => `${d.value}m (conf: ${d.confidence})`).join(', '))
    
    return uniqueDistances
  }

  /**
   * Parse RunPod API response - UPDATED FOR NEW FORMAT WITH ENHANCED DISTANCE EXTRACTION
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

      // Check for pre-extracted distance but VALIDATE it
      if (modelOutput.ocr.extracted_data?.distance) {
        const distanceText = modelOutput.ocr.extracted_data.distance
        console.log('📝 Found pre-extracted distance from API:', distanceText)
        
        const distanceMatch = distanceText.match(/(\d+\.?\d*)/);
        if (distanceMatch) {
          const distanceValue = parseFloat(distanceMatch[1])
          const hasDecimal = distanceText.includes('.')
          
          // Only use pre-extracted if it looks good (has decimal or ends with proper m)
          // Otherwise we'll find better ones from OCR text
          if (hasDecimal || distanceText.match(/\d[Mm]$/)) {
            predictions.distances.push({
              value: distanceValue,
              originalText: distanceText,
              confidence: hasDecimal ? 0.9 : 0.6, // Give it good but not perfect confidence
              details: {
                source: 'api_pre_extracted',
                hasDecimal: hasDecimal
              }
            })
            console.log(`📏 Added pre-extracted distance: ${distanceValue}m (decimal: ${hasDecimal ? '✓' : '✗'})`)
          } else {
            console.log(`⚠️ Ignoring pre-extracted distance "${distanceText}" - no decimal and doesn't look like a proper distance`)
          }
        }
      }
    }

    // ALWAYS try to extract from OCR text, even if we have pre-extracted
    // This will find better options like "4.0m" or "002.34m"
    if (predictions.text.length > 0) {
      console.log('📍 Extracting distances from OCR text (will merge with any pre-extracted)...')
      const extractedDistances = this.extractDistances(predictions.text)
      
      // Merge with any pre-extracted distances
      predictions.distances = [...predictions.distances, ...extractedDistances]
      
      // Remove duplicates and keep best confidence for each value
      const distanceMap = new Map()
      predictions.distances.forEach(dist => {
        const key = Math.round(dist.value * 100) / 100 // Round to 2 decimals for comparison
        if (!distanceMap.has(key) || dist.confidence > distanceMap.get(key).confidence) {
          distanceMap.set(key, dist)
        }
      })
      predictions.distances = Array.from(distanceMap.values())
      
      // Sort by confidence
      predictions.distances.sort((a, b) => b.confidence - a.confidence)
      
      // Apply additional filtering if we have multiple distances
      if (predictions.distances.length > 1) {
        console.log('🔍 Multiple distances found, applying smart selection...')
        
        // Filter out unlikely distances
        const filteredDistances = predictions.distances.filter(dist => {
          // Remove very low confidence distances if we have better options
          const hasHighConfidence = predictions.distances.some(d => d.confidence > 0.7)
          if (hasHighConfidence && dist.confidence < 0.5) {
            console.log(`  Filtering out low confidence: ${dist.value}m (${dist.confidence})`)
            return false
          }
          
          return true
        })
        
        predictions.distances = filteredDistances.length > 0 ? filteredDistances : predictions.distances
      }
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
   * Main analysis function with enhanced distance selection
   */
  async analyzeImage(imageFile) {
    if (!this.isEnabled) {
      throw new Error('AI analysis is disabled')
    }

    if (!this.apiKey) {
      throw new Error('AI API key not configured')
    }

    console.log('🚀 Starting AI analysis with enhanced distance extraction...')

    try {
      const imageBase64 = await this.imageToBase64(imageFile)
      console.log('🖼️ Image converted to base64, length:', imageBase64.length)
      
      const predictions = await this.callRunPodAPI(imageBase64)
      
      // Get the best distance with enhanced selection
      const bestDistance = predictions.distances.length > 0 
        ? predictions.distances.reduce((best, current) => {
            // Prefer distances with:
            // 1. Higher confidence
            // 2. Decimal points (more precise)
            // 3. Top or bottom position (if confidence is similar)
            // 4. Format that includes 'M' suffix (if confidence is similar)
            
            const confidenceDiff = current.confidence - best.confidence
            
            // If confidence difference is significant (>0.1), use confidence
            if (Math.abs(confidenceDiff) > 0.1) {
              return current.confidence > best.confidence ? current : best
            }
            
            // If confidence is similar, prefer distances with decimal points
            if (current.details && best.details) {
              const currentHasDecimal = current.details.hasDecimal || false
              const bestHasDecimal = best.details.hasDecimal || false
              
              if (currentHasDecimal && !bestHasDecimal) {
                console.log(`  Preferring ${current.value} (has decimal) over ${best.value}`)
                return current
              } else if (!currentHasDecimal && bestHasDecimal) {
                return best
              }
              
              // If both have or don't have decimals, prefer top/bottom position
              const currentPosScore = current.details.positionScore || 0
              const bestPosScore = best.details.positionScore || 0
              if (currentPosScore > bestPosScore) {
                return current
              }
            }
            
            return best
          })
        : null

      // Log the selected distance
      if (bestDistance) {
        const decimalInfo = bestDistance.details?.hasDecimal ? ' [DECIMAL]' : ''
        console.log(`🎯 Selected best distance: ${bestDistance.value}m with confidence ${bestDistance.confidence}${decimalInfo}`)
        if (bestDistance.details) {
          console.log(`   Pattern: ${bestDistance.details.patternName}, Position score: ${bestDistance.details.positionScore?.toFixed(2)}`)
        }
      }

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
      if (predictions.distances.length > 0) {
        console.log('🎉 All distances found:', predictions.distances.map(d => {
          const decimal = d.details?.hasDecimal ? '✓' : '✗'
          return `${d.value}m (conf: ${d.confidence}, decimal: ${decimal}, pattern: ${d.details?.patternName || 'unknown'})`
        }).join(', '))
      }

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