'use client'
import { useState, useRef } from 'react'

export const useObservationManagement = () => {
  // Observation states
  const [showObservationForm, setShowObservationForm] = useState(false)
  const [editingObservation, setEditingObservation] = useState(null)
  const [currentSectionId, setCurrentSectionId] = useState(null)
  const [videoTimestamp, setVideoTimestamp] = useState(0)
  const [shouldAutoCapture, setShouldAutoCapture] = useState(false)
  const [refreshObservations, setRefreshObservations] = useState(0)
  const [showObservationsFor, setShowObservationsFor] = useState(null)
  const [lastSavedObservationId, setLastSavedObservationId] = useState(null) // NEW: Track last saved observation
  
  // Modal and form states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSectionDetailsForm, setShowSectionDetailsForm] = useState(false)
  const [editingSectionData, setEditingSectionData] = useState(null)
  
  // Video refs for frame capture
  const videoRefs = useRef({})

  // Observation handlers
  const handleFrameExtract = async (sectionId, videoElement, timestamp) => {
    console.log('=== FRAME EXTRACT CALLED ===')
    console.log('Frame extract called:', { sectionId, videoElement, timestamp })
    
    setCurrentSectionId(sectionId)
    setVideoTimestamp(timestamp || 0)
    setShouldAutoCapture(true)
    setEditingObservation(null)
    
    console.log('Setting shouldAutoCapture to TRUE and opening modal')
    setShowObservationForm(true)
  }

  const handleAddObservation = (sectionId) => {
    const videoRef = videoRefs.current[sectionId]
    setCurrentSectionId(sectionId)
    setVideoTimestamp(videoRef?.current?.currentTime || 0)
    setShouldAutoCapture(false)
    setEditingObservation(null)
    setShowObservationForm(true)
  }

  const handleEditObservation = (observation) => {
    setCurrentSectionId(observation.section_id)
    setEditingObservation(observation)
    setShouldAutoCapture(false)
    setShowObservationForm(true)
  }

  const handleSaveObservation = (observation, refreshSectionObservations) => {
    // Track the saved observation ID for highlighting and scrolling
    if (observation && observation.id) {
      console.log('Tracking saved observation:', observation.id)
      setLastSavedObservationId(observation.id)
      
      // Clear the last saved ID after 5 seconds
      // This prevents stale highlights when navigating back to a section later
      setTimeout(() => {
        setLastSavedObservationId(null)
      }, 5000)
    }
    
    // Refresh the observations list
    if (refreshSectionObservations && currentSectionId) {
      refreshSectionObservations(currentSectionId)
    }
    setRefreshObservations(prev => prev + 1)
    
    // Close the form and reset states
    setShowObservationForm(false)
    setEditingObservation(null)
    setCurrentSectionId(null)
  }

  const handleCloseObservationForm = () => {
    setShowObservationForm(false)
    setEditingObservation(null)
    setCurrentSectionId(null)
    setVideoTimestamp(0)
    setShouldAutoCapture(false)
  }

  // Video timestamp jump handler
  const handleJumpToTimestamp = (timestamp, activeSection, layoutMode, setLayoutMode) => {
    console.log('Jumping to timestamp:', timestamp, 'for section:', activeSection)
    
    if (!activeSection) {
      console.warn('No active section for timestamp jump')
      return
    }
    
    const videoRef = videoRefs.current[activeSection]
    if (!videoRef?.current) {
      console.warn('No video ref available for active section:', activeSection)
      alert('Video not available for timestamp jump. Please ensure video is loaded.')
      return
    }
    
    const video = videoRef.current
    
    // Calculate start position (2 seconds before, but not below 0)
    const startTime = Math.max(0, timestamp - 2)
    const targetTime = timestamp
    
    console.log(`Playing from ${startTime}s to ${targetTime}s`)
    
    // Set up event listener to stop at target timestamp
    const handleTimeUpdate = () => {
      if (video.currentTime >= targetTime) {
        video.pause()
        video.currentTime = targetTime // Ensure we're exactly at the timestamp
        video.removeEventListener('timeupdate', handleTimeUpdate)
        console.log('Stopped at target timestamp:', targetTime)
      }
    }
    
    // Jump to start position and play
    video.currentTime = startTime
    video.addEventListener('timeupdate', handleTimeUpdate)
    
    video.play().then(() => {
      console.log('Started playing from:', startTime)
    }).catch(error => {
      console.log('Auto-play prevented:', error)
      // If autoplay fails, just seek to the exact timestamp
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.currentTime = targetTime
    })
    
    // Switch to video view if we're in data-only mode
    if (layoutMode === 'data') {
      setLayoutMode('split') // Switch to split view to show both video and data
    }
    
    console.log('Successfully set up timestamp jump with 2-second lead-in')
  }

  // Video jump from map handler
  const handleJumpToVideoFromMap = (sectionId, timestamp, sections, setActiveSection, setLayoutMode) => {
    console.log('Jumping to video from map:', { sectionId, timestamp })
    
    // First, set the active section
    const section = sections.find(s => s.id === sectionId)
    if (!section) {
      console.warn('Section not found:', sectionId)
      return
    }
    
    // Switch to split view to show both map and video
    setLayoutMode('split')
    setActiveSection(sectionId)
    
    // Wait a moment for the video to load if switching sections
    setTimeout(() => {
      const videoRef = videoRefs.current[sectionId]
      if (!videoRef?.current) {
        console.warn('No video ref available for section:', sectionId)
        alert('Video not available for this section. Please ensure video is loaded.')
        return
      }
      
      const video = videoRef.current
      
      // Calculate start position (2 seconds before, but not below 0)
      const startTime = Math.max(0, timestamp - 2)
      const targetTime = timestamp
      
      console.log(`Playing from ${startTime}s to ${targetTime}s`)
      
      // Set up event listener to stop at target timestamp
      const handleTimeUpdate = () => {
        if (video.currentTime >= targetTime) {
          video.pause()
          video.currentTime = targetTime
          video.removeEventListener('timeupdate', handleTimeUpdate)
          console.log('Stopped at observation timestamp:', targetTime)
        }
      }
      
      // Jump to start position and play
      video.currentTime = startTime
      video.addEventListener('timeupdate', handleTimeUpdate)
      
      video.play().then(() => {
        console.log('Started playing from:', startTime)
      }).catch(error => {
        console.log('Auto-play prevented:', error)
        video.removeEventListener('timeupdate', handleTimeUpdate)
        video.currentTime = targetTime
      })
    }, 300)
  }

  // Toggle observations view
  const toggleObservationsView = (sectionId) => {
    setShowObservationsFor(showObservationsFor === sectionId ? null : sectionId)
  }

  // Section form handlers
  const handleEditSection = (section) => {
    setEditingSectionData(section)
    setShowSectionDetailsForm(true)
  }

  const closeEditSection = () => {
    setShowSectionDetailsForm(false)
    setEditingSectionData(null)
  }

  return {
    // Observation state
    showObservationForm,
    editingObservation,
    currentSectionId,
    videoTimestamp,
    shouldAutoCapture,
    refreshObservations,
    showObservationsFor,
    lastSavedObservationId,  // NEW: Export this state
    
    // Modal state
    showAddModal,
    showSectionDetailsForm,
    editingSectionData,
    
    // Video refs
    videoRefs,
    
    // Observation handlers
    handleFrameExtract,
    handleAddObservation,
    handleEditObservation,
    handleSaveObservation,
    handleCloseObservationForm,
    handleJumpToTimestamp,
    handleJumpToVideoFromMap,
    toggleObservationsView,
    
    // Modal handlers
    setShowAddModal,
    setShowSectionDetailsForm,
    handleEditSection,
    closeEditSection,
    
    // State setters
    setRefreshObservations,
    setLastSavedObservationId  // NEW: Export setter in case needed elsewhere
  }
}