'use client'
import { useState, useEffect } from 'react'

export const useLayoutManagement = () => {
  // Helper function to get persisted layout mode
  const getPersistedLayoutMode = () => {
    if (typeof window === 'undefined') return 'split'
    try {
      return sessionStorage.getItem('projectLayoutMode') || 'split'
    } catch {
      return 'split'
    }
  }

  // Helper function to persist layout mode
  const persistLayoutMode = (mode) => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem('projectLayoutMode', mode)
    } catch (error) {
      console.warn('Failed to persist layout mode:', error)
    }
  }

  // Layout states - initialize from persisted state
  const [layoutMode, setLayoutModeState] = useState(() => getPersistedLayoutMode())
  const [videoMinimized, setVideoMinimized] = useState(false)
  const [dataMinimized, setDataMinimized] = useState(false)
  const [splitRatio, setSplitRatio] = useState(() => {
    if (typeof window === 'undefined') return 50
    try {
      const saved = sessionStorage.getItem('projectSplitRatio')
      return saved ? parseInt(saved, 10) : 50
    } catch {
      return 50
    }
  })
  const [isDragging, setIsDragging] = useState(false)

  // Enhanced setLayoutMode that persists the change
  const setLayoutMode = (mode) => {
    setLayoutModeState(mode)
    persistLayoutMode(mode)
  }

  // Enhanced setSplitRatio that persists the change
  const setSplitRatioPersistent = (ratio) => {
    setSplitRatio(ratio)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('projectSplitRatio', ratio.toString())
      } catch (error) {
        console.warn('Failed to persist split ratio:', error)
      }
    }
  }

  // Layout mode handlers
  const setVideoOnlyMode = () => {
    setLayoutMode('video')
    setVideoMinimized(false)
    setDataMinimized(false)
  }

  const setDataOnlyMode = () => {
    setLayoutMode('data')
    setVideoMinimized(false)
    setDataMinimized(false)
  }

  const setSplitViewMode = () => {
    setLayoutMode('split')
    setVideoMinimized(false)
    setDataMinimized(false)
  }

  const setMapMode = () => {
    setLayoutMode('map')
    setVideoMinimized(false)
    setDataMinimized(false)
  }

  const resetLayout = () => {
    setLayoutMode('split')
    setSplitRatioPersistent(50)
    setVideoMinimized(false)
    setDataMinimized(false)
  }

  // Splitter drag functionality - updated to use persistent setSplitRatio
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      
      const container = document.getElementById('layout-container')
      if (!container) return
      
      const rect = container.getBoundingClientRect()
      const newRatio = ((e.clientX - rect.left) / rect.width) * 100
      setSplitRatioPersistent(Math.max(20, Math.min(80, newRatio)))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Handle browser visibility changes to maintain state
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When tab becomes visible again, restore persisted state
        const persistedMode = getPersistedLayoutMode()
        if (persistedMode !== layoutMode) {
          setLayoutModeState(persistedMode)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [layoutMode])

  // Layout configuration helpers
  const isVideoVisible = layoutMode === 'video' || layoutMode === 'split'
  const isDataVisible = layoutMode === 'data' || layoutMode === 'split'
  const isMapVisible = layoutMode === 'map'
  const isSplitMode = layoutMode === 'split'

  const getVideoWidth = () => {
    if (layoutMode === 'video') return '100%'
    if (layoutMode === 'split') return `${splitRatio}%`
    return '0%'
  }

  const getDataWidth = () => {
    if (layoutMode === 'data') return '100%'
    if (layoutMode === 'split') return `${100 - splitRatio}%`
    return '0%'
  }

  const getVideoMinWidth = () => {
    return layoutMode === 'split' ? '300px' : 'auto'
  }

  const getDataMinWidth = () => {
    return layoutMode === 'split' ? '300px' : 'auto'
  }

  // Smart layout switching
  const switchToSplitForVideo = () => {
    if (layoutMode === 'data' || layoutMode === 'map') {
      setLayoutMode('split')
    }
  }

  const switchToSplitForData = () => {
    if (layoutMode === 'video' || layoutMode === 'map') {
      setLayoutMode('split')
    }
  }

  return {
    // State
    layoutMode,
    videoMinimized,
    dataMinimized,
    splitRatio,
    isDragging,
    
    // Mode setters
    setVideoOnlyMode,
    setDataOnlyMode,
    setSplitViewMode,
    setMapMode,
    resetLayout,
    
    // State setters
    setVideoMinimized,
    setDataMinimized,
    setSplitRatio: setSplitRatioPersistent, // Use the persistent version
    setIsDragging,
    
    // Computed values
    isVideoVisible,
    isDataVisible,
    isMapVisible,
    isSplitMode,
    
    // Layout helpers
    getVideoWidth,
    getDataWidth,
    getVideoMinWidth,
    getDataMinWidth,
    
    // Smart switching
    switchToSplitForVideo,
    switchToSplitForData
  }
}