'use client'
import { useState, useEffect, forwardRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase, deleteVideo, formatDuration, formatFileSize } from '@/lib/supabase'
import { FileText, Upload, X, Archive, RotateCcw, AlertTriangle, Plus } from 'lucide-react'
import { archiveProject, restoreProject } from '@/lib/actions/project-archive'
import ArchiveProjectModal from '@/components/ArchiveProjectModal'
import { useAuth } from '@/lib/auth-context'

// Custom hooks
import { useProjectData } from '@/hooks/useProjectData'
import { useLayoutManagement } from '@/hooks/useLayoutManagement'
import { useObservationManagement } from '@/hooks/useObservationManagement'
import SectionDetailsDisplay from '@/components/SectionDetailsDisplay'

// Components
import SectionsGrid from '@/components/SectionsGrid'
import LayoutControls from '@/components/LayoutControls'
import VideoUpload from '@/components/VideoUpload'
import VideoPlayer from '@/components/VideoPlayer'
import ObservationForm from '@/components/ObservationForm'
import ObservationsList from '@/components/ObservationsList'
import SectionDetailsForm from '@/components/SectionDetailsForm'
import BulkVideoUpload from '@/components/BulkVideoUpload'
import VideoSourceModal from '@/components/VideoSourceModal'

// Dynamic imports
const ProjectMap = dynamic(
  () => import('@/components/ProjectMap').then(mod => {
    const ProjectMapComponent = mod.default
    return forwardRef((props, ref) => <ProjectMapComponent {...props} ref={ref} />)
  }),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    )
  }
)

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  
  // Add state for bulk upload modal
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  
  // Archive-related state
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)

  // Add retry state
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  // Custom hooks for state management - pass retry count to force reload
  const projectData = useProjectData(params.id, retryCount)
  const layoutManagement = useLayoutManagement()
  const observationManagement = useObservationManagement()

  // Destructure what we need from hooks
  const {
    project, sections, loading, error, activeSection, activeSectionData,
    sectionObservations, allObservations, uploadingSectionId, deletingVideoId,
    deletingSectionId, getSeverityDistribution, refreshSectionObservations,
    addSection, updateSection, removeSection, updateSectionVideo, removeSectionVideo,
    setActiveSection, setUploadingSectionId, setDeletingVideoId, setDeletingSectionId,
    sectionObservationCount, videoObservations, totalObservations, totalVideos, highSeverityCount
  } = projectData

  const {
    layoutMode, splitRatio, isDragging, isVideoVisible, isDataVisible, isMapVisible,
    isSplitMode, getVideoWidth, getDataWidth, getVideoMinWidth, getDataMinWidth,
    setVideoOnlyMode, setDataOnlyMode, setSplitViewMode, setMapMode, resetLayout,
    setSplitRatio, setIsDragging, videoMinimized, dataMinimized, setVideoMinimized, setDataMinimized
  } = layoutManagement

  const {
    showObservationForm, editingObservation, currentSectionId, videoTimestamp,
    shouldAutoCapture, refreshObservations, showSectionDetailsForm, editingSectionData,
    videoRefs, handleFrameExtract, handleAddObservation, handleEditObservation,
    handleSaveObservation, handleCloseObservationForm, handleJumpToTimestamp,
    handleJumpToVideoFromMap, handleEditSection, closeEditSection, setShowSectionDetailsForm, lastSavedObservationId
  } = observationManagement

  // Handle auth-based redirects
  useEffect(() => {
    // Only redirect after auth has loaded
    if (!authLoading && !user) {
      console.log('No user found, redirecting to login')
      router.push('/auth/login')
    }
  }, [authLoading, user, router])

  // Handle retry logic
  const handleRetry = () => {
    setIsRetrying(true)
    setRetryCount(prev => prev + 1)
    // Reset retry flag after a delay
    setTimeout(() => setIsRetrying(false), 1000)
  }

  // Archive handler functions with authentication
  const handleArchiveProject = async (reason) => {
    if (!user) {
      alert('You must be logged in to archive projects')
      return
    }

    setIsArchiving(true)
    
    try {
      const result = await archiveProject(project.id, user.id, reason)
      
      if (result.success) {
        // Redirect to projects list after successful archive
        router.push('/')
      } else {
        alert(`Failed to archive project: ${result.error}`)
      }
    } catch (error) {
      console.error('Archive error:', error)
      alert('Failed to archive project. Please try again.')
    } finally {
      setIsArchiving(false)
      setShowArchiveModal(false)
    }
  }

  const handleRestoreProject = async () => {
    if (!user) {
      alert('You must be logged in to restore projects')
      return
    }

    if (!confirm('Are you sure you want to restore this archived project?')) {
      return
    }
    
    setIsArchiving(true)
    
    try {
      const result = await restoreProject(project.id, user.id, 'in_progress')
      
      if (result.success) {
        // Reload the page to show updated status
        window.location.reload()
      } else {
        alert(`Failed to restore project: ${result.error}`)
      }
    } catch (error) {
      console.error('Restore error:', error)
      alert('Failed to restore project. Please try again.')
    } finally {
      setIsArchiving(false)
    }
  }

  // Handler functions for video operations
  const handleVideoUploadComplete = (sectionId, videoData) => {
    updateSectionVideo(sectionId, videoData)
  }

  const handleDeleteVideo = async (sectionId) => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return
    }

    setDeletingVideoId(sectionId)

    try {
      const section = sections.find(s => s.id === sectionId)
      if (!section || !section.video_filename) {
        throw new Error('Section or video filename not found')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      let fullFilePath = null
      
      if (section.video_metadata?.filePath) {
        fullFilePath = `${user.id}/${section.video_metadata.filePath}`
      } else {
        fullFilePath = `${user.id}/${sectionId}/${section.video_filename}`
      }

      console.log('Attempting to delete file at path:', fullFilePath)

      const { success, error: deleteError } = await deleteVideo(fullFilePath)
      if (!success) {
        console.warn('Storage delete failed:', deleteError)
      }

      const { error: updateError } = await supabase
        .from('sections')
        .update({
          video_url: null,
          video_filename: null,
          video_duration: null,
          video_metadata: null
        })
        .eq('id', sectionId)

      if (updateError) {
        throw new Error('Failed to update section in database')
      }

      removeSectionVideo(sectionId)

      if (activeSection === sectionId) {
        const nextSectionWithVideo = sections.find(s => s.id !== sectionId && s.video_url)
        const nextSection = sections.find(s => s.id !== sectionId)
        setActiveSection(nextSectionWithVideo?.id || nextSection?.id || null)
      }

      console.log('Video deleted successfully')

    } catch (err) {
      console.error('Delete failed:', err)
      alert(`Failed to delete video: ${err.message}`)
    } finally {
      setDeletingVideoId(null)
    }
  }

  const handleDeleteSection = async (sectionId) => {
    const section = sections.find(s => s.id === sectionId)
    if (!section) return

    const hasVideo = section.video_url
    const obsCount = sectionObservations[sectionId]?.length || 0

    let confirmMessage = `Are you sure you want to delete "${section.name}"?`
    if (hasVideo) {
      confirmMessage += `\n\nThis will also delete the uploaded video.`
    }
    if (obsCount > 0) {
      confirmMessage += `\n\nThis will delete ${obsCount} observation${obsCount > 1 ? 's' : ''}.`
    }
    confirmMessage += `\n\nAll sections after this one will be renumbered automatically.`
    confirmMessage += `\n\nThis action cannot be undone.`

    if (!confirm(confirmMessage)) {
      return
    }

    setDeletingSectionId(sectionId)

    try {
      const deletedSectionNumber = section.section_number

      if (hasVideo && section.video_filename) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          let fullFilePath = null
          
          if (section.video_metadata?.filePath) {
            fullFilePath = `${user.id}/${section.video_metadata.filePath}`
          } else {
            fullFilePath = `${user.id}/${sectionId}/${section.video_filename}`
          }

          console.log('Deleting video file for section:', fullFilePath)
          const { success, error: deleteError } = await deleteVideo(fullFilePath)
          if (!success) {
            console.warn('Storage delete failed:', deleteError)
          }
        }
      }

      const { error: deleteError } = await supabase
        .from('sections')
        .delete()
        .eq('id', sectionId)

      if (deleteError) throw deleteError

      const { data: sectionsToRenumber, error: fetchError } = await supabase
        .from('sections')
        .select('id, section_number')
        .eq('project_id', params.id)
        .gt('section_number', deletedSectionNumber)
        .order('section_number', { ascending: true })

      if (fetchError) {
        console.error('Error fetching sections to renumber:', fetchError)
        throw new Error('Failed to fetch sections for renumbering')
      }

      if (sectionsToRenumber && sectionsToRenumber.length > 0) {
        console.log(`Renumbering ${sectionsToRenumber.length} sections...`)
        
        for (const sectionToUpdate of sectionsToRenumber) {
          const newSectionNumber = sectionToUpdate.section_number - 1
          
          const { error: updateError } = await supabase
            .from('sections')
            .update({ section_number: newSectionNumber })
            .eq('id', sectionToUpdate.id)

          if (updateError) {
            console.error(`Error updating section ${sectionToUpdate.id}:`, updateError)
          }
        }
      }

      removeSection(sectionId)

      console.log('Section deleted and renumbered successfully')

    } catch (err) {
      console.error('Section delete failed:', err)
      alert(`Failed to delete section: ${err.message}`)
    } finally {
      setDeletingSectionId(null)
    }
  }

  // Wrapper handlers for observation management
  const handleSaveObservationWrapper = (observation) => {
    handleSaveObservation(observation, refreshSectionObservations)
  }

  const handleJumpToTimestampWrapper = (timestamp) => {
    handleJumpToTimestamp(timestamp, activeSection, layoutMode, setSplitViewMode)
  }

  const handleJumpToVideoFromMapWrapper = (sectionId, timestamp) => {
    handleJumpToVideoFromMap(sectionId, timestamp, sections, setActiveSection, setSplitViewMode)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Enhanced loading state
  if (authLoading || (loading && !project)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">
            {authLoading ? 'Checking authentication...' : 'Loading project...'}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            This may take a moment
          </div>
        </div>
      </div>
    )
  }

  // Enhanced error state with retry
  if (error && !isRetrying) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Project</h3>
            <div className="text-red-600 mb-4">{error}</div>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetry}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Try Again
              </button>
              <Link 
                href="/" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back to Projects
              </Link>
            </div>
            
            {error.includes('log in') && (
              <Link 
                href="/auth/login" 
                className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                Go to Login →
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show retrying state
  if (isRetrying) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Retrying...</div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Project not found</div>
          <Link 
            href="/" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            ← Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Project Header */}
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Projects
        </Link>
        
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600 mt-2 max-w-2xl">{project.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Created {formatDate(project.created_at)}
            </p>
          </div>
          
          <div className="flex gap-3">
            {/* Archive/Restore Button based on project status */}
            {project.status === 'archived' ? (
              <button 
                onClick={handleRestoreProject}
                disabled={isArchiving}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center disabled:opacity-50"
                title="Restore this project from archive"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {isArchiving ? 'Restoring...' : 'Restore Project'}
              </button>
            ) : (
              <button 
                onClick={() => setShowArchiveModal(true)}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center"
                title="Archive this project"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </button>
            )}
            
            {/* Existing buttons */}
            <button 
              onClick={() => setShowBulkUpload(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 flex items-center"
              title="Upload multiple videos to the project pool"
            >
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </button>
            
            <Link 
              href={`/projects/${params.id}/reports`}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center"
            >
              <FileText className="h-4 w-4 mr-2" />
              View Reports
            </Link>
            <button 
              onClick={() => setShowSectionDetailsForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              + Add Section
            </button>
          </div>
        </div>

        {/* Archive notification banner */}
        {project.status === 'archived' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 mt-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800">This project is archived</h3>
                <div className="mt-1 text-sm text-yellow-700">
                  <p>
                    Archived on {new Date(project.archived_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {project.archive_reason && (
                    <p className="mt-1">Reason: {project.archive_reason}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sections Grid */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sections</h3>
          <SectionsGrid
            sections={sections}
            activeSection={activeSection}
            sectionObservations={sectionObservations}
            uploadingSectionId={uploadingSectionId}
            deletingSectionId={deletingSectionId}
            getSeverityDistribution={getSeverityDistribution}
            onSectionClick={setActiveSection}
            onEditSection={handleEditSection}
            onDeleteSection={handleDeleteSection}
            onUploadVideo={setUploadingSectionId}
            onAddSection={() => setShowSectionDetailsForm(true)}
          />
        </div>

        {/* Layout Controls */}
        <LayoutControls
          layoutMode={layoutMode}
          splitRatio={splitRatio}
          activeSectionData={activeSectionData}
          onSetVideoMode={setVideoOnlyMode}
          onSetDataMode={setDataOnlyMode}
          onSetSplitMode={setSplitViewMode}
          onSetMapMode={setMapMode}
          onSetSplitRatio={setSplitRatio}
          onResetLayout={resetLayout}
        />
      </div>

      {/* Main Layout Container */}
      {isMapVisible ? (
        // Map View - Full Height
        <div className="h-[calc(100vh-16rem)]">
          <ProjectMap 
            projectId={project.id} 
            sections={sections}
            observations={allObservations}
            onJumpToVideo={handleJumpToVideoFromMapWrapper}
          />
        </div>
      ) : (
        // Video/Data Layout Container
        <div 
          id="layout-container"
          className="flex h-[calc(100vh-16rem)] bg-gray-50 rounded-lg overflow-hidden"
          style={{ 
            cursor: isDragging ? 'col-resize' : 'default',
            userSelect: isDragging ? 'none' : 'auto'
          }}
        >
          {/* Video Panel */}
          {isVideoVisible && (
            <div 
              className="bg-white border-r border-gray-200 flex flex-col"
              style={{ 
                width: getVideoWidth(),
                minWidth: getVideoMinWidth()
              }}
            >
              {/* Video Panel Content */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">Video Player</span>
                  {activeSectionData && (
                    <span className="text-sm text-gray-500">- {activeSectionData.name}</span>
                  )}
                </div>
              </div>

              <div className="flex-1 p-4 overflow-auto">
                {activeSectionData?.video_url ? (
                  <div className="space-y-4">
                    <VideoPlayer
                      ref={(ref) => {
                        if (!videoRefs.current) videoRefs.current = {}
                        videoRefs.current[activeSection] = ref
                      }}
                      src={activeSectionData.video_url}
                      onCaptureFrame={(videoElement, timestamp) => {
                        handleFrameExtract(activeSection, videoElement, timestamp)
                      }}
                      observations={videoObservations}
                      className="w-full"
                    />

                    {/* Video Info and Actions */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <span>{formatDuration(activeSectionData.video_duration)}</span>
                      </div>
                      {activeSectionData.video_metadata?.originalSize && (
                        <div className="flex items-center text-gray-600">
                          <span>{formatFileSize(activeSectionData.video_metadata.originalSize)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <span className="text-sm text-green-600 font-medium">✓ Video ready for analysis</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleAddObservation(activeSection)}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-full hover:bg-green-100"
                        >
                          + Add Observation
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(activeSection)}
                          disabled={deletingVideoId === activeSection}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-full hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingVideoId === activeSection ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>

                    {/* Section Details Display */}
                    <SectionDetailsDisplay section={activeSectionData} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <p>No video uploaded for this section</p>
                      {activeSectionData && (
                        <button
                          onClick={() => setUploadingSectionId(activeSection)}
                          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                        >
                          Upload Video
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Splitter */}
          {isSplitMode && (
            <div
              className="w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors"
              onMouseDown={() => setIsDragging(true)}
            />
          )}

          {/* Data Panel */}
          {isDataVisible && (
            <div 
              className="bg-white flex flex-col"
              style={{ 
                width: getDataWidth(),
                minWidth: getDataMinWidth()
              }}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium text-gray-900">Observations & Data</h3>
                  {activeSectionData && (
                    <span className="text-sm text-gray-500">({sectionObservationCount} observations)</span>
                  )}
                </div>
                {/* Add Observation button in header - always visible */}
                {activeSection && (
                  <button
                    onClick={() => handleAddObservation(activeSection)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Observation
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-auto">
                {activeSection ? (
                  <div className="p-4">
                    <ObservationsList
                      sectionId={activeSection}
                      onEditObservation={handleEditObservation}
                      onAddObservation={() => handleAddObservation(activeSection)}
                      onJumpToTimestamp={handleJumpToTimestampWrapper}
                      refreshTrigger={refreshObservations}
                      hideAddButton={true}
                      lastSavedObservationId={lastSavedObservationId}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <p>No section selected</p>
                      <p className="text-sm mt-1">Select a section to view observations</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Project Summary */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Project Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-semibold text-gray-900">{sections.length}</div>
            <div className="text-sm text-gray-500">Sections</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-gray-900">{totalVideos}</div>
            <div className="text-sm text-gray-500">Videos</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-gray-900">{totalObservations}</div>
            <div className="text-sm text-gray-500">Observations</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-red-600">{highSeverityCount}</div>
            <div className="text-sm text-gray-500">High Severity</div>
          </div>
        </div>
      </div>

      {/* Video Source Selection Modal */}
      {uploadingSectionId && (
        <VideoSourceModal
          isOpen={!!uploadingSectionId}
          onClose={() => setUploadingSectionId(null)}
          sectionId={uploadingSectionId}
          sectionName={sections.find(s => s.id === uploadingSectionId)?.name}
          projectId={project.id}
          onVideoAdded={(data) => {
            // Refresh the section with new video data
            handleVideoUploadComplete(uploadingSectionId, {
              videoUrl: data.videoUrl,
              filename: data.filename,
              duration: data.duration,
              metadata: data.metadata
            })
            setUploadingSectionId(null)
          }}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <BulkVideoUpload 
            projectId={project.id}
            onClose={() => setShowBulkUpload(false)}
          />
        </div>
      )}

      <SectionDetailsForm
        isOpen={showSectionDetailsForm}
        onClose={closeEditSection}
        projectId={project?.id}
        sectionData={editingSectionData}
        onSectionSaved={editingSectionData ? updateSection : addSection}
      />

      {showObservationForm && currentSectionId && (
        <ObservationForm
          sectionId={currentSectionId}
          videoRef={videoRefs.current[currentSectionId]}
          videoTimestamp={videoTimestamp}
          shouldAutoCapture={shouldAutoCapture}
          initialData={editingObservation}
          isOpen={showObservationForm}
          onClose={handleCloseObservationForm}
          onSave={handleSaveObservationWrapper}
        />
      )}

      {/* Archive Modal */}
      <ArchiveProjectModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={handleArchiveProject}
        projectName={project?.name}
        isArchiving={isArchiving}
      />
    </>
  )
}