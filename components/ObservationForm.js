'use client'

import { useState, useEffect } from 'react'
import { X, Upload, Camera, Save, AlertCircle, Bot, Zap, Clock, CheckCircle, Coins } from 'lucide-react'
import { 
  getObservationCodes, 
  getCodeDetails, 
  createObservation, 
  updateObservation,
  validateObservation 
} from '../lib/observations.js'
import { supabase } from '../lib/supabase.js'
import { getAIService, getUserAISettings } from '../lib/ai-service.js'
import { checkCredits, consumeCredits, calculateCreditsRequired } from '../lib/credits.js'
import { useAuth } from '../lib/auth-context.js'
// Import the B2 upload server action
import { getB2ImageUploadUrl } from '../lib/actions/observation-image-upload.js'

// Import HelpIcon component
import HelpIcon from '@/components/help/HelpIcon'

export default function ObservationForm({ 
  sectionId, 
  videoRef, 
  videoTimestamp = 0,
  shouldAutoCapture = false,
  initialData = null, 
  isOpen, 
  onClose, 
  onSave 
}) {
  const { user, company, refreshProfile } = useAuth()
  
  const [formData, setFormData] = useState({
    name: '',
    distance: '',
    code: '',
    description: '',
    band: '',
    material: '',
    type: '',
    is_at_joint: false,
    clock_ref_1: '',
    clock_ref_2: '',
    loss_percentage: '',
    dimension_1: '',
    dimension_2: '',
    video_ref: '',
    photo_ref: '',
    cont_def: false,
    continuous_defect_starts: false,
    continuous_defect_ends: false,
    severity: '',
    remarks: '',
    image_url: '',
    video_timestamp: videoTimestamp
  })

  const [codes, setCodes] = useState([])
  const [selectedCodeDetails, setSelectedCodeDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [aiSettingsLoading, setAISettingsLoading] = useState(false)
  const [aiSettingsError, setAISettingsError] = useState(null)

  // AI Toggle State - persistent across sessions
  const [aiAnalysisEnabled, setAiAnalysisEnabled] = useState(() => {
    // Load from localStorage, default to true if not set
    try {
      const saved = localStorage.getItem('aiAnalysisEnabled')
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true // Fallback if localStorage fails
    }
  })

  // Dynamic pricing states
  const [creditsPerCapture, setCreditsPerCapture] = useState(1)
  const [creditsPerUpload, setCreditsPerUpload] = useState(1)
  const [creditsPerAI, setCreditsPerAI] = useState(5)
  const [pricingLoading, setPricingLoading] = useState(true)

  // AI Integration States
  const [aiSettings, setAISettings] = useState(null)
  const [aiProcessing, setAIProcessing] = useState(false)
  const [aiResults, setAIResults] = useState(null)
  const [aiPopulatedFields, setAIPopulatedFields] = useState({})
  const [showAIResults, setShowAIResults] = useState(false)

  // Load pricing rules when modal opens
  useEffect(() => {
    const loadPricingRules = async () => {
      if (!isOpen) return
      
      setPricingLoading(true)
      try {
        // Load pricing for image capture
        const captureResult = await calculateCreditsRequired('image_capture', { count: 1 })
        setCreditsPerCapture(captureResult.credits)
        
        // Load pricing for image upload
        const uploadResult = await calculateCreditsRequired('image_upload', { count: 1 })
        setCreditsPerUpload(uploadResult.credits)
        
        // Load pricing for AI analysis
        const aiResult = await calculateCreditsRequired('ai_inference', { count: 1 })
        setCreditsPerAI(aiResult.credits)
      } catch (error) {
        console.error('Error loading pricing rules:', error)
        // Use defaults if loading fails
        setCreditsPerCapture(1)
        setCreditsPerUpload(1)
        setCreditsPerAI(5)
      } finally {
        setPricingLoading(false)
      }
    }
    
    loadPricingRules()
  }, [isOpen])

  // Load AI settings when modal opens (not on component mount)
  useEffect(() => {
    const loadAISettings = async () => {
      if (!isOpen) return // Only load when modal is open
      
      try {
        console.log('🔄 Loading AI settings...')
        setAISettingsLoading(true)
        setAISettingsError(null)
        
        const settings = await getUserAISettings()
        console.log('✅ AI settings loaded:', settings)
        setAISettings(settings)
        
        // Don't override user's toggle preference - keep it persistent
        
        // Check if AI is properly configured
        if (settings?.ai_enabled && !settings?.runpod_api_key) {
          console.warn('⚠️ AI is enabled but no API key configured')
          setAISettingsError('AI enabled but API key not configured')
        }
      } catch (error) {
        console.error('❌ Failed to load AI settings:', error)
        setAISettingsError(error.message)
        // Set default disabled settings on error
        setAISettings({
          ai_enabled: false,
          auto_populate_enabled: true,
          confidence_threshold: 0.7,
          distance_ocr_enabled: true,
          object_detection_enabled: true,
          runpod_api_key: null
        })
        setAiAnalysisEnabled(false)
      } finally {
        setAISettingsLoading(false)
      }
    }
    
    loadAISettings()
  }, [isOpen]) // Only depend on isOpen

  // Handle AI toggle change and persist to localStorage
  const handleAIToggleChange = (enabled) => {
    setAiAnalysisEnabled(enabled)
    try {
      localStorage.setItem('aiAnalysisEnabled', JSON.stringify(enabled))
      console.log('💾 AI toggle preference saved:', enabled)
    } catch (error) {
      console.warn('Failed to save AI toggle preference:', error)
    }
  }

  // Load observation codes on modal open
  useEffect(() => {
    const loadData = async () => {
      if (isOpen) {
        try {
          const codesData = await getObservationCodes()
          setCodes(codesData)
        } catch (error) {
          console.error('Failed to load observation codes:', error)
        }
      }
    }
    
    loadData()
  }, [isOpen])

  // Initialize form with existing data if editing
  useEffect(() => {
    if (initialData) {
      console.log('Initializing form with editing data:', initialData)
      
      setFormData({
        name: initialData.name || '',
        distance: initialData.distance || '',
        code: initialData.code || '',
        description: initialData.description || '',
        band: initialData.band || '',
        material: initialData.material || '',
        type: initialData.type || '',
        is_at_joint: initialData.is_at_joint || false,
        clock_ref_1: initialData.clock_ref_1 || '',
        clock_ref_2: initialData.clock_ref_2 || '',
        loss_percentage: initialData.loss_percentage || '',
        dimension_1: initialData.dimension_1 || '',
        dimension_2: initialData.dimension_2 || '',
        video_ref: initialData.video_ref || '',
        photo_ref: initialData.photo_ref || '',
        cont_def: initialData.cont_def || false,
        continuous_defect_starts: initialData.continuous_defect_starts || false,
        continuous_defect_ends: initialData.continuous_defect_ends || false,
        severity: initialData.severity || '',
        remarks: initialData.remarks || '',
        image_url: initialData.image_url || '',
        video_timestamp: initialData.video_timestamp || videoTimestamp,
        coordinates: initialData.coordinates || null,
        metadata: initialData.metadata || null
      })
      
      if (initialData.image_url) {
        setImagePreview(initialData.image_url)
      }
    }
  }, [initialData, videoTimestamp])

  // Load code details when code changes
  useEffect(() => {
    const loadCodeDetails = async () => {
      if (formData.code) {
        try {
          const details = await getCodeDetails(formData.code)
          setSelectedCodeDetails(details)
          
          // Update description automatically
          setFormData(prev => {
            const newName = prev.distance ? `${formData.code} at ${prev.distance}m` : formData.code
            console.log('Code changed, setting name to:', newName)
            
            const newSeverity = (!prev.severity && details.default_severity) ? details.default_severity.toString() : prev.severity
            
            return {
              ...prev,
              description: details.description,
              name: newName,
              severity: newSeverity
            }
          })
        } catch (error) {
          console.error('Failed to load code details:', error)
        }
      } else {
        setSelectedCodeDetails(null)
      }
    }
    
    loadCodeDetails()
  }, [formData.code])

  // Update name when distance changes
  useEffect(() => {
    if (formData.code && formData.distance) {
      const newName = `${formData.code} at ${formData.distance}m`
      console.log('Auto-generating name:', newName)
      setFormData(prev => ({
        ...prev,
        name: newName
      }))
    } else if (formData.code && !formData.distance) {
      console.log('Setting name to code:', formData.code)
      setFormData(prev => ({
        ...prev,
        name: formData.code
      }))
    }
  }, [formData.distance, formData.code])

  // Clear image preview when modal closes
  useEffect(() => {
    if (!isOpen) {
      setImagePreview('')
      setImageFile(null)
      setAIResults(null)
      setAIPopulatedFields({})
      setShowAIResults(false)
      setAISettingsError(null)
    }
  }, [isOpen])

  // Auto-hide success notifications after 5 seconds
  useEffect(() => {
    if (showAIResults && aiResults?.success) {
      const timer = setTimeout(() => {
        setShowAIResults(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [showAIResults, aiResults?.success])

  // Auto-capture frame when modal opens with video reference
  useEffect(() => {
    const autoCapture = async () => {
      console.log('=== AUTO-CAPTURE DEBUG ===')
      console.log('Auto-capture conditions:', { 
        isOpen, 
        shouldAutoCapture,
        hasVideoRef: !!videoRef?.current, 
        hasImagePreview: !!imagePreview,
        aiSettingsLoading,
        aiSettings: !!aiSettings,
        pricingLoading
      })
      
      // Wait for AI settings and pricing to load before auto-capturing
      if (isOpen && shouldAutoCapture && videoRef?.current && !imagePreview && !aiSettingsLoading && aiSettings !== null && !pricingLoading) {
        console.log('✅ All conditions met - executing auto-capture')
        
        // Small delay to ensure UI is ready
        setTimeout(() => {
          console.log('⏱️ Executing auto-capture now...')
          handleCaptureFrame()
        }, 300) // Increased delay slightly
      }
    }

    autoCapture()
  }, [isOpen, shouldAutoCapture, imagePreview, aiSettingsLoading, aiSettings, pricingLoading])

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: value
      }
      
      // Auto-generate name when distance or code changes
      if (field === 'distance' || field === 'code') {
        const code = field === 'code' ? value : prev.code
        const distance = field === 'distance' ? value : prev.distance
        
        if (code && distance) {
          updated.name = `${code} at ${distance}m`
          console.log('Auto-generated name:', updated.name)
        } else if (code) {
          updated.name = code
          console.log('Set name to code:', updated.name)
        }
      }
      
      return updated
    })
    
    // Clear field from AI populated tracking if user manually changes it
    if (aiPopulatedFields[field]) {
      setAIPopulatedFields(prev => {
        const updated = { ...prev }
        delete updated[field]
        return updated
      })
    }
    
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([])
    }
  }

  /**
   * Upload image to Backblaze B2
   */
  const uploadToB2 = async (file, observationId) => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (!userId) throw new Error('User not authenticated')

      // Get upload URL and auth token from server action
      const { uploadUrl, authToken, key, publicUrl } = await getB2ImageUploadUrl(
        userId,
        observationId,
        file.name
      )

      // Upload directly to B2 using native B2 API
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: file,
        headers: {
          'Authorization': authToken,
          'X-Bz-File-Name': encodeURIComponent(key),
          'Content-Type': file.type || 'image/jpeg',
          'X-Bz-Content-Sha1': 'do_not_verify' // Skip SHA1 verification for simplicity
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('B2 upload error:', errorText)
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      console.log('✅ Image uploaded to B2:', publicUrl)
      return publicUrl
    } catch (error) {
      console.error('Failed to upload image to B2:', error)
      throw error
    }
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files[0]
    if (file) {
      // Check credits before processing
      if (company?.id) {
        const hasCredits = await checkCredits(company.id, creditsPerUpload)
        if (!hasCredits) {
          setErrors([`Insufficient credits. You need ${creditsPerUpload} credit${creditsPerUpload > 1 ? 's' : ''} to upload an image.`])
          // Clear the file input
          event.target.value = ''
          return
        }
      }
      
      setImageFile(file)
      const preview = URL.createObjectURL(file)
      setImagePreview(preview)
      
      // Consume credits for upload
      if (company?.id && user?.id) {
        try {
          await consumeCredits(
            company.id, 
            user.id, 
            creditsPerUpload, 
            'image_upload', 
            `Image upload: ${file.name}`
          )
          await refreshProfile() // Update UI
          console.log('💰 Credits consumed for image upload')
        } catch (error) {
          console.error('Failed to consume credits:', error)
          // Don't fail the upload, just log the error
        }
      }
      
      // Trigger AI analysis if enabled, configured, AND toggle is on
      if (aiAnalysisEnabled && aiSettings?.ai_enabled && aiSettings?.runpod_api_key) {
        console.log('🤖 Triggering AI analysis on image upload (toggle enabled)')
        performAIAnalysis(file)
      } else {
        console.log('⭐ Skipping AI analysis:', {
          toggleEnabled: aiAnalysisEnabled,
          settingsEnabled: aiSettings?.ai_enabled,
          hasKey: !!aiSettings?.runpod_api_key
        })
      }
    }
  }

  const handleCaptureFrame = async () => {
    console.log('ObservationForm handleCaptureFrame called')
    
    if (!videoRef?.current) {
      console.warn('No video reference available for frame capture')
      alert('No video available for frame capture')
      return
    }

    // Check credits before capture
    if (company?.id) {
      const hasCredits = await checkCredits(company.id, creditsPerCapture)
      if (!hasCredits) {
        setErrors([`Insufficient credits. You need ${creditsPerCapture} credit${creditsPerCapture > 1 ? 's' : ''} to capture a frame.`])
        return
      }
    }

    try {
      const video = videoRef.current
      
      if (videoTimestamp !== null && videoTimestamp !== undefined) {
        video.currentTime = videoTimestamp
        console.log('Set video timestamp to:', videoTimestamp)
        
        await new Promise((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video.addEventListener('seeked', onSeeked)
        })
      }
      
      console.log('Video ready for capture:', { 
        videoWidth: video.videoWidth, 
        videoHeight: video.videoHeight,
        currentTime: video.currentTime
      })
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        alert('Video not ready for frame capture. Please wait for video to load.')
        return
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      try {
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `frame_${Date.now()}.jpg`, { type: 'image/jpeg' })
            setImageFile(file)
            const preview = URL.createObjectURL(blob)
            setImagePreview(preview)
            
            const currentTime = video.currentTime
            setFormData(prev => ({
              ...prev,
              video_timestamp: currentTime,
              video_ref: `Frame at ${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}`
            }))
            
            console.log('Frame captured successfully')
            
            // Consume credits after successful capture
            if (company?.id && user?.id) {
              try {
                await consumeCredits(
                  company.id, 
                  user.id, 
                  creditsPerCapture, 
                  'image_capture', 
                  `Frame capture at ${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}`
                )
                await refreshProfile() // Update UI
                console.log('💰 Credits consumed for frame capture')
              } catch (error) {
                console.error('Failed to consume credits:', error)
                // Don't fail the capture, just log the error
              }
            }
            
            // Trigger AI analysis if enabled, configured, AND toggle is on
            if (aiAnalysisEnabled && aiSettings?.ai_enabled && aiSettings?.runpod_api_key) {
              console.log('🤖 Triggering AI analysis on captured frame (toggle enabled)')
              performAIAnalysis(file)
            } else {
              console.log('⭐ Skipping AI analysis - toggle disabled or not configured')
            }
          } else {
            throw new Error('Failed to create blob')
          }
        }, 'image/jpeg', 0.8)
      } catch (corsError) {
        console.error('CORS error during blob creation:', corsError)
        
        // Try fallback method
        try {
          const dataURL = canvas.toDataURL('image/jpeg', 0.8)
          const blob = dataURLtoBlob(dataURL)
          const file = new File([blob], `frame_${Date.now()}.jpg`, { type: 'image/jpeg' })
          setImageFile(file)
          setImagePreview(dataURL)
          
          const currentTime = video.currentTime
          setFormData(prev => ({
            ...prev,
            video_timestamp: currentTime,
            video_ref: `Frame at ${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}`
          }))
          
          console.log('Frame captured using fallback method')
          
          // Consume credits after successful capture
          if (company?.id && user?.id) {
            try {
              await consumeCredits(
                company.id, 
                user.id, 
                creditsPerCapture, 
                'image_capture', 
                `Frame capture at ${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}`
              )
              await refreshProfile() // Update UI
              console.log('💰 Credits consumed for frame capture (fallback)')
            } catch (error) {
              console.error('Failed to consume credits:', error)
            }
          }
          
          // Trigger AI analysis if configured AND toggle is on
          if (aiAnalysisEnabled && aiSettings?.ai_enabled && aiSettings?.runpod_api_key) {
            console.log('🤖 Triggering AI analysis on captured frame (fallback, toggle enabled)')
            performAIAnalysis(file)
          }
        } catch (fallbackError) {
          console.error('Fallback capture also failed:', fallbackError)
          alert('Frame capture failed due to CORS restrictions.')
        }
      }
    } catch (error) {
      console.error('Failed to capture frame:', error)
      alert('Failed to capture video frame: ' + error.message)
    }
  }

  // AI Analysis Function - works with B2 URLs
  const performAIAnalysis = async (imageFile, customAISettings = null) => {
    const settings = customAISettings || aiSettings
    
    if (!settings?.ai_enabled || !settings?.runpod_api_key) {
      console.log('AI analysis skipped:', {
        enabled: settings?.ai_enabled,
        hasKey: !!settings?.runpod_api_key
      })
      return
    }

    // Check credits before AI analysis
    if (company?.id) {
      const hasCredits = await checkCredits(company.id, creditsPerAI)
      if (!hasCredits) {
        setErrors([`Insufficient credits. You need ${creditsPerAI} credits for AI analysis.`])
        return
      }
    }

    console.log('🤖 Starting AI analysis...')
    setAIProcessing(true)
    setAIResults(null)
    setShowAIResults(false)

    try {
      // Get AI service instance
      const aiService = getAIService(settings.runpod_api_key)
      aiService.setEnabled(true)

      // Analyze the image with timeout
      const analysisResult = await aiService.analyzeImage(imageFile)
      
      console.log('🔍 AI Analysis Result:', analysisResult)
      setAIResults(analysisResult)

      if (analysisResult.success) {
        // Auto-populate fields if enabled
        if (settings.auto_populate_enabled) {
          await populateFieldsFromAI(analysisResult.suggestions, settings)
        }
        
        // Consume credits after successful AI analysis
        if (company?.id && user?.id) {
          try {
            await consumeCredits(
              company.id, 
              user.id, 
              creditsPerAI, 
              'ai_inference', 
              'AI object detection and OCR analysis'
            )
            await refreshProfile() // Update UI
            console.log('💰 Credits consumed for AI analysis')
          } catch (error) {
            console.error('Failed to consume credits:', error)
          }
        }
      }
      
      // Always show results after processing completes
      setShowAIResults(true)

    } catch (error) {
      console.error('❌ AI analysis error:', error)
      setAIResults({
        success: false,
        error: error.message,
        suggestions: { distance: null, observationCode: null, confidence: 0 }
      })
      setShowAIResults(true)
    } finally {
      setAIProcessing(false)
    }
  }

  // Manual AI Analysis Function (for the button)
  const handleManualAIAnalysis = async () => {
    if (!imageFile && !imagePreview) {
      setErrors(['Please capture or upload an image first.'])
      return
    }

    await performAIAnalysis(imageFile || imagePreview)
  }

  // Populate form fields from AI suggestions
  const populateFieldsFromAI = async (suggestions, customAISettings = null) => {
    const settings = customAISettings || aiSettings
    const fieldsToPopulate = {}
    let fieldsPopulated = false

    // Populate distance from OCR if found
    if (suggestions.distance && settings.distance_ocr_enabled) {
      setFormData(prev => ({ ...prev, distance: suggestions.distance.toString() }))
      fieldsToPopulate.distance = suggestions.distance
      fieldsPopulated = true
      console.log('🎯 AI populated distance:', suggestions.distance)
    }

    // Populate observation code from object detection if found
    if (suggestions.observationCode && settings.object_detection_enabled) {
      setFormData(prev => ({ ...prev, code: suggestions.observationCode }))
      fieldsToPopulate.code = suggestions.observationCode
      fieldsPopulated = true
      console.log('🎯 AI populated code:', suggestions.observationCode)
    }

    setAIPopulatedFields(fieldsToPopulate)
    
    if (fieldsPopulated) {
      console.log('✨ AI successfully populated fields!')
    }
  }

  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  const handleSave = async () => {
    setLoading(true)
    setErrors([])

    try {
      const validationErrors = validateObservation(formData, selectedCodeDetails)
      if (validationErrors.length > 0) {
        setErrors(validationErrors)
        setLoading(false)
        return
      }

      let imageUrl = formData.image_url

      // Upload image to B2 if we have a new file
      if (imageFile) {
        try {
          setImageUploading(true)
          const tempId = initialData?.id || `temp_${Date.now()}`
          imageUrl = await uploadToB2(imageFile, tempId)
          setImageUploading(false)
        } catch (error) {
          console.error('Failed to upload image to B2:', error)
          setImageUploading(false)
          alert('Failed to upload image, but observation will be saved without it')
        }
      }

      const observationData = {
        name: formData.name?.trim() || 
              (formData.code && formData.distance ? `${formData.code} at ${formData.distance}m` : 
               formData.code || 
               `Observation at ${formData.distance || 0}m`),
        distance: formData.distance !== '' && formData.distance !== null && formData.distance !== undefined 
          ? parseFloat(formData.distance) 
          : null,
        code: formData.code || null,
        description: formData.description || null,
        band: formData.band || null,
        material: formData.material || null,
        type: formData.type || null,
        is_at_joint: formData.is_at_joint || false,
        clock_ref_1: formData.clock_ref_1 || null,
        clock_ref_2: formData.clock_ref_2 || null,
        loss_percentage: formData.loss_percentage ? parseFloat(formData.loss_percentage) : null,
        dimension_1: formData.dimension_1 ? parseFloat(formData.dimension_1) : null,
        dimension_2: formData.dimension_2 ? parseFloat(formData.dimension_2) : null,
        video_ref: formData.video_ref || null,
        photo_ref: formData.photo_ref || null,
        cont_def: formData.cont_def || false,
        continuous_defect_starts: formData.continuous_defect_starts || false,
        continuous_defect_ends: formData.continuous_defect_ends || false,
        severity: formData.severity ? parseInt(formData.severity) : null,
        remarks: formData.remarks || null,
        image_url: imageUrl,
        video_timestamp: formData.video_timestamp || null,
        coordinates: formData.coordinates || null,
        metadata: formData.metadata || null
      }

      console.log('Saving observation:', observationData)

      let result
      if (initialData?.id) {
        result = await updateObservation(initialData.id, observationData)
      } else {
        result = await createObservation(sectionId, observationData)
      }

      onSave(result)
      onClose()
    } catch (error) {
      console.error('Failed to save observation:', error)
      setErrors(['Failed to save observation. Please try again.'])
    } finally {
      setLoading(false)
      setImageUploading(false)
    }
  }

  // Helper function to generate display text for observation preview
  const generateObservationDisplay = () => {
    if (!selectedCodeDetails) return formData.name || 'New Observation'
    
    let displayParts = [formData.code]
    
    if (formData.distance) displayParts.push(`at ${formData.distance}m`)
    if (formData.band) displayParts.push(`Band ${formData.band}`)
    if (formData.material) displayParts.push(`${formData.material}`)
    if (formData.type) displayParts.push(`${formData.type}`)
    if (formData.is_at_joint) displayParts.push('at Joint')
    if (formData.loss_percentage) displayParts.push(`${formData.loss_percentage}% loss`)
    if (formData.clock_ref_1) {
      if (formData.clock_ref_2) {
        displayParts.push(`${formData.clock_ref_1}/${formData.clock_ref_2}`)
      } else {
        displayParts.push(`${formData.clock_ref_1}`)
      }
    }
    if (formData.dimension_1) {
      if (formData.dimension_2) {
        displayParts.push(`${formData.dimension_1}x${formData.dimension_2}`)
      } else {
        displayParts.push(`${formData.dimension_1}`)
      }
    }
    
    return displayParts.join(' ')
  }

  const groupedCodes = codes.reduce((groups, code) => {
    const category = code.category || 'Other'
    if (!groups[category]) groups[category] = []
    groups[category].push(code)
    return groups
  }, {})

  // Check if AI can be enabled
  const canEnableAI = aiSettings?.ai_enabled && aiSettings?.runpod_api_key

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[95vh] flex flex-col">
        {/* COMPACT HEADER */}
        <div className="flex items-center justify-between p-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {initialData ? 'Edit' : shouldAutoCapture ? 'New from Frame' : 'New'} Observation
            </h2>
            <HelpIcon
              title="Recording Observations"
              content="Document defects and conditions found during your inspection. Each observation is linked to the current video timestamp and section."
              bullets={[
                "Select appropriate observation code for the defect",
                "Set severity level based on urgency",
                "Capture or upload evidence images",
                "Toggle AI analysis on/off to control credit usage (setting saved)",
                "AI may be slow on the first observation",
                "AI can auto-detect defects on clear, quality images",
                "AI can read text on clean well contrasted backgrounds",
                "AI recognises formats such as 00.00M quickly",
                "AI is quicker if these recommendations are met",
                "All observations appear in the final report"
              ]}
              size="sm"
            />
            {aiSettings?.ai_enabled && <Bot className="w-4 h-4 text-blue-600" />}
            {aiProcessing && <div className="w-4 h-4 animate-spin border-2 border-blue-600 border-t-transparent rounded-full" />}
            {imageUploading && <span className="text-sm text-gray-600">Uploading to B2...</span>}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* COMPACT NOTIFICATIONS */}
        {(errors.length > 0 || showAIResults || aiSettingsError) && (
          <div className="p-2 space-y-2 bg-gray-50 border-b">
            {errors.length > 0 && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-red-800">Errors: </span>
                    <span className="text-red-700">{errors.join(', ')}</span>
                  </div>
                </div>
              </div>
            )}

            {aiSettingsError && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-yellow-800">AI Setup: </span>
                    <span className="text-yellow-700">{aiSettingsError}</span>
                  </div>
                </div>
              </div>
            )}

            {showAIResults && aiResults && (
              <div className={`p-2 border rounded text-sm ${
                aiResults.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {aiResults.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-600" />
                    )}
                    <span className={`font-medium ${
                      aiResults.success ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      AI: {aiResults.success ? 'Analysis Complete' : 'Timeout'}
                    </span>
                    {aiResults.success && (
                      <span className={`text-xs ${
                        aiResults.success ? 'text-green-700' : 'text-yellow-700'
                      }`}>
                        {aiResults.suggestions.distance && `📏 ${aiResults.suggestions.distance}m`}
                        {aiResults.suggestions.observationCode && ` 🎯 ${aiResults.suggestions.observationCode}`}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setShowAIResults(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CREDIT COSTS INFO */}
        {company && !pricingLoading && (
          <div className="px-4 pt-2 pb-0">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Coins className="w-3 h-3" />
              <span>
                Credit costs: Frame capture ({creditsPerCapture}), 
                Image upload ({creditsPerUpload})
                {aiAnalysisEnabled && canEnableAI && `, AI analysis (${creditsPerAI})`}
              </span>
              <HelpIcon
                title="Credit Usage"
                content="Different operations consume credits from your balance."
                bullets={[
                  `Frame capture: ${creditsPerCapture} credit${creditsPerCapture > 1 ? 's' : ''}`,
                  `Image upload: ${creditsPerUpload} credit${creditsPerUpload > 1 ? 's' : ''}`,
                  `AI analysis: ${creditsPerAI} credits (when enabled)`,
                  "Saving observation: Free",
                  "Toggle AI analysis to control costs (setting remembered)",
                  "AI might be slow on the first analysis",
                  "Purchase more: Account → Subscription"
                ]}
                size="sm"
              />
            </div>
          </div>
        )}

        {/* SCROLLABLE CONTENT - VERTICAL LAYOUT */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            
            {/* IMAGE SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-900">Image</h4>
                  <HelpIcon
                    title="Evidence Capture"
                    content="Visual evidence strengthens your observation and helps in report generation."
                    bullets={[
                      "Capture frame: Grabs current video frame at timestamp",
                      "Upload image: Add external photos from device",
                      "Toggle AI analysis to control credit usage (remembered)",
                      "Clear distance and image quality improve AI analysis speed",
                      "Images are compressed and stored in cloud",
                      "Multiple images can be attached to one observation"
                    ]}
                    size="sm"
                  />
                </div>
                
                {/* AI TOGGLE SECTION */}
                <div className="flex items-center gap-3">
                  {aiSettingsLoading ? (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <div className="w-3 h-3 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
                      Loading AI...
                    </span>
                  ) : canEnableAI ? (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiAnalysisEnabled}
                          onChange={(e) => handleAIToggleChange(e.target.checked)}
                          className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <Bot className="w-3 h-3 text-blue-600" />
                        <span className="text-blue-600 font-medium">
                          AI Analysis ({creditsPerAI} credits)
                        </span>
                      </label>
                      <HelpIcon
                        title="AI Analysis Toggle"
                        content="Control when AI analysis runs to manage credit usage. Your preference is saved automatically."
                        bullets={[
                          "Toggle ON: AI runs automatically after capture/upload",
                          "Toggle OFF: No AI analysis, save credits",
                          "Setting is remembered until you change it",
                          `Cost: ${creditsPerAI} credits per analysis`,
                          "Detects operational defects: Roots, deposits, obstructions, etc",
                          "Detects structural defects: Cracks, fractures, breaks, holes, collapses, roots, displaced or open joints, sealing rings, etc",
                          "Detects construction and miscellaneous observations: Junctions, connections, etc",
                          "OCR: Reads distance markers and text",
                          "Contrasting text backgrounds work best",
                          "Auto-populates relevant fields when successful",
                          "Can also run manually after capture"
                        ]}
                        size="sm"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">
                      AI {aiSettings?.ai_enabled ? 'missing API key' : 'disabled'}
                    </span>
                  )}
                </div>
              </div>
              
              {/* ACTION BUTTONS */}
              <div className="flex gap-2">
                {videoRef && (
                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    disabled={aiProcessing || pricingLoading}
                  >
                    <Camera className="w-4 h-4" />
                    {shouldAutoCapture ? 'Re-capture' : 'Capture'} 
                    {!pricingLoading && ` (${creditsPerCapture} credit${creditsPerCapture > 1 ? 's' : ''})`}
                  </button>
                )}
                <label className="flex items-center justify-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded cursor-pointer text-sm hover:bg-gray-700">
                  <Upload className="w-4 h-4" />
                  Upload
                  {!pricingLoading && ` (${creditsPerUpload} credit${creditsPerUpload > 1 ? 's' : ''})`}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={aiProcessing || pricingLoading}
                  />
                </label>
                
                {/* MANUAL AI ANALYSIS BUTTON */}
                {canEnableAI && imagePreview && !aiAnalysisEnabled && (
                  <button
                    type="button"
                    onClick={handleManualAIAnalysis}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    disabled={aiProcessing}
                  >
                    <Bot className="w-4 h-4" />
                    Run AI ({creditsPerAI} credits)
                  </button>
                )}
              </div>

              {/* IMAGE PREVIEW - Fixed to show full image */}
              {imagePreview ? (
                <div className="border rounded bg-gray-50 relative">
                  <img
                    src={imagePreview}
                    alt="Observation"
                    className="w-full h-48 object-contain rounded"
                  />
                  {aiProcessing && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded">
                      <div className="bg-white rounded-lg p-3 flex items-center gap-2">
                        <div className="w-5 h-5 animate-spin border-2 border-blue-600 border-t-transparent rounded-full" />
                        <span className="text-sm font-medium">AI Processing...</span>
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 p-1 text-center">
                    {shouldAutoCapture ? 'Frame captured' : 'Image uploaded'}
                    {formData.image_url && formData.image_url.includes('backblazeb2.com') && ' (B2)'}
                    {aiAnalysisEnabled && canEnableAI && (
                      <span className="text-blue-600"> • AI enabled</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded p-4 text-center text-gray-500 text-sm h-48 flex items-center justify-center">
                  {shouldAutoCapture && !imagePreview && (aiSettingsLoading || pricingLoading) ? (
                    <div className="text-gray-600">⏳ Loading settings...</div>
                  ) : shouldAutoCapture && !imagePreview && !aiSettingsLoading && !pricingLoading ? (
                    <div className="text-blue-600">📸 Ready to capture...</div>
                  ) : (
                    <div>No image selected</div>
                  )}
                </div>
              )}
            </div>

            {/* Rest of the form remains the same... */}
            {/* PREVIEW */}
            {selectedCodeDetails && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                <span className="font-medium text-blue-800">Preview: </span>
                <span className="text-blue-700">{generateObservationDisplay()}</span>
              </div>
            )}

            {/* CORE FIELDS */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-1">
                    Distance (m) *
                    {aiPopulatedFields.distance && <Zap className="w-3 h-3 inline text-blue-600" title="AI populated" />}
                    <HelpIcon
                      title="Distance Measurement"
                      content="Distance from the start point of this section (usually a manhole)."
                      bullets={[
                        "Measured in meters from section start",
                        "Can be read from video overlay",
                        "AI can auto-detect from distance markers",
                        "Contrasting text backgrounds work best",
                        "Recognises text formats such as 00.00M quickly",
                        "Used for accurate defect positioning",
                        "Appears on pipe graphic in reports"
                      ]}
                      size="sm"
                    />
                  </div>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.distance}
                  onChange={(e) => handleInputChange('distance', e.target.value)}
                  className={`w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    aiPopulatedFields.distance ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-1">
                    Severity
                    {selectedCodeDetails?.default_severity && <span className="text-gray-500"> (def: {selectedCodeDetails.default_severity})</span>}
                    <HelpIcon
                      title="Severity Levels"
                      content="Rate the urgency and impact of the defect to prioritize repairs."
                      bullets={[
                        "1 - Minor: Small defect for future maintenance",
                        "2 - Low: Notable but not urgent",
                        "3 - Medium: Should be addressed in planned maintenance",
                        "4 - High: Significant issue needing attention soon",
                        "5 - Critical: Immediate action required"
                      ]}
                      size="sm"
                    />
                  </div>
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => handleInputChange('severity', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="1">1 - Minor</option>
                  <option value="2">2 - Low</option>
                  <option value="3">3 - Medium</option>
                  <option value="4">4 - High</option>
                  <option value="5">5 - Critical</option>
                </select>
              </div>
            </div>

            {/* CODE SELECTION */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-1">
                  Code & Description *
                  {aiPopulatedFields.code && <Zap className="w-3 h-3 inline text-blue-600" title="AI populated" />}
                  <HelpIcon
                    title="Observation Codes"
                    content="Industry-standard codes for consistent defect classification."
                    bullets={[
                      "Codes follow WRc, MSCC or custom standards",
                      "Select the base code that best matches the defect",
                      "AI can suggest codes based on image analysis",
                      "Codes determine report formatting",
                      "Contact admin to add missing codes"
                    ]}
                    size="sm"
                  />
                </div>
              </label>
              <select
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                className={`w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  aiPopulatedFields.code ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                }`}
              >
                <option value="">Select code...</option>
                {Object.entries(groupedCodes).map(([category, categoryCodes]) => (
                  <optgroup key={category} label={category}>
                    {categoryCodes.map(code => (
                      <option key={code.id} value={code.code}>
                        {code.code} - {code.description}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* DYNAMIC FIELDS BASED ON CODE */}
            {selectedCodeDetails && (
              <div className="space-y-3 border-t pt-3">
                
                {/* OPTIONS GRID */}
                <div className="grid grid-cols-3 gap-2">
                  {selectedCodeDetails.band_options?.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Band</label>
                      <select
                        value={formData.band}
                        onChange={(e) => handleInputChange('band', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-</option>
                        {selectedCodeDetails.band_options.map(band => (
                          <option key={band} value={band}>{band}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedCodeDetails.material_options?.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Material</label>
                      <select
                        value={formData.material}
                        onChange={(e) => handleInputChange('material', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-</option>
                        {selectedCodeDetails.material_options.map(material => (
                          <option key={material} value={material}>{material}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedCodeDetails.type_options?.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => handleInputChange('type', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-</option>
                        {selectedCodeDetails.type_options.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* MEASUREMENTS GRID */}
                <div className="grid grid-cols-2 gap-2">
                  {selectedCodeDetails.clock_ref_count > 0 && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          <div className="flex items-center gap-1">
                            Clock 1
                            <HelpIcon
                              title="Clock Position"
                              content="Location around the pipe circumference, viewed from start point."
                              bullets={[
                                "12 o'clock = Top of pipe",
                                "3 o'clock = Right side",
                                "6 o'clock = Bottom of pipe",
                                "9 o'clock = Left side",
                                "Used for precise defect location"
                              ]}
                              size="sm"
                            />
                          </div>
                        </label>
                        <input
                          type="text"
                          value={formData.clock_ref_1}
                          onChange={(e) => handleInputChange('clock_ref_1', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="3"
                        />
                      </div>
                      {selectedCodeDetails.clock_ref_count === 2 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Clock 2</label>
                          <input
                            type="text"
                            value={formData.clock_ref_2}
                            onChange={(e) => handleInputChange('clock_ref_2', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="9"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {selectedCodeDetails.requires_loss_percentage && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        <div className="flex items-center gap-1">
                          % Loss
                          <HelpIcon
                            title="Percentage Loss"
                            content="Estimate the percentage of pipe capacity lost due to the defect."
                            bullets={[
                              "0-25%: Minor restriction",
                              "25-50%: Moderate restriction",
                              "50-75%: Severe restriction",
                              "75-100%: Near or total blockage"
                            ]}
                            size="sm"
                          />
                        </div>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.loss_percentage}
                        onChange={(e) => handleInputChange('loss_percentage', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                  )}

                  {selectedCodeDetails.dimension_options?.length > 0 && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {selectedCodeDetails.dimension_options[0] || 'Dim 1'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.dimension_1}
                          onChange={(e) => handleInputChange('dimension_1', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      {selectedCodeDetails.dimension_options.length > 1 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {selectedCodeDetails.dimension_options[1] || 'Dim 2'}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.dimension_2}
                            onChange={(e) => handleInputChange('dimension_2', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* CHECKBOXES */}
                <div className="flex flex-wrap gap-3 text-sm">
                  {selectedCodeDetails.requires_joint && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_at_joint}
                        onChange={(e) => handleInputChange('is_at_joint', e.target.checked)}
                        className="mr-1.5"
                      />
                      At Joint
                    </label>
                  )}
                  {selectedCodeDetails.continuous_defect_starts && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.continuous_defect_starts}
                        onChange={(e) => handleInputChange('continuous_defect_starts', e.target.checked)}
                        className="mr-1.5"
                      />
                      <span className="flex items-center gap-1">
                        Cont. Def. Starts
                        <HelpIcon
                          title="Continuous Defect"
                          content="Mark the start and end points of defects that extend over a distance."
                          bullets={[
                            "Check 'Starts' at the beginning of the defect",
                            "Check 'Ends' at the end of the defect",
                            "Used for long cracks, roots, or deposits",
                            "Report shows the full extent of the defect"
                          ]}
                          size="sm"
                        />
                      </span>
                    </label>
                  )}
                  {selectedCodeDetails.continuous_defect_ends && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.continuous_defect_ends}
                        onChange={(e) => handleInputChange('continuous_defect_ends', e.target.checked)}
                        className="mr-1.5"
                      />
                      Cont. Def. Ends
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* REMARKS */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-1">
                  Remarks <span className="text-gray-500">(max 50 chars)</span>
                  <HelpIcon
                    title="Adding Remarks"
                    content="Brief additional notes about the observation."
                    bullets={[
                      "Keep it concise (50 character limit)",
                      "Note any immediate risks",
                      "Mention repair recommendations",
                      "Include relevant context",
                      "Appears in observation details in report"
                    ]}
                    size="sm"
                  />
                </div>
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => handleInputChange('remarks', e.target.value)}
                maxLength={50}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                rows={2}
                placeholder="Brief remarks..."
              />
              <div className="text-xs text-gray-500 mt-1">{formData.remarks.length}/50</div>
            </div>
          </div>
        </div>

        {/* STICKY FOOTER WITH SAVE BUTTON */}
        <div className="flex justify-between items-center p-3 border-t bg-gray-50">
          <div className="text-xs text-gray-500">
            * Required fields: Distance, Code
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading || aiProcessing || imageUploading}
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || aiProcessing || imageUploading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : imageUploading ? 'Uploading...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}