'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

// Optimized retry helper with faster initial attempts
async function retryOperation(operation, maxRetries = 2, delay = 300) {
  let lastError
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1))) // Linear backoff instead of exponential
      }
    }
  }
  throw lastError
}

export const useProjectData = (projectId, retryTrigger = 0) => {
  const { user, profile, company, isSuperAdmin, loading: authLoading } = useAuth()
  
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

  // Track loading state
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

  // OPTIMIZED: Bulk load all observations in one query instead of N+1
  const loadAllObservations = async (sectionsData) => {
    if (!sectionsData.length) return

    try {
      // Get all section IDs
      const sectionIds = sectionsData.map(s => s.id)
      
      // PERFORMANCE: Load ALL observations in one query instead of looping
      const { data: allObs, error } = await supabase
        .from('observations')
        .select('*')
        .in('section_id', sectionIds)
        .order('timestamp', { ascending: true })

      if (error) throw error

      if (mountedRef.current) {
        // Group observations by section
        const observationsMap = {}
        sectionsData.forEach(section => {
          observationsMap[section.id] = []
        })

        allObs.forEach(obs => {
          if (observationsMap[obs.section_id]) {
            observationsMap[obs.section_id].push(obs)
          }
        })

        setSectionObservations(observationsMap)
        setAllObservations(allObs || [])
      }
    } catch (error) {
      console.error('Failed to load observations:', error)
      // Set empty observations instead of failing
      if (mountedRef.current) {
        const observationsMap = {}
        sectionsData.forEach(section => {
          observationsMap[section.id] = []
        })
        setSectionObservations(observationsMap)
        setAllObservations([])
      }
    }
  }

  // Refresh section observations 
  const refreshSectionObservations = async (sectionId) => {
    try {
      const { data: observations, error } = await supabase
        .from('observations')
        .select('*')
        .eq('section_id', sectionId)
        .order('timestamp', { ascending: true })
      
      if (error) throw error
      
      if (mountedRef.current) {
        setSectionObservations(prev => ({
          ...prev,
          [sectionId]: observations || []
        }))
        
        // Update allObservations
        setAllObservations(prev => {
          const filtered = prev.filter(obs => obs.section_id !== sectionId)
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

  // OPTIMIZED: Main load function with parallel loading and minimal queries
  const loadProject = useCallback(async () => {
    if (loadingRef.current || !projectId || authLoading) {
      return
    }

    loadingRef.current = true
    setLoading(true)
    setError('')

    try {
      console.log('🚀 Starting optimized project load:', projectId)
      
      // SECURITY: Check company authorization for non-super admins
      if (!isSuperAdmin && !company?.id) {
        setError('Access denied: No company association found')
        return
      }

      // OPTIMIZATION: Single query to load project and sections together
      let projectQuery = supabase
        .from('projects')
        .select(`
          *,
          companies!inner (
            id,
            name
          ),
          sections (*)
        `)
        .eq('id', projectId)

      // Apply company filtering for non-super admins
      if (!isSuperAdmin && company?.id) {
        console.log('🔒 Applying company filter:', company.id)
        projectQuery = projectQuery.eq('company_id', company.id)
      }

      // PERFORMANCE: Load project and sections in one query
      const { data: projectData, error: projectError } = await projectQuery.single()
      
      if (projectError) {
        console.error('❌ Project query error:', projectError)
        if (projectError.code === 'PGRST116') {
          throw new Error('Project not found or access denied')
        }
        throw projectError
      }

      if (!mountedRef.current) return

      console.log('✅ Project and sections loaded in single query')

      // Extract sections from project data
      const sectionsData = projectData.sections || []
      delete projectData.sections // Remove sections from project object

      setProject(projectData)
      setSections(sectionsData.sort((a, b) => a.section_number - b.section_number))

      // Set first section with video as active
      const firstSectionWithVideo = sectionsData.find(s => s.video_url)
      const firstSection = sectionsData[0]
      if (firstSectionWithVideo) {
        setActiveSection(firstSectionWithVideo.id)
      } else if (firstSection) {
        setActiveSection(firstSection.id)
      }

      // OPTIMIZATION: Load observations in parallel, don't block UI
      if (sectionsData.length > 0) {
        // Don't await - let it load in background
        loadAllObservations(sectionsData).catch(err => {
          console.error('Background observation loading failed:', err)
        })
      } else {
        // No sections, set empty observations
        setSectionObservations({})
        setAllObservations([])
      }

      console.log('✅ Optimized project load complete')
      
    } catch (err) {
      console.error('❌ Load error:', err)
      
      if (mountedRef.current) {
        if (err.message?.includes('not found') || err.message?.includes('access denied')) {
          setError('Project not found or you do not have permission to view it')
        } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
          setError('Network error. Please check your connection and try again.')
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
  }, [projectId, authLoading, user, company, isSuperAdmin])

  // Load project data effect
  useEffect(() => {
    mountedRef.current = true
    
    if (projectId && !authLoading) {
      loadProject()
    }

    return () => {
      mountedRef.current = false
      loadingRef.current = false
    }
  }, [projectId, retryTrigger, loadProject])

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