'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { usePersistentState, useTabVisibility } from '@/hooks/usePersistentState'

export const useProjectData = (projectId, retryTrigger = 0) => {
  const { user, profile, company, isSuperAdmin, loading: authLoading } = useAuth()
  
  // Core data state
  const [project, setProject] = useState(null)
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Progressive loading states
  const [projectLoaded, setProjectLoaded] = useState(false)
  const [observationsLoaded, setObservationsLoaded] = useState(false)
  
  // PERSISTENT: Active section survives tab switches
  const [activeSection, setActiveSection] = usePersistentState(
    `activeSection_${projectId}`, 
    null
  )
  
  // Section-specific state
  const [sectionObservations, setSectionObservations] = useState({})
  const [allObservations, setAllObservations] = useState([])
  
  // UI state
  const [uploadingSectionId, setUploadingSectionId] = useState(null)
  const [deletingVideoId, setDeletingVideoId] = useState(null)
  const [deletingSectionId, setDeletingSectionId] = useState(null)

  // Track loading and tab state
  const loadingRef = useRef(false)
  const mountedRef = useRef(true)
  const lastLoadTimeRef = useRef(0)
  const dataValidRef = useRef(false)
  const authChangeInProgressRef = useRef(false)
  
  // STABLE AUTH VALUES - prevent unnecessary reloads on auth refresh
  const stableAuthRef = useRef({
    userId: null,
    companyId: null,
    isSuperAdmin: false,
    isAuthenticated: false
  })

  // Update stable auth values only when they actually change (more robust)
  useEffect(() => {
    const newAuth = {
      userId: user?.id || null,
      companyId: company?.id || null,
      isSuperAdmin: isSuperAdmin || false,
      isAuthenticated: !!user
    }

    // Only update if values actually changed
    const authChanged = (
      stableAuthRef.current.userId !== newAuth.userId ||
      stableAuthRef.current.companyId !== newAuth.companyId ||
      stableAuthRef.current.isSuperAdmin !== newAuth.isSuperAdmin ||
      stableAuthRef.current.isAuthenticated !== newAuth.isAuthenticated
    )

    if (authChanged) {
      console.log('🔐 Auth values changed:', { 
        old: stableAuthRef.current, 
        new: newAuth,
        hasProject: !!project,
        hasValidData: dataValidRef.current
      })
      
      // Set flag to indicate auth change is in progress
      authChangeInProgressRef.current = true
      
      stableAuthRef.current = newAuth
      
      // Only reload if we have valid auth and this isn't just a tab return refresh
      if (newAuth.isAuthenticated && projectId) {
        // Small delay to let auth settle and prevent race conditions
        setTimeout(() => {
          if (dataValidRef.current) {
            console.log('🔄 Auth changed - reloading project (with section preservation)')
            loadProject(false) // Don't force, preserve section
          } else {
            console.log('🔄 Auth changed - initial project load')
            loadProject(true) // First load
          }
          authChangeInProgressRef.current = false
        }, 100)
      } else {
        authChangeInProgressRef.current = false
      }
    }
  }, [user?.id, company?.id, isSuperAdmin, projectId, project])

  // Handle tab switching - prevent unnecessary reloads
  useTabVisibility(
    () => {
      // User returned to tab
      const timeSinceLastLoad = Date.now() - lastLoadTimeRef.current
      const RELOAD_THRESHOLD = 5 * 60 * 1000 // 5 minutes
      
      console.log('👁️ User returned to tab:', {
        timeSinceLastLoad,
        hasValidData: dataValidRef.current,
        authInProgress: authChangeInProgressRef.current,
        currentActiveSection: activeSection
      })
      
      // Don't reload if auth change is already in progress
      if (authChangeInProgressRef.current) {
        console.log('⚡ Skipping tab return reload - auth change in progress')
        return
      }
      
      // Only reload if it's been more than 5 minutes AND we have valid data
      if (timeSinceLastLoad > RELOAD_THRESHOLD && dataValidRef.current) {
        console.log('🔄 Auto-refreshing stale data after tab switch')
        loadProject(false) // Don't force, preserve section
      } else {
        console.log('⚡ Skipping reload - data is fresh or no valid data')
      }
    },
    () => {
      // User left tab - nothing to do
      console.log('🔄 User left tab, activeSection:', activeSection)
    }
  )

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

  // OPTIMIZED: Load everything in parallel queries
  const loadAllData = async (preserveActiveSection = true) => {
    if (!mountedRef.current) return
    
    console.log('🚀 Starting parallel data loading...', { 
      preserveActiveSection,
      currentActiveSection: activeSection,
      authInProgress: authChangeInProgressRef.current
    })
    const startTime = Date.now()
    lastLoadTimeRef.current = startTime
    
    try {
      const auth = stableAuthRef.current

      // OPTIMIZATION 1: Simplified project query without joins
      let projectQuery = supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)

      // Apply company filtering for non-super admins
      if (!auth.isSuperAdmin && auth.companyId) {
        projectQuery = projectQuery.eq('company_id', auth.companyId)
      }

      // OPTIMIZATION 2: Simple sections query
      const sectionsQuery = supabase
        .from('sections')
        .select('*')
        .eq('project_id', projectId)
        .order('section_number', { ascending: true })

      // OPTIMIZATION 3: Execute project and sections queries in parallel
      const [projectResult, sectionsResult] = await Promise.all([
        projectQuery.single(),
        sectionsQuery
      ])

      if (projectResult.error) {
        console.error('❌ Project query error:', projectResult.error)
        if (projectResult.error.code === 'PGRST116') {
          throw new Error('Project not found or access denied')
        }
        throw projectResult.error
      }

      if (sectionsResult.error) {
        throw sectionsResult.error
      }

      if (!mountedRef.current) return

      // Update state immediately with project and sections
      const sectionsData = sectionsResult.data || []
      setProject(projectResult.data)
      setSections(sectionsData)
      setProjectLoaded(true)
      dataValidRef.current = true // Mark data as valid

      console.log(`⚡ Project and sections loaded in ${Date.now() - startTime}ms`)

      // ENHANCED: Smart active section handling with persistence and protection
      setActiveSection(currentActiveSection => {
        console.log('🎯 Setting active section:', {
          preserve: preserveActiveSection,
          current: currentActiveSection,
          sectionsCount: sectionsData.length,
          authInProgress: authChangeInProgressRef.current
        })

        // PROTECTION: If we're preserving and have a current valid section, keep it
        if (preserveActiveSection && currentActiveSection && sectionsData.find(s => s.id === currentActiveSection)) {
          console.log('✅ Preserving active section from session:', currentActiveSection)
          return currentActiveSection
        }
        
        // PROTECTION: If current is null but we're in an auth change, try to restore from session
        if (!currentActiveSection && authChangeInProgressRef.current) {
          try {
            const stored = sessionStorage.getItem(`activeSection_${projectId}`)
            if (stored && stored !== 'null') {
              const parsedValue = JSON.parse(stored)
              if (parsedValue && sectionsData.find(s => s.id === parsedValue)) {
                console.log('🔄 Restored section from session during auth change:', parsedValue)
                return parsedValue
              }
            }
          } catch (error) {
            console.warn('Failed to restore section during auth change:', error)
          }
        }
        
        // For new projects or invalid previous selection, pick the best default
        const firstSectionWithVideo = sectionsData.find(s => s.video_url)
        const firstSection = sectionsData[0]
        const newActiveSection = firstSectionWithVideo?.id || firstSection?.id || null
        
        console.log('🏠 Setting new active section:', newActiveSection)
        return newActiveSection
      })

      // OPTIMIZATION 4: Load observations asynchronously if we have sections
      // FIX: Use video_timestamp instead of timestamp
      if (sectionsData.length > 0) {
        // Start observations loading but don't await it
        loadObservationsAsync(sectionsData).then(() => {
          console.log(`📊 All data loaded in ${Date.now() - startTime}ms`)
        })
      } else {
        // No sections, set empty observations immediately
        setSectionObservations({})
        setAllObservations([])
        setObservationsLoaded(true)
      }

      return true // Success
      
    } catch (error) {
      console.error('❌ Data loading error:', error)
      dataValidRef.current = false // Mark data as invalid on error
      throw error
    }
  }

  // OPTIMIZED: Fast async observations loading - FIXED column name
  const loadObservationsAsync = async (sectionsData) => {
    if (!sectionsData.length || !mountedRef.current) return

    try {
      const sectionIds = sectionsData.map(s => s.id)
      
      // PERFORMANCE: Single query for all observations - FIXED: Use video_timestamp for ordering
      const { data: allObs, error } = await supabase
        .from('observations')
        .select('*')
        .in('section_id', sectionIds)
        .order('video_timestamp', { ascending: true, nullsFirst: false })

      if (error) throw error

      if (mountedRef.current) {
        // Group observations by section
        const observationsMap = {}
        sectionsData.forEach(section => {
          observationsMap[section.id] = []
        })

        if (allObs) {
          allObs.forEach(obs => {
            if (observationsMap[obs.section_id]) {
              observationsMap[obs.section_id].push(obs)
            }
          })
        }

        setSectionObservations(observationsMap)
        setAllObservations(allObs || [])
        setObservationsLoaded(true)
      }
    } catch (error) {
      console.error('Failed to load observations:', error)
      // Set empty observations on error
      if (mountedRef.current) {
        const observationsMap = {}
        sectionsData.forEach(section => {
          observationsMap[section.id] = []
        })
        setSectionObservations(observationsMap)
        setAllObservations([])
        setObservationsLoaded(true)
      }
    }
  }

  // Refresh section observations - FIXED column name
  const refreshSectionObservations = async (sectionId) => {
    try {
      const { data: observations, error } = await supabase
        .from('observations')
        .select('*')
        .eq('section_id', sectionId)
        .order('video_timestamp', { ascending: true, nullsFirst: false })
      
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

    // Handle active section - clear from session if deleted
    if (activeSection === sectionId) {
      const remainingSections = sections.filter(s => s.id !== sectionId)
      const nextSectionWithVideo = remainingSections.find(s => s.video_url)
      const nextSection = remainingSections[0]
      const newActiveSection = nextSectionWithVideo?.id || nextSection?.id || null
      setActiveSection(newActiveSection)
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

  // OPTIMIZED: Main load function with error handling
  const loadProject = useCallback(async (forceReload = false) => {
    if (loadingRef.current || !projectId || authLoading) {
      return
    }

    const auth = stableAuthRef.current

    // Check auth requirements
    if (!auth.isAuthenticated) {
      setError('Please log in to view this project')
      setLoading(false)
      return
    }

    if (!auth.isSuperAdmin && !auth.companyId) {
      setError('Access denied: No company association found')
      setLoading(false)
      return
    }

    // Skip reload if data is fresh and not forced
    if (!forceReload && dataValidRef.current && project && sections.length > 0) {
      const timeSinceLastLoad = Date.now() - lastLoadTimeRef.current
      if (timeSinceLastLoad < 30000) { // 30 seconds
        console.log('⚡ Skipping reload - data is fresh')
        return
      }
    }

    loadingRef.current = true
    setLoading(true)
    setError('')
    setProjectLoaded(false)
    setObservationsLoaded(false)

    try {
      await loadAllData(!forceReload) // Preserve active section unless forcing reload
      
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
  }, [projectId, authLoading, project, sections.length]) // Removed user/auth dependencies

  // STABLE: Initial load effect - only triggers on essential changes
  useEffect(() => {
    mountedRef.current = true
    
    if (projectId && !authLoading && stableAuthRef.current.isAuthenticated) {
      console.log('🎬 Initial project load triggered')
      loadProject()
    }

    return () => {
      mountedRef.current = false
      loadingRef.current = false
    }
  }, [projectId, retryTrigger, authLoading, loadProject])

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
    
    // Progressive loading states
    projectLoaded,
    observationsLoaded,
    
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