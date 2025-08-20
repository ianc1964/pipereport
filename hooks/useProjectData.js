'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getObservations } from '@/lib/observations'

// Retry helper function
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      console.log(`Retry ${i + 1}/${maxRetries} failed:`, error.message)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))) // Exponential backoff
      }
    }
  }
  throw lastError
}

// Wait for auth with timeout
async function waitForAuth(timeout = 10000) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // Give a small delay to ensure auth context is fully loaded
        await new Promise(resolve => setTimeout(resolve, 500))
        return session.user
      }
    } catch (error) {
      console.log('Error getting session:', error)
    }
    
    // Check every 200ms
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  return null
}

export const useProjectData = (projectId, retryTrigger = 0) => {
  // Core data state
  const [project, setProject] = useState(null)
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Section-specific state
  const [activeSection, setActiveSection] = useState(null)
  const [sectionObservations, setSectionObservations] = useState({})
  const [allObservations, setAllObservations] = useState([])
  
  // UI state
  const [uploadingSectionId, setUploadingSectionId] = useState(null)
  const [deletingVideoId, setDeletingVideoId] = useState(null)
  const [deletingSectionId, setDeletingSectionId] = useState(null)

  // Track if we're currently loading to prevent duplicate calls
  const loadingRef = useRef(false)
  const mountedRef = useRef(true)

  // Helper function to get severity distribution for a section
  const getSeverityDistribution = (sectionId) => {
    const observations = sectionObservations[sectionId] || []
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 }
    
    observations.forEach(obs => {
      if (obs.severity >= 1 && obs.severity <= 2) distribution.low++
      else if (obs.severity === 3) distribution.medium++
      else if (obs.severity === 4) distribution.high++
      else if (obs.severity >= 5) distribution.critical++
    })
    
    return distribution
  }

  // Load all observations for sections with retry
  const loadAllObservations = async (sectionsData) => {
    const observationsMap = {}
    const allObs = []
    
    for (const section of sectionsData) {
      try {
        // Use retry for each observation load
        const observations = await retryOperation(
          () => getObservations(section.id),
          2, // 2 retries for observations
          500 // 500ms initial delay
        )
        observationsMap[section.id] = observations || []
        allObs.push(...(observations || []))
      } catch (error) {
        console.error(`Failed to load observations for section ${section.id} after retries:`, error)
        observationsMap[section.id] = []
      }
    }
    
    if (mountedRef.current) {
      setSectionObservations(observationsMap)
      setAllObservations(allObs)
    }
  }

  // Refresh section observations and update allObservations
  const refreshSectionObservations = async (sectionId) => {
    try {
      const observations = await retryOperation(
        () => getObservations(sectionId),
        2,
        500
      )
      
      if (mountedRef.current) {
        setSectionObservations(prev => ({
          ...prev,
          [sectionId]: observations || []
        }))
        
        // Also update allObservations
        setAllObservations(prev => {
          // Remove old observations from this section
          const filtered = prev.filter(obs => obs.section_id !== sectionId)
          // Add new observations
          return [...filtered, ...(observations || [])]
        })
      }
    } catch (error) {
      console.error(`Failed to refresh observations for section ${sectionId}:`, error)
    }
  }

  // Update sections state
  const updateSections = (updateFn) => {
    setSections(prev => {
      const updated = updateFn(prev)
      return updated.sort((a, b) => a.section_number - b.section_number)
    })
  }

  // Add new section
  const addSection = (newSection) => {
    updateSections(prev => [...prev, newSection])
    setSectionObservations(prev => ({
      ...prev,
      [newSection.id]: []
    }))
    setActiveSection(newSection.id)
  }

  // Update existing section
  const updateSection = (updatedSection) => {
    updateSections(prev => 
      prev.map(section => 
        section.id === updatedSection.id ? updatedSection : section
      )
    )
  }

  // Remove section and handle renumbering
  const removeSection = (sectionId) => {
    const deletedSectionNumber = sections.find(s => s.id === sectionId)?.section_number
    
    setSections(prev => {
      const filteredSections = prev.filter(s => s.id !== sectionId)
      
      return filteredSections.map(section => {
        if (section.section_number > deletedSectionNumber) {
          return {
            ...section,
            section_number: section.section_number - 1
          }
        }
        return section
      }).sort((a, b) => a.section_number - b.section_number)
    })

    // Clean up observations
    setSectionObservations(prev => {
      const newObs = { ...prev }
      delete newObs[sectionId]
      return newObs
    })

    // Update allObservations
    setAllObservations(prev => prev.filter(obs => obs.section_id !== sectionId))

    // Handle active section
    if (activeSection === sectionId) {
      const remainingSections = sections.filter(s => s.id !== sectionId)
      const nextSectionWithVideo = remainingSections.find(s => s.video_url)
      const nextSection = remainingSections[0]
      setActiveSection(nextSectionWithVideo?.id || nextSection?.id || null)
    }
  }

  // Update video data for section
  const updateSectionVideo = (sectionId, videoData) => {
    updateSections(prev => prev.map(section => 
      section.id === sectionId 
        ? {
            ...section,
            video_url: videoData.videoUrl,
            video_filename: videoData.filename,
            video_duration: videoData.duration,
            video_metadata: videoData.metadata
          }
        : section
    ))
    setUploadingSectionId(null)
    setActiveSection(sectionId)
  }

  // Remove video from section
  const removeSectionVideo = (sectionId) => {
    updateSections(prev => prev.map(section => 
      section.id === sectionId 
        ? {
            ...section,
            video_url: null,
            video_filename: null,
            video_duration: null,
            video_metadata: null
          }
        : section
    ))
  }

  // Main load function with retry logic
  const loadProject = useCallback(async () => {
    // Prevent duplicate loads
    if (loadingRef.current || !projectId) {
      console.log('Skipping load - already loading or no projectId')
      return
    }

    loadingRef.current = true
    setLoading(true)
    setError('')

    try {
      console.log('Starting project load with retry logic:', projectId)
      
      // Wait for auth with timeout
      const user = await waitForAuth(10000)
      
      if (!mountedRef.current) return
      
      if (!user) {
        // Try one more time to get the user
        const { data: { user: retryUser } } = await supabase.auth.getUser()
        if (!retryUser) {
          setError('Please log in to view this project')
          return
        }
      }
      
      // Load project with retry
      console.log('Loading project data...')
      const projectData = await retryOperation(
        async () => {
          const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single()
          
          if (error) throw error
          if (!data) throw new Error('Project not found')
          return data
        },
        3, // 3 retries
        1000 // 1 second initial delay
      )
      
      if (!mountedRef.current) return
      
      setProject(projectData)
      
      // Load sections with retry
      console.log('Loading sections...')
      const sectionsData = await retryOperation(
        async () => {
          const { data, error } = await supabase
            .from('sections')
            .select('*')
            .eq('project_id', projectId)
            .order('section_number', { ascending: true })
          
          if (error) {
            // If it's an RLS error, wait a bit and retry
            if (error.code === 'PGRST301' || error.message?.includes('policy')) {
              console.log('RLS policy error, waiting before retry...')
              await new Promise(resolve => setTimeout(resolve, 2000))
              
              // Retry the query
              const retryResult = await supabase
                .from('sections')
                .select('*')
                .eq('project_id', projectId)
                .order('section_number', { ascending: true })
              
              if (retryResult.error) throw retryResult.error
              return retryResult.data || []
            }
            throw error
          }
          
          return data || []
        },
        3,
        1500 // 1.5 seconds for sections
      )
      
      if (!mountedRef.current) return
      
      setSections(sectionsData)
      console.log('Sections loaded:', sectionsData.length)
      
      // Set first section with video as active, or first section if no videos
      const firstSectionWithVideo = sectionsData.find(s => s.video_url)
      const firstSection = sectionsData[0]
      if (firstSectionWithVideo) {
        setActiveSection(firstSectionWithVideo.id)
      } else if (firstSection) {
        setActiveSection(firstSection.id)
      }
      
      // Load observations for all sections (in background, don't block UI)
      if (sectionsData.length > 0) {
        // Don't await this - let it run in background
        loadAllObservations(sectionsData).catch(err => {
          console.error('Failed to load some observations:', err)
          // Don't set error - observations are not critical for initial load
        })
      }
      
      console.log('Project load complete')
      
    } catch (err) {
      console.error('Load error after retries:', err)
      
      if (mountedRef.current) {
        // Provide more specific error messages
        if (err.message?.includes('not found')) {
          setError('Project not found. It may have been deleted or you may not have permission to view it.')
        } else if (err.message?.includes('policy') || err.code === 'PGRST301') {
          setError('Permission denied. Please ensure you have access to this project.')
        } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
          setError('Network error. Please check your connection and try again.')
        } else if (err.message?.includes('timeout')) {
          setError('Request timed out. The server may be slow. Please try again.')
        } else {
          setError(err.message || 'Failed to load project. Please try again.')
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        loadingRef.current = false
      }
    }
  }, [projectId])

  // Load project data effect
  useEffect(() => {
    mountedRef.current = true
    
    if (projectId) {
      loadProject()
    }

    return () => {
      mountedRef.current = false
      loadingRef.current = false
    }
  }, [projectId, retryTrigger, loadProject]) // Include retryTrigger to allow parent to force reload

  // Computed values
  const activeSectionData = sections.find(s => s.id === activeSection)
  const sectionObservationCount = sectionObservations[activeSection]?.length || 0
  const videoObservations = sectionObservations[activeSection]?.filter(obs => obs.video_timestamp !== null) || []
  const totalObservations = Object.values(sectionObservations).reduce((total, obs) => total + obs.length, 0)
  const totalVideos = sections.filter(s => s.video_filename).length
  const highSeverityCount = Object.values(sectionObservations).flat().filter(obs => obs.severity >= 4).length

  return {
    // Core data
    project,
    sections,
    loading,
    error,
    
    // Section state
    activeSection,
    setActiveSection,
    activeSectionData,
    sectionObservations,
    allObservations,
    
    // UI state
    uploadingSectionId,
    setUploadingSectionId,
    deletingVideoId,
    setDeletingVideoId,
    deletingSectionId,
    setDeletingSectionId,
    
    // Functions
    getSeverityDistribution,
    refreshSectionObservations,
    addSection,
    updateSection,
    removeSection,
    updateSectionVideo,
    removeSectionVideo,
    
    // Computed values
    sectionObservationCount,
    videoObservations,
    totalObservations,
    totalVideos,
    highSeverityCount,
    
    // Reload function for manual retry
    reloadProject: loadProject
  }
}